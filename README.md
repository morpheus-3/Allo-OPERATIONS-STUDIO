# Allo AI Operations Manager

**Project repository:** https://github.com/morpheus-3/Allo-OPERATIONS-STUDIO

## For reviewers

This submission contains the complete source, runnable offline demonstration, Google Sheets workbook template, Apps Script automation, solution report and reproducible test evidence.

- Download `release/Allo_AI_Operations_Manager_v1.1.0.zip`, extract it, and open `demo.html` in a browser.
- Read `submission/SOLUTION_REPORT.docx` and `submission/START_HERE.md` for the implementation and demonstration route.
- Run `npm run verify` with Node.js 18+ to reproduce all 25 local tests and the eight assignment scenarios. No npm dependencies are required.
- Google Sheets installation is documented below and in `submission/DEPLOYMENT.md` for anyone who wants to run the automation in their own account.

Delivery scope: GitHub source and downloadable prototype. No public website or live Google Sheet is deployed. Browser users, clocks and emails are simulated; actual Google permissions and email receipt have not been verified.

Google Sheets and Google Apps Script prototype for recurring tasks, employee completion, manager acknowledgement and leadership escalation. Built from the supplied Allo assignment. No paid service or AI API is required.

## Setup

1. Create a blank Google Sheet. Open **Extensions → Apps Script**.
2. Copy `src/Code.gs`, `src/Engine.gs` and `src/Diagnostics.gs` into matching script files. Alternatively paste `submission/Allo_Operations_AppsScript.gs` into one script file; do not install both forms.
3. Enable **Show appsscript.json manifest file** in project settings and replace it with `src/appsscript.json`.
4. Save and run **setup**. Authorize the requested permissions, return to the Sheet and reload.
5. Replace example employee emails in Tasks and manager/leadership emails in Settings. Before testing/sharing, delete the four sample Workboard data rows so setup can generate cycles with the real assignees. Run setup again to refresh protections. Share the Sheet with these accounts as editors. For future live reassignment, preserve history; Tasks changes apply to future cycles.
6. Keep **DryRun = TRUE** while testing. Alerts are recorded without sending email. Follow DEMO.md.
7. Install automation triggers in the dry-run test copy as well, so checkbox edits are processed. Run **Allo Operations → Run health check**, resolve FAIL entries and complete the hosted acceptance steps. Use a fresh copy for live operation, update addresses, set **DryRun = FALSE**, and install triggers. Only the intended owner should install them. Reinstalling replaces that account's existing project triggers.

The local project is complete. A live Google Sheet, Google authorization and actual email delivery have not been performed from this workspace. No email has been sent to the assignment's submission address.

## Employee workflow

Create a personal **filter view** on Workboard for your EmployeeEmail and statuses Due today/Overdue. Filter views do not affect other employees. All shared spreadsheet data remains visible to editors.

Portal tasks: enter a Ticket ID in **Proof (H)**, then check **Complete (I)**. Daily tasks: post the WhatsApp update, optionally paste an evidence URL or note into Proof, then check Complete. This is employee self-attestation, not independent WhatsApp verification. Ticket presence is validated; external portal validity is not verified.

The script captures the authenticated editor and completion time, closes the current cycle, protects its proof and creates the next cycle. Employees never calculate dates or update a second sheet. The event must expose the editor's email; use compatible Google Workspace accounts. Unavailable identity is rejected visibly in Error, never attributed to the trigger owner.

Manager: enter an actionable **ManagerNote (Q)** and check **Acknowledge (N)**. Manager identity and note are required. Review does not complete the underlying task.

## Recurrence and SLA

- Timezone is Asia/Kolkata; sample cutoff is **17:00**.
- 7/15/30-day cycles are completion-anchored: actual completion date plus interval, at DueHour. Late completion shifts the next deadline. Unresolved tasks retain one open cycle rather than accumulating duplicates.
- Daily cycles recur on the next Monday–Friday working day. Weekends are skipped; holidays are not modeled. Friday work that remains unresolved stays open over the weekend.
- Automation polls every five minutes. Manager receives one alert at/after cutoff, normally around 17:00–17:05. Google trigger scheduling is best effort, not an exact-time guarantee.
- Leadership receives one alert after **4 elapsed hours without acknowledgement**, or **24 elapsed hours with work still unresolved**. Nights/weekends count. These configurable windows provide same-evening management visibility and a full day for resolution.
- Completed work still escalates if the required manager review is missing. Completion plus acknowledgement suppresses escalation.
- One manager and one leadership alert per cycle; no repeated daily reminders. Locks serialize automation. Cycle IDs and email stage keys prevent repeated jobs duplicating work.

## Sheet structure

| Sheet | Purpose |
| --- | --- |
| Tasks | Definitions, assignee, recurrence, proof type, start date, cutoff and active flag |
| Workboard | Single employee input location, pending tasks and retained completion/review history |
| Manager | QUERY view of all currently due/overdue tasks and alert/review timestamps |
| Settings | Recipients, acknowledgement/resolution SLA and dry-run toggle |
| EmailLog | Durable delivery reservations, recipients, stages, send status and errors |
| Health | Owner-run configuration, trigger, quota, protection, reservation and heartbeat diagnostics |

System fields and configuration sheets are protected. Employee proof/Complete inputs are limited to the assignee; acknowledgement/note inputs to the manager. The spreadsheet owner is always trusted and can override protections. Completed proof and acknowledged review inputs lock to the owner. Run setup again after changing account addresses. Task configuration changes affect future cycles; existing cycles preserve their assignment and due date.

This is a cooperative internal prototype: collaborators who can edit the bound Apps Script must also be trusted. Range protections are operational safeguards, not an adversarial security boundary.

Keep TaskID unique and stable. Supported intervals: 1, 7, 15, 30; proof types: DAILY or TICKET; DueHour: integer 0–23. StartDate: YYYY-MM-DD. To adjust an initial sample cycle, change Tasks, delete its sample Workboard row as owner, then run automation. Deactivating a task stops future cycles; existing open cycles still require resolution. Recipients each accept one email address.

## Email failure recovery

The script reserves the cycle/stage key before calling MailApp. SENT or DRY_RUN entries advance alert timestamps. SENDING or REVIEW_REQUIRED entries are held for manual review, preventing automatic duplicate sends after ambiguous interruption. Sheets and MailApp do not provide transactional exactly-once delivery.

Inspect Apps Script execution logs and sender mail. If delivery is confirmed, set the EmailLog status to SENT and supply SentAt; the next run reconciles the cycle. If confirmed unsent, the owner can delete that ledger row to retry. Do not blindly delete ambiguous rows. Dry-run entries count as alerts for demonstration; use a fresh copy before live mode because those stages will not be resent.

## Verification

Node.js 18+, no installation of dependencies required:

```powershell
npm run check
npm test
npm run verify
```

Tests exercise the actual Apps Script rules/workflows using in-memory persistence and service adapters. Hosted identity, protections and real mail require the manual checks in DEMO.md. Open demo.html for a simulated offline walkthrough using the same scheduling rules.

## Reviewer package and preview

Start with `submission/START_HERE.md`. The verified release archive is `release/Allo_AI_Operations_Manager_v1.1.0.zip`; it includes a workbook template, solution report, Apps Script bundle, source, offline demo, evidence and handover documents. `CHECKPOINTS.md` distinguishes completed local work from live-account verification.

Double-click `Open-Preview.cmd`, open `demo.html`, or run `npm start` and visit http://127.0.0.1:8765/demo.html. Preview changes rebuild with `npm run build`; its rules come from Engine.gs. Demo state is stored locally in the browser and can be reset/exported.

To regenerate document artifacts and the archive:

```powershell
python -m pip install --target .build-deps -r requirements-build.txt
npm run package
```

No message is sent by building, verifying, packaging or using the offline demo.

Google references: [installable triggers](https://developers.google.com/apps-script/guides/triggers/installable), [event user availability](https://developers.google.com/apps-script/guides/triggers/events), [identity restrictions](https://developers.google.com/apps-script/reference/base/session).
