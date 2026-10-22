// Read-only logical backup of the existing CRM database. Never restores production.
import dotenv from "dotenv";
import mongoose from "mongoose";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile, unlink, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backend = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
dotenv.config({ path: path.join(backend, ".env"), quiet: true });
const uri = process.env.Mongo_URL;
const executable = process.env.MONGODUMP_PATH || "mongodump";
if (!uri) throw new Error("Mongo_URL is missing from the backend environment");
const root = path.resolve(backend, "..", ".local-backups");
const destination = path.join(
  root,
  `before-hrm-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`,
);
await mkdir(root, { recursive: true, mode: 0o700 });
// Fail closed if Windows permissions cannot be restricted before writing secrets.
if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      '$ErrorActionPreference="Stop"; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $owner=(Get-Acl -LiteralPath (Split-Path -Parent $env:CRM_BACKUP_ROOT)).Owner; & icacls.exe $env:CRM_BACKUP_ROOT /inheritance:r /grant:r ("*"+$sid+":(OI)(CI)F") ($owner+":(OI)(CI)F") "*S-1-5-18:(OI)(CI)F"; if ($LASTEXITCODE -ne 0) { throw "Cannot restrict backup permissions" }',
    ],
    { env: { ...process.env, CRM_BACKUP_ROOT: root }, stdio: "pipe" },
  );
}
await mkdir(destination, { mode: 0o700 });
const archive = path.join(destination, "crm.archive.gz");
const config = path.join(destination, "connection.private.yml");
const client = new mongoose.mongo.MongoClient(uri, {
  serverSelectionTimeoutMS: 10000,
});
const startedAt = new Date().toISOString();
const safeLog = (text) =>
  String(text)
    .replaceAll(uri, "[REDACTED CONNECTION]")
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/g, "[REDACTED CONNECTION]");
let metadata;
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (c) => {
      output += c;
    });
    child.stderr.on("data", (c) => {
      output += c;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(output)
        : reject(
            new Error(
              `mongodump failed with exit code ${code}: ${safeLog(output)}`,
            ),
          ),
    );
  });
try {
  await client.connect();
  const db = client.db();
  const collections = await db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const build = await db.admin().command({ buildInfo: 1 });
  metadata = {
    database: db.databaseName,
    serverVersion: build.version,
    collections: collections.map((c) => c.name).sort(),
  };
  await client.close();
  // JSON is valid YAML. Credentials never appear in command arguments or logs.
  await writeFile(config, JSON.stringify({ uri }), { mode: 0o600, flag: "wx" });
  const output = await run([
    `--config=${config}`,
    `--db=${metadata.database}`,
    `--archive=${archive}`,
    "--gzip",
  ]);
  await writeFile(path.join(destination, "dump.log"), safeLog(output), {
    mode: 0o600,
    flag: "wx",
  });
  const bytes = (await stat(archive)).size;
  if (!bytes) throw new Error("Backup archive is empty");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(archive)) hash.update(chunk);
  const manifest = {
    status: "DUMP_COMPLETED",
    startedAt,
    completedAt: new Date().toISOString(),
    ...metadata,
    archive: "crm.archive.gz",
    bytes,
    sha256: hash.digest("hex"),
    consistency:
      "Online single-database logical dump; no oplog capture and no write pause. Not a guaranteed point-in-time snapshot.",
    verification:
      "Checksum generated; restore rehearsal must be recorded separately.",
    excludes: [
      "Cloudinary file contents (database links are included)",
      "Atlas configuration, database users and roles",
      "application secrets and deployed code",
    ],
    warning:
      "Confidential CRM data, not encrypted by this script. Keep folder private and store a secure off-device copy. Never commit it to Git. Restore to a separate database first.",
  };
  await writeFile(
    path.join(destination, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    JSON.stringify(
      {
        destination,
        database: metadata.database,
        bytes,
        sha256: manifest.sha256,
        status: manifest.status,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    `Backup failed (${error.name}). Do not rely on a partial archive. No live database changes were made.`,
  );
  console.error(safeLog(error.message));
  process.exitCode = 1;
} finally {
  await client.close();
  try {
    await unlink(config);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
