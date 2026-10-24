import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import HRMPortal from "./HRMPortal";
jest.mock("../components/LoginSignup", () => ({ apiUrl: "http://hrm.test" }));
jest.mock("../components/NotificationBell", () => () => (
  <span>Notifications</span>
));
jest.mock("../components/Timecard", () => () => (
  <span>Historical timecard</span>
));
const fixture = {
  today: "2026-10-22",
  activationDate: "2026-10-01",
  isHR: false,
  isSystem: false,
  employees: [
    {
      userId: "employee-1",
      name: "Priya Employee",
      department: "Admin",
      gender: "Female",
      branch: "Delhi",
    },
  ],
  requests: [],
  balances: { EL: 3, WFH: 2, ML: 0.5 },
  holidays: [],
  locks: [],
  policies: [],
  policy: {},
  legacyLeaves: [],
  ledger: [],
  wfhUsedQuarter: 1,
  attendance: [
    {
      date: "2026-10-22",
      userId: "employee-1",
      status: "Present",
      checkIn: "10:05",
      checkOut: "",
      payable: 1,
    },
  ],
};
beforeEach(() => {
  localStorage.setItem(
    "userSession",
    JSON.stringify({
      user_id: "employee-1",
      name: "Priya Employee",
      user_role: "employee",
      token: "test-token",
    }),
  );
  global.fetch = jest.fn(async (url, options) => ({
    ok: true,
    json: async () =>
      url.includes("/company/")
        ? { company_name: "Test Company" }
        : url.includes("/bootstrap")
          ? fixture
          : url.includes("/attendance?")
            ? { records: fixture.attendance }
            : { saved: true },
  }));
});
afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});
const open = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <HRMPortal />
    </MemoryRouter>,
  );
test("employee dashboard shows balances and hides HR-only navigation", async () => {
  open("/hrm");
  expect(
    await screen.findByText(/Good (morning|day), Priya\./),
  ).toBeInTheDocument();
  expect(screen.getByText("WFH balance")).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Employee setup" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Back to CRM/ })).toHaveAttribute(
    "href",
    "/dashboard",
  );
});

test("HR dashboard loads team attendance in one request rather than per employee", async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (url, options) => {
    if (url.includes("/bootstrap"))
      return {
        ok: true,
        json: async () => ({
          ...fixture,
          isHR: true,
          employees: [
            ...fixture.employees,
            { userId: "employee-2", name: "Second Employee" },
          ],
        }),
      };
    if (url.includes("/attendance/team"))
      return { ok: true, json: async () => ({ team: [] }) };
    return originalFetch(url, options);
  });
  open("/hrm");
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(([url]) => url.includes("/attendance/team?")),
    ).toBe(true),
  );
  expect(
    fetch.mock.calls.filter(([url]) => url.includes("/attendance?")),
  ).toHaveLength(0);
});
test("direct settings navigation is restricted for employees", async () => {
  open("/hrm/settings");
  expect(
    await screen.findByText(
      "Your account does not have access to this section.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("Save policy version")).not.toBeInTheDocument();
});
test("calendar opens the recorded attendance details without employee edit controls", async () => {
  open("/hrm/attendance");
  const day = await screen.findByRole("button", { name: /22 Present/ });
  fireEvent.click(day);
  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Record details")).toBeInTheDocument();
  expect(screen.queryByText("Save correction")).not.toBeInTheDocument();
});
test("leave form submits source and half-day intent through the authenticated HRM API", async () => {
  open("/hrm/leave");
  await screen.findByText("Plan your time off");
  fireEvent.change(screen.getByLabelText(/^From/), {
    target: { value: "2026-10-26" },
  });
  fireEvent.change(screen.getByLabelText(/^To/), {
    target: { value: "2026-10-26" },
  });
  fireEvent.change(screen.getByLabelText(/^Reason/), {
    target: { value: "Personal appointment" },
  });
  fireEvent.click(screen.getByLabelText("Half day"));
  fireEvent.click(screen.getByRole("button", { name: "Submit leave request" }));
  await waitFor(() =>
    expect(
      fetch.mock.calls.some(
        ([url, opts]) => url.endsWith("/requests") && opts?.method === "POST",
      ),
    ).toBe(true),
  );
  const [, options] = fetch.mock.calls.find(
    ([url, opts]) => url.endsWith("/requests") && opts?.method === "POST",
  );
  const payload = JSON.parse(options.body.get("payload"));
  expect(payload).toMatchObject({
    kind: "LEAVE",
    source: "EMPLOYEE_CRM",
    userId: "employee-1",
    halfDay: true,
    reason: "Personal appointment",
  });
  expect(options.headers.Authorization).toBe("test-token");
  await screen.findByText("Saved successfully");
});

test("switching from half-day leave to WFH does not submit leave-only fields", async () => {
  open("/hrm/leave");
  await screen.findByText("Plan your time off");
  fireEvent.click(screen.getByLabelText("Half day"));
  fireEvent.click(
    screen
      .getAllByRole("link")
      .find((link) => link.getAttribute("href") === "/hrm/wfh"),
  );
  await screen.findByText("Request work from home");
  fireEvent.change(screen.getByLabelText(/^From/), {
    target: { value: "2026-10-26" },
  });
  fireEvent.change(screen.getByLabelText(/^To/), {
    target: { value: "2026-10-26" },
  });
  fireEvent.change(screen.getByLabelText(/^Reason/), {
    target: { value: "Remote work" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit WFH request" }));
  await screen.findByText("Saved successfully");
  const [, options] = fetch.mock.calls.find(
    ([url, opts]) => url.endsWith("/requests") && opts?.method === "POST",
  );
  const payload = JSON.parse(options.body.get("payload"));
  expect(payload).toMatchObject({ kind: "WFH", halfDay: false });
  expect(payload.leaveType).toBeUndefined();
});
