# Allo Operations Studio

Release 2.1.0. A Google Sheets operating system for recurring work, manager review, recovery ownership and leadership escalation, with a redesigned offline companion frontend.

**Local verification: 63 tests and all eight assignment scenarios pass. Live acceptance of this release remains pending.** The existing 8 October hosted record is user-reported, used one account across roles, and accelerated escalation timing. No browser or Google Sheets session was connected for this upgrade.

Working Sheet: https://docs.google.com/spreadsheets/d/1aLoeuykOMAq-sWQ7JCzsnpEkuSQle93c6mgVHKYYsn4/edit

Repository: https://github.com/morpheus-3/Allo-OPERATIONS-STUDIO (the local upgrade has not been pushed during this work).

## Reviewer route

Read submission/SOLUTION_REPORT.pdf and submission/START_HERE.md. Open demo.html or run npm start and visit http://127.0.0.1:8765/demo.html. Use Scenario controls to load the synthetic Operating week, manager alert, missing-review or backup-coverage example. Loading a scenario resets the current local demonstration.

The frontend is explicitly a local simulation. It does not read or write the linked Google Sheet and sends no emails. It shares calendar, recurrence, escalation and weekly reporting rules with the Apps Script implementation. No WhatsApp integration or AI email summaries are included.

## What changed

- Structured recovery: blocker, recovery owner, target date/time, next action and resolution note. Managers can update after acknowledgement; each changed save appends a version to protected RecoveryLog. Unchanged retries preserve the existing version. Resolution notes require employee completion and never complete work on the manager's behalf.
- Backup manager: approved email and inclusive leave dates in Settings route new manager alerts to the substitute. After leave, new alerts return to the primary. The primary and the original alerted reviewer can finish existing incidents. Leadership routing and SLA clocks are unchanged.
- Business calendar: WorkingDays uses weekday numbers (Sunday 0 to Saturday 6); HolidayDates contains comma-separated real YYYY-MM-DD dates. Intervals are calendar-day intervals; WORKING moves the resulting deadline to the next allowed working day, rather than counting business days.
- Recurrence: each task chooses COMPLETION or FIXED, and CALENDAR or WORKING. Fixed scheduling retains the task StartDate anchor and prepares the first future eligible due date after completion. Elapsed distinct scheduled due dates skipped are recorded on the new cycle, without fabricated completions. One unresolved cycle stays open.
- Weekly: Monday 00:00 IST to the earlier of next Monday or report time, including the current instant; completed weeks exclude next Monday. Reports show on-time generated cycles, mature review compliance, prior-week overdue carryover, age buckets and latest saved blocker/action by overdue cycle. Empty denominators are N/A. Retained test data is included unless removed through a documented fresh-copy workflow.
- Frontend: six responsive views, task search/status filters, recovery drawer with history, coverage/calendar controls, weekly chart and CSV export, retained activity and guided sample scenarios. Browser visual QA could not be executed because no browser provider is available; DOM/harness tests cover behavior and static accessibility structure.

## Google Sheets setup and migration

1. Use a fresh dry-run copy for acceptance. Back up any existing Sheet and bound script before upgrading. Do not test migration against the sole live history copy.
2. In Extensions > Apps Script, install Engine.gs, Code.gs, Diagnostics.gs, Assistant.gs and Leave.gs, or install submission/Allo_Operations_AppsScript.gs as one bundle. Never install both forms. Apply src/appsscript.json. For the live Gaurang sidebar, also create an HTML file named Gaurang from src/Gaurang.html.
3. Run setup as the existing configured owner. It recognizes supported old header prefixes and appends new fields without moving H:I or N/Q. Workboard expands to 30 columns, Tasks to 11. Unknown headers are rejected. RecoveryLog and Weekly are created.
4. Configure real assignees and recipients with DryRun TRUE. For a new sample installation only, replace the sample Workboard rows after changing addresses, then rerun setup. Preserve real history when upgrading.
5. Share Restricted with named participants, install the intended owner's timer/edit triggers, and run Health. Do not substitute owner identity when the edit event lacks employee identity.
6. Use submission/DEMONSTRATION_PROTOCOL.md and V2_ACCEPTANCE.md. Verify actual identities, permissions, calculated queries, weekly output, receipts and routing before enabling live mode in a clean accepted copy.

## Operating columns

| Location | Employee or manager action |
| --- | --- |
| Workboard H:I | Proof and Complete; authenticated employee only |
| Workboard N and Q | Manager acknowledgement and initial action note; lock after review |
| Workboard T:X | Editable recovery draft: blocker, owner, target, next action, resolution |
| Workboard Y | SaveRecovery checkbox validates and appends a changed version |
| Workboard Z:AD | Generated reviewer, revision, recurrence policy and skipped-date metadata |
| RecoveryLog | Protected saved snapshots, editor, time, revision and changed fields |
| Manager | Due work, missing reviews, scorecard and recovery draft/version view |
| Weekly | Owner-generated report refreshed by automation or menu; no weekly email is sent |

Recovery input drafts may differ from the latest saved version until Y is checked. Weekly blocker reporting reads protected saved history, not uncommitted drafts. The owner and trusted script collaborators can override these controls; shared-sheet visibility is not confidential per-employee access.

## SLA and delivery recovery

Sample cutoff is 17:00 IST, checked by a five-minute best-effort timer. Leadership is alerted four elapsed hours after manager alert without review, or 24 elapsed hours with work still unresolved. Nights, weekends and holidays count in SLAs even when task scheduling uses the business calendar. The business must approve cover for a potential 21:00 review deadline.

ScriptLock serializes edit handlers and automation; it does not lock human typing. Stable cycle IDs and cycle/stage keys prevent repeated jobs duplicating work or alerts. EmailLog reserves before send. SENT indicates the send call returned, not guaranteed inbox delivery. SENDING/REVIEW_REQUIRED require owner investigation. Confirm delivery before marking SENT with SentAt; retry only after confirming an attempt was unsent. Exactly-once inbox delivery is not claimed.

## Local verification and artifacts

Run npm run verify with Node 18 or later. Runtime tests need no npm dependencies. Evidence includes TEST_RESULTS.tap, DEMO_RESULTS.json, UPGRADE_RESULTS.json and current source hashes. Adapter locks, protections and mail are simulated; formulas are stored as strings, not evaluated. Frontend tests run against a DOM harness, not a real browser.

Final evaluator package: release/Allo_AI_Operations_Manager_v2.1.0.zip. The solution report is PDF; the workbook does not embed Apps Script. Candidate-only interview preparation and the unsent submission email are excluded from that archive. Obsolete releases and temporary files have been moved to the Windows Recycle Bin; evidence/CLEANUP.json records the recoverable cleanup.

Artifact generation uses the bundled Python reportlab and artifact-tool dependencies. The workbook builder resolves artifact-tool from the bundled runtime directly. Run python scripts/package_release.py --prepare, render and inspect PDFs and workbook sheets, record artifact hashes in evidence/ARTIFACT_QA.json, then run npm run package. Package finalization refuses stale QA and source hashes and verifies each archived file by SHA-256 and CRC. On another machine provide the listed Python dependencies and artifact-tool via ALLO_ARTIFACT_MODULES (the absolute node_modules directory). Reviewing and testing the system does not require artifact build dependencies.

The user must complete live acceptance and confirm Restricted evaluator access. This release has not been pushed or emailed during this work.

## Ask Gaurang

Use the bottom-right **Ask Gaurang** button in the preview. It answers from current local demo records, independent of the visible team filter. Live mode is a manager-only Google Sheets sidebar: install src/Gaurang.html and use Allo Operations ? Ask Gaurang. See submission/GAURANG_GUIDE.md. It uses deterministic record lookups, not a general-purpose language model. No API key or external data transfer is required. Employee leave balances are read from the paid-leave ledger when available.

## Paid leave

Open **Paid leave** in the website or **Paid leave requests and balances** from the Sheet menu. Install src/Leave.html as an HTML file named Leave. The default entitlement is 50 full working days per unique employee email per calendar year. Approval reserves balance; pending requests do not. Holidays and weekends follow Settings. No carryover or half-days; self-approval is blocked. See submission/LEAVE_GUIDE.md. Website roles are demo controls; Google access uses server-verified caller identity.
