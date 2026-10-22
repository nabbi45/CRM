// Restores only to a newly started, isolated local MongoDB. Never loads CRM .env.
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

if (!process.argv[2]) throw new Error("Pass the exact backup folder to verify");
const folder = path.resolve(process.argv[2]);
const manifest = JSON.parse(
  await readFile(path.join(folder, "manifest.json"), "utf8"),
);
if (manifest.status !== "DUMP_COMPLETED")
  throw new Error("This is not a completed backup");
const archive = path.join(folder, "crm.archive.gz");
const hash = createHash("sha256");
for await (const chunk of createReadStream(archive)) hash.update(chunk);
if (hash.digest("hex") !== manifest.sha256)
  throw new Error("Backup checksum mismatch");
if (!manifest.serverVersion.startsWith("8.0."))
  throw new Error(
    "This rehearsal uses MongoDB 8.0; select a compatible binary for this source first",
  );
const dumpLog = await readFile(path.join(folder, "dump.log"), "utf8");
const counts = new Map(
  [...dumpLog.matchAll(/done dumping `([^`]+)` \((\d+) documents?\)/g)].map(
    (m) => [m[1].slice(manifest.database.length + 1), Number(m[2])],
  ),
);
if (manifest.collections.some((name) => !counts.has(name)))
  throw new Error("A collection is missing from the completed dump log");
const temporary = await mkdtemp(path.join(folder, "restore-rehearsal-"));
let instance, client;
try {
  instance = await MongoMemoryServer.create({
    binary: { version: "8.0.14" },
    instance: { dbPath: temporary, ip: "127.0.0.1" },
  });
  const uri = instance.getUri();
  if (!uri.startsWith("mongodb://127.0.0.1:"))
    throw new Error("Restore target is not isolated loopback");
  const database = "crm_backup_rehearsal";
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      process.env.MONGORESTORE_PATH || "mongorestore",
      [
        `--uri=${uri}`,
        `--archive=${archive}`,
        "--gzip",
        `--nsFrom=${manifest.database}.*`,
        `--nsTo=${database}.*`,
        "--stopOnError",
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let log = "";
    child.stdout.on("data", (c) => {
      log += c;
    });
    child.stderr.on("data", (c) => {
      log += c;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, log }));
  });
  await writeFile(path.join(folder, "restore-rehearsal.log"), result.log, {
    mode: 0o600,
  });
  if (result.code !== 0)
    throw new Error(
      "Local rehearsal restore failed; inspect the private restore log",
    );
  client = new mongoose.mongo.MongoClient(uri);
  await client.connect();
  const db = client.db(database);
  const restored = await db.listCollections({}, { nameOnly: true }).toArray();
  if (restored.length !== manifest.collections.length)
    throw new Error("Restored collection count differs");
  const verified = [];
  for (const name of manifest.collections) {
    const documents = await db.collection(name).countDocuments();
    if (documents !== counts.get(name))
      throw new Error("Restored document count differs from dump log");
    const validation = await db.command({ validate: name, full: true });
    if (!validation.valid)
      throw new Error("A restored collection failed MongoDB validation");
    const indexes = await db.collection(name).indexes();
    verified.push({ collection: name, documents, indexes: indexes.length });
  }
  const verification = {
    status: "LOCAL_RESTORE_VERIFIED",
    verifiedAt: new Date().toISOString(),
    sourceVersion: manifest.serverVersion,
    rehearsalVersion: "8.0.14",
    sha256: manifest.sha256,
    collections: verified,
    totalDocuments: verified.reduce((n, c) => n + c.documents, 0),
    limitations:
      "Confirms the archive can be restored locally and counts match the dump. Does not prove point-in-time consistency of an online source or application-level correctness. No production restore performed.",
  };
  await writeFile(
    path.join(folder, "verification.json"),
    JSON.stringify(verification, null, 2),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      status: verification.status,
      collections: verified.length,
      documents: verification.totalDocuments,
      productionChanged: false,
    }),
  );
} finally {
  if (client) await client.close();
  if (instance) await instance.stop();
  // Only remove the exact temporary rehearsal directory, never the backup itself.
  if (
    path.dirname(temporary) === folder &&
    path.basename(temporary).startsWith("restore-rehearsal-")
  ) {
    await rm(temporary, { recursive: true, force: true });
  }
}
