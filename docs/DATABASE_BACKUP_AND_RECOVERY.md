# CRM database backup and recovery

## Verified pre setup checkpoint

A backup was taken on 22 October 2026, from 12:45:45 to 12:45:51 India time,
before HRM setup/activation records were populated in the source database.

- Database: `crm_db`, source MongoDB version `8.0.34`.
- Folder at workspace root: `.local-backups/before-hrm-2026-10-22T07-15-44-610Z-bd14479f`.
- Compressed archive size: 4,904,105 bytes.
- SHA-256: `9f8c9ed0d51083f49f0cbbf6ef07d2fcacea08553402664c820286b594250afc`.
- Real local restore verified on compatible MongoDB `8.0.14`: 34 collections and
  18,797 documents matched the dump log; restored collections passed MongoDB
  validation and indexes were present. See the private `verification.json`.
- The temporary local recovery database was stopped and removed. Production was
  not restored or modified. The archive, manifest and verification logs remain.
- This is an online logical dump, not a guaranteed point-in-time snapshot.
  No write pause was performed. Atlas snapshot/PITR settings have not been verified.
- Encryption and a secure off-device copy still need to be arranged by the owner.
  Do not mistake a private local folder for encrypted or off-device storage.

## What is protected

HRM uses the existing Atlas database, not a separate database. Take a complete CRM
database backup before setup: setup can update existing employee profile fields,
and compatibility paths can affect existing leave records. Backing up only the
HRM collections is not sufficient for a full rollback.

The local backup script creates a compressed BSON archive with collection data,
options and index definitions. It reads production but never restores, deletes,
or changes production records. A manifest records the database name, source server
version, collection list, UTC start/end time, archive size and SHA-256 checksum.

The archive does **not** contain Cloudinary file contents, Atlas configuration,
database users/roles, application secrets or deployed application code. Database
links to uploaded files are included. Preserve the uploaded files separately; do
not delete them during recovery. Keep the matching source-code/deployment version
and environment secrets in their existing secure storage.

## A timestamp is not a backup

- `createdAt` and `updatedAt` record times; they do not retain old field values.
- Mongoose `__v` is a version counter, not a complete revision archive or undo tool.
- An ObjectId timestamp can indicate creation time, not the original document.
- A replica set protects availability. It also replicates accidental changes;
  replicas are not independent historical backups.
- HRM audits, balance reversals and versioned month snapshots help explain and
  correct HRM changes. They are not a full CRM database restore mechanism.
- Atlas scheduled/on-demand snapshots and point-in-time recovery are separate
  features. Availability, retention and recovery windows depend on cluster type
  and enabled settings. An existing connection string does not prove backups are
  enabled. Check the actual Atlas project and cluster Backup page.

## Local backup procedure

The backup tool is `CRM_BACKEND/scripts/backupDatabase.mjs`. It reads `Mongo_URL`
from the existing backend environment or `.env`. It does not log the connection
string. Database credentials are supplied through a temporary private config file,
not the process command line; the file is removed afterward. On Windows, the
backup root is restricted for the executing account, workspace owner and SYSTEM
before any data or connection config is written. On other systems, create the backup root with
owner-only permissions before running the script.

Install official MongoDB Database Tools, or point `MONGODUMP_PATH` to an existing
`mongodump.exe`. From the backend directory in PowerShell:

```powershell
$env:MONGODUMP_PATH = 'C:\path\to\official-tools\bin\mongodump.exe'
node scripts/backupDatabase.mjs
```

Each run creates a new `.local-backups/before-hrm-<UTC timestamp>-<unique suffix>`
folder at the workspace root. It never overwrites an earlier backup. The folder
contains `crm.archive.gz`, `manifest.json` and `dump.log`. Only a successful dump
gets a manifest with status `DUMP_COMPLETED`; a partial archive after a failure
must not be relied on. This folder is excluded from Git. Do not remove that
exclusion or attach the archive to a ticket or chat.

Gzip is compression, not encryption. Windows permissions help control local access
but do not replace encryption. Store an encrypted off-device copy in company-owned
backup storage with restricted access. Do not rely on one developer laptop.

## Consistency and the final pre activation checkpoint

The script takes an **online single-database logical dump** without oplog capture.
It does not pause the running CRM or its background workers. Writes occurring
during the dump can make collections represent different moments. A successful
dump and checksum are not proof of a single point-in-time business state.

Before activation, prefer an Atlas on-demand snapshot with a confirmed restore
point. If that is unavailable, arrange an approved maintenance window: stop all
CRM writes and background writers across all instances, take and verify a fresh
dump, then resume. Do not stop the business application without approval. Do not
add `--oplog` to this single-database command: MongoDB requires a full replica-set
dump for that option, with suitable privileges and deployment support.

Record who approved the checkpoint, the snapshot ID or backup folder, start/end
time, whether writes were paused, and who verified recovery. Do not call an online
logical dump a point-in-time snapshot.

## Verify the backup

1. Confirm `DUMP_COMPLETED` in the manifest and no dump failure.
2. Recalculate the archive checksum and compare with `manifest.json`:

   ```powershell
   Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\exact\backup\crm.archive.gz'
   ```

3. Rehearse restoration to an isolated local or staging database running a
   compatible MongoDB major/feature-compatibility version. Never test against the
   live CRM. A `mongorestore --dryRun --verbose` can inspect a restore plan without
   importing data, but it does not replace an actual restoration test.
4. Compare collection and document counts, check restored indexes, and sample
   users, employee profiles, bookings, leaves and HRM ledgers. Keep rehearsal
   results beside the backup manifest. A successful rehearsal shows restorability,
   not that concurrent production writes formed a consistent business snapshot.
5. If testing the CRM against a recovered copy, isolate it from live email,
   notifications, uploads, payments and background workers. Never use a copied
   production `.env` to launch a recovery rehearsal.

The included verification helper performs a real restore to a newly started
loopback-only local MongoDB 8.0 instance. It never loads the CRM `.env` or uses the
production connection. It checks SHA-256, collection/document counts against the
dump log, restored indexes and MongoDB collection validation, then stops the test
server and removes only its temporary database files. It leaves the backup intact.
Source databases from another MongoDB major version require a compatible test
binary and an explicit script update; the helper refuses them by default.

```powershell
$env:MONGORESTORE_PATH = 'C:\path\to\official-tools\bin\mongorestore.exe'
node scripts/verifyDatabaseBackup.mjs 'C:\exact\backup\folder'
```

Run from `CRM_BACKEND` with development dependencies installed. The first run
downloads the MongoDB 8.0 test binary. The result is stored privately beside the
archive as `verification.json` and `restore-rehearsal.log`. The rehearsal does not
prove application-level correctness or online point-in-time consistency.

## Safe recovery procedure for the administrator

Recovery is a separate, potentially destructive operation requiring approval.
The backup script deliberately has no production restore command or reset button.

1. Identify the exact fault and stop further affected HRM actions. Prefer an audited
   correction, cancellation/reversal or authorised unlock over a full rollback.
2. Take a new backup of the current state before attempting any recovery. Record
   the faulty period and the bookings or other valid changes made after the old
   backup. Do not overwrite or delete either backup.
3. Restore the chosen backup into a **new, empty, isolated database**, not `crm_db`.
   Match the source MongoDB compatibility requirements. A namespace-remapping
   example for an administrator is below; placeholders must be replaced with a
   separately approved recovery target. Do not use production credentials here.

   ```text
   mongorestore --config=RECOVERY_ONLY_CONFIG.yml --archive=EXACT_BACKUP_PATH/crm.archive.gz --gzip --nsFrom="crm_db.*" --nsTo="crm_recovery_review.*" --stopOnError
   ```

   The config contains only the recovery deployment URI. Check its host and the
   destination namespace before running. Do not use `--drop`, restore directly to
   production, or assume restoring into a populated database safely overwrites it.
4. Compare old and current records, including shared employee profiles and legacy
   leaves. Develop a selective repair plan when later valid CRM activity must be
   retained. Restoring only HRM collections without checking shared records can
   leave inconsistent balances or approvals.
5. If a full rollback is unavoidable, obtain explicit approval for the loss of
   changes after the restore point, arrange a write pause for all application
   instances/workers, and have the database administrator execute the reviewed
   recovery/cutover plan. Preserve the current database until validation is complete.
6. Validate logins, users, bookings, documents, employee profiles, notifications,
   requests, balances and payroll snapshots before reopening writes. Coordinate
   session invalidation where required. Keep a record of the restore point and
   all reconciliation actions.

## Official references

- [MongoDB mongodump and consistency limitations](https://www.mongodb.com/docs/database-tools/mongodump/)
- [MongoDB mongorestore and dry run](https://www.mongodb.com/docs/database-tools/mongorestore/)
- [Atlas backup overview and required permissions](https://www.mongodb.com/docs/atlas/backup/cloud-backup/overview/)
- [Atlas Free cluster backup options](https://www.mongodb.com/docs/atlas/backup/cloud-backup/free-cluster-backup/)
- [Mongoose version keys](https://mongoosejs.com/docs/8.x/docs/guide.html#versionKey)
- [Mongoose timestamps](https://mongoosejs.com/docs/8.x/docs/timestamps.html)
