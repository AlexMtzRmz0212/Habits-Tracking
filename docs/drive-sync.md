# Automated sync: phone → Drive → Postgres

Once this is set up, the site updates on its own. Loop Habits writes a backup,
that backup reaches Google Drive, and a daily GitHub Action loads it into
Postgres and recomputes the analyses.

There are four parts, and the first is the one people get stuck on.

---

## 1. Getting backups into Drive

Loop Habits has **Settings -> Export full backup**, which produces a `.db` file
and opens the Android share sheet. **Google Drive is one of the share targets**,
so the backup goes straight to Drive in one tap -- no folder-sync app, no
watching a local directory, nothing to keep alive in the background.

1. In Google Drive, create a folder called `LoopHabits`.
2. In Loop: **Export full backup** -> tap **Drive** -> choose `LoopHabits` ->
   Upload.
3. Confirm the `.db` file is there.

Creating the backup stays manual -- this version of Loop has no scheduled
backup -- so the steady state is: tap export whenever you want the site
refreshed, and everything after that is automatic. Realistically a weekly
ten-second habit.

Nothing breaks if you skip a week. The daily job finds the same file as last
time, logs `skipped_no_change`, and does nothing.

Each export is a new timestamped file, so the folder builds up a backup
history. The sync always takes the newest `.db` and ignores the others, so you
can leave them or clear them out as you prefer.

Note the folder's ID -- it is the last part of the URL when you open the folder
in a browser:

```
https://drive.google.com/drive/folders/1A2B3C4D5E6F7G8H9I0J
                                       ^^^^^^^^^^^^^^^^^^^^ this
```

---

## 2. A service account to read that folder

A service account is a Google identity for a program. Using one avoids the
OAuth consent flow, which exists so a human can approve access — and there is
no human here.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   create a project (any name; `habits-sync` is fine).
2. **APIs & Services → Library → Google Drive API → Enable.**
3. **APIs & Services → Credentials → Create credentials → Service account.**
   Name it anything. No roles are needed — it gets access by folder sharing,
   not by project permissions.
4. Open the new service account → **Keys → Add key → Create new key → JSON**.
   A `.json` file downloads. **This is a credential — do not commit it.**
   `.gitignore` already blocks `service-account*.json` and `*credentials*.json`,
   but keep it out of the repo directory anyway.
5. Copy the service account's **email** (it looks like
   `habits-sync@your-project.iam.gserviceaccount.com`).

### Share the folder with it

In Google Drive, right-click the backup folder → **Share** → paste the service
account email → set it to **Viewer** → Share.

This is the whole permission model: the service account can read that one
folder and nothing else in your Drive. It cannot write, and it cannot see
anything you did not share.

---

## 3. GitHub secrets

**Repo → Settings → Secrets and variables → Actions → New repository secret.**

| Secret | Value |
| --- | --- |
| `DATABASE_URL_PRIVATE` | Your Neon connection string — the **direct** one, not `-pooler` |
| `GOOGLE_DRIVE_FOLDER_ID` | The folder ID from step 1 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The contents of the JSON key file |

For the JSON, base64 is safer than pasting raw — the private key contains
newlines that are easy to mangle:

```bash
python -c "import base64,sys; print(base64.b64encode(open(sys.argv[1],'rb').read()).decode())" service-account.json
```

The loader accepts either form.

Use the **direct** Neon endpoint here, not the pooled one. This job holds a
single connection and does batch upserts; the pooler is for serverless
functions opening many short connections.

---

## 4. Run it

**Actions → Sync habits from Drive → Run workflow.** After that it runs daily
at 05:15 UTC on its own.

Locally, if you have the same variables in `.env`:

```bash
python -m pipeline.run_sync --from-drive --dry-run
```

### What a healthy run looks like

The first run imports. The second, with no new backup, should stop early:

```
Drive : Loop Habits Backup 2026-08-31 161723.db (modified 2026-08-31 16:17 UTC)
Unchanged since the last successful sync. Nothing to do.
```

That check compares Drive's MD5 against the last successful run in
`sync_runs`, before downloading anything. Most days there is nothing new, and
this keeps those days cheap.

Every run is recorded either way:

```sql
SELECT started_at, status, source_file_name, rows_upserted, error_message
FROM sync_runs
ORDER BY started_at DESC
LIMIT 10;
```

`status` is one of `running`, `success`, `failed`, `skipped_no_change`.

---

## Troubleshooting

**"No .db backup found in the Drive folder"** — the folder is empty, the folder
ID is wrong, or the folder was never shared with the service account. Check
sharing first; it is the usual cause.

**`HttpError 404` on the folder** — shared with the wrong address. It must be
the service account's email, not your own.

**`HttpError 403: Google Drive API has not been used`** — step 2.2 was skipped,
or the key belongs to a different project than the one where you enabled the
API.

**It runs, reports success, but the site does not change** — the sync updates
Postgres; the public page caches for an hour. Wait, or redeploy. Also confirm
the analysis you expect is actually published:
`python scripts/publish.py list`.
