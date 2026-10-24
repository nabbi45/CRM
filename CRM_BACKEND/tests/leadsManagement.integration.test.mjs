// Runs against a disposable MongoDB instance and never uses the CRM database.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import * as XLSX from "xlsx";
import LeadManagementRoutes from "../src/routes/LeadManagementRoute.js";
import { UserModel } from "../src/models/UserModel.js";
import { NotificationModel } from "../src/models/NotificationModel.js";
import {
  LeadColumnModel,
  LeadManagementModel,
} from "../src/models/LeadManagementModel.js";

const require = createRequire(import.meta.url);
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.JWT_SECRET = "isolated-leads-test-secret-never-used-in-production";

const app = express();
app.use(express.json());
app.use("/leads-management", LeadManagementRoutes);

let mongo;
let admin;
let senior;
let owner;
let anotherOwner;

const tokenFor = (user) =>
  jwt.sign(
    {
      userId: String(user._id),
      user_role: user.user_role,
      feature_permissions: user.feature_permissions,
    },
    process.env.JWT_SECRET,
  );

const leadWorkbook = () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "Name",
      "Mobile Number",
      "Email",
      "Service Requirement",
      "Company Name",
      "City",
    ],
    ["Aarav", "9876543210", "aarav@example.test", "Website", "Acme", "Delhi"],
    ["Mira", "9876543211", "mira@example.test", "App", "Beta", "Pune"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Leads");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
};

before(
  async () => {
    mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
    await mongoose.connect(mongo.getUri(), { dbName: "isolated_leads_tests" });
    await Promise.all(
      [UserModel, NotificationModel, LeadManagementModel, LeadColumnModel].map(
        (model) => model.init(),
      ),
    );
    [admin, senior, owner, anotherOwner] = await UserModel.create([
      {
        name: "CRM Admin",
        email: "leads-admin@example.test",
        password: "test-only",
        user_role: "admin",
        feature_permissions: ["lead_management"],
      },
      {
        name: "Senior Admin",
        email: "leads-senior@example.test",
        password: "test-only",
        user_role: "senior admin",
        feature_permissions: ["lead_management"],
      },
      {
        name: "Lead Owner",
        email: "lead-owner@example.test",
        password: "test-only",
        user_role: "employee",
        feature_permissions: ["lead_management"],
      },
      {
        name: "Another Owner",
        email: "another-owner@example.test",
        password: "test-only",
        user_role: "employee",
        feature_permissions: ["lead_management"],
      },
    ]);
  },
  { timeout: 120000 },
);

after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test("only management roles can create/import leads and required headings are checked", async () => {
  await request(app)
    .post("/leads-management")
    .set("Authorization", tokenFor(owner))
    .send({ name: "Not allowed", mobileNumber: "9876543000" })
    .expect(403);

  await request(app)
    .post("/leads-management/import")
    .set("Authorization", tokenFor(admin))
    .attach(
      "file",
      Buffer.from("Name,Email\nAarav,aarav@example.test"),
      "bad.csv",
    )
    .expect(400)
    .expect((response) => assert.match(response.body.message, /Mobile Number/));

  const create = await request(app)
    .post("/leads-management")
    .set("Authorization", tokenFor(admin))
    .send({
      name: "Manual Lead",
      mobileNumber: "+91 98765 43212",
      companyName: "Manual Co",
      customFields: { Budget: "1 lakh" },
    })
    .expect(201);
  assert.equal(create.body.lead.mobileNumber, "919876543212");

  const imported = await request(app)
    .post("/leads-management/import")
    .set("Authorization", tokenFor(admin))
    .attach("file", leadWorkbook(), "new-leads.xlsx")
    .expect(201);
  assert.equal(imported.body.imported, 2);
  assert.equal(imported.body.rejected.length, 0);

  const columns = await request(app)
    .get("/leads-management/columns")
    .set("Authorization", tokenFor(admin))
    .expect(200);
  assert(columns.body.columns.some((column) => column.key === "city"));
  assert(columns.body.columns.some((column) => column.key === "budget"));

  const bootstrap = await request(app)
    .get("/leads-management/bootstrap")
    .set("Authorization", tokenFor(admin))
    .expect(200);
  assert.equal(bootstrap.body.leads.length, 3);
  assert.equal(bootstrap.body.canManage, true);
  // The lead list must not load the whole assignment directory. It is fetched
  // only if the manager opens the Assign dialog.
  assert.equal(bootstrap.body.users, undefined);
  assert.equal(bootstrap.body.leads[0].assignmentHistory, undefined);
  assert.equal(bootstrap.body.leads[0].statusHistory, undefined);

  const assignable = await request(app)
    .get("/leads-management/users")
    .set("Authorization", tokenFor(admin))
    .expect(200);
  assert(assignable.body.users.some((user) => user.name === "Lead Owner"));
  assert.equal(assignable.body.users[0].profilePicture, undefined);

  const secondPage = await request(app)
    .get("/leads-management?limit=2&page=2")
    .set("Authorization", tokenFor(admin))
    .expect(200);
  assert.equal(secondPage.body.leads.length, 1);
  assert.equal(secondPage.body.pagination.page, 2);
  assert.equal(secondPage.body.pagination.totalPages, 2);
});

test("assignment notifies the owner and owners can update their own leads and five call notes", async () => {
  const list = await request(app)
    .get("/leads-management")
    .set("Authorization", tokenFor(admin))
    .expect(200);
  assert.equal(list.body.canManage, true);
  assert.equal(list.body.leads.length, 3);
  const selected = list.body.leads.slice(0, 2);

  await request(app)
    .post("/leads-management/assign")
    .set("Authorization", tokenFor(admin))
    .send({
      leadIds: selected.map((lead) => lead._id),
      userId: String(owner._id),
    })
    .expect(200)
    .expect((response) => assert.equal(response.body.assigned, 2));

  const notification = await NotificationModel.findOne({
    user_id: String(owner._id),
    type: "lead_assigned",
  }).lean();
  assert.match(notification.message, /assigned 2 leads/i);

  const mine = await request(app)
    .get("/leads-management")
    .set("Authorization", tokenFor(owner))
    .expect(200);
  assert.equal(mine.body.canManage, false);
  assert.equal(mine.body.leads.length, 2);

  const activeLead = mine.body.leads[0];
  await request(app)
    .patch(`/leads-management/${activeLead._id}`)
    .set("Authorization", tokenFor(owner))
    .send({ status: "qualified" })
    .expect(200)
    .expect((response) => assert.equal(response.body.lead.status, "qualified"));

  await request(app)
    .post(`/leads-management/${activeLead._id}/notes`)
    .set("Authorization", tokenFor(owner))
    .send({ number: 1, content: "Called once; asked for a proposal." })
    .expect(200);

  await request(app)
    .post(`/leads-management/${activeLead._id}/notes`)
    .set("Authorization", tokenFor(owner))
    .send({ number: 5, content: "Fifth follow-up is scheduled." })
    .expect(200);

  const afterNotes = await LeadManagementModel.findById(activeLead._id).lean();
  assert.equal(afterNotes.noteEntries.length, 2);
  assert.equal(afterNotes.statusHistory.length, 1);

  const outsider = await request(app)
    .get("/leads-management")
    .set("Authorization", tokenFor(anotherOwner))
    .expect(200);
  assert.equal(outsider.body.leads.length, 0);

  await request(app)
    .patch(`/leads-management/${activeLead._id}`)
    .set("Authorization", tokenFor(anotherOwner))
    .send({ status: "junk" })
    .expect(403);
});

test("administrators can rename columns, while only senior management can delete leads", async () => {
  const columns = await LeadColumnModel.find({ key: "city" }).lean();
  assert.equal(columns.length, 1);

  await request(app)
    .patch(`/leads-management/columns/${columns[0]._id}`)
    .set("Authorization", tokenFor(admin))
    .send({ label: "Preferred city" })
    .expect(200)
    .expect((response) =>
      assert.equal(response.body.column.label, "Preferred city"),
    );

  const all = await request(app)
    .get("/leads-management?status=qualified")
    .set("Authorization", tokenFor(admin))
    .expect(200);
  assert.equal(all.body.leads.length, 1);
  assert.equal(all.body.leads[0].assignedToName, "Lead Owner");

  await request(app)
    .delete("/leads-management/selected")
    .set("Authorization", tokenFor(admin))
    .send({ leadIds: [all.body.leads[0]._id] })
    .expect(403);

  await request(app)
    .delete("/leads-management/selected")
    .set("Authorization", tokenFor(senior))
    .send({ leadIds: [all.body.leads[0]._id] })
    .expect(200)
    .expect((response) => assert.equal(response.body.deleted, 1));
  assert.equal(
    await LeadManagementModel.countDocuments({ status: "qualified" }),
    0,
  );
});
