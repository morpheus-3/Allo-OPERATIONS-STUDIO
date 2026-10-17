# Release 2 operating upgrade acceptance

Live results below are pending. Browser inventory was empty, and the in-app browser reported unavailable during this upgrade. Complete these checks in a backed-up dry-run copy before upgrading a live Sheet. No connected browser or authenticated Google Sheets session was used to run them here.

| Check | Exact actions | Expected result | Observed locally | Live result |
| --- | --- | --- | --- | --- |
| Migration | Copy a supported old Sheet, retain cycles, install v2 source and run setup | First 19 Workboard columns stay in place; T:AD appended; Tasks J:K appended; new protected RecoveryLog and Weekly | Prefix migration and unknown-header rejection tested | Pending |
| Recovery after review | Alert a cycle; manager adds Q note and acknowledges N; enter T blocker U owner V target W next action; check Y | RecoveryLog revision 1 records authenticated manager and time; employee task stays open | Adapter test and UPGRADE_RESULTS.json | Pending |
| Recovery history | Change W after acknowledgement and check Y; check Y again unchanged | Revision 2 retains earlier snapshot; unchanged save creates no revision 3 | Adapter and frontend harness tests | Pending |
| Resolution | Enter X resolution before completion and check Y; then employee completes H:I and manager saves X again | First save rejected; second accepted with employee completion metadata retained | Adapter test | Pending |
| Permission separation | Employee attempts T:Y and RecoveryLog edits; manager attempts protected generated fields | Denied for employee; generated fields owner-only; manager can update recovery after acknowledgement | Local protected-range adapter only | Pending |
| Backup routing | Configure real BackupManagerEmail and inclusive leave dates containing today; generate a new due cycle and run timer | New MANAGER entry recipient is backup; backup can acknowledge and save history | Adapter routing and edit test | Pending |
| Return from leave | In a disposable date-controlled case end leave yesterday; alert another cycle | New alert goes to primary; primary and originally alerted reviewer retain existing incident continuity | Pure activeManager date checks; retention implemented | Pending |
| Calendar | WorkingDays 1,2,3,4,5; HolidayDates 2026-10-12; complete a daily cycle Friday 9 Oct using identified test timestamps | Next eligible deadline Tuesday 13 Oct; a CALENDAR portal task is not rolled by holidays | Pure rules tests and observed holiday result | Pending |
| Fixed policy | Set task StartDate 1 Oct, interval 7, FIXED; cycle due 8 Oct completed 23 Oct 18:00 | Next due 29 Oct; two distinct elapsed dates skipped, no fabricated completion records | Pure rules and UPGRADE_RESULTS.json | Pending |
| Weekly report | Use known records: prior-week open cycle, one on-time, one late, one current open, one future; report 8 Oct 22:00, AckHours 4 | Due denominator 3, on-time numerator 1; mature-review denominator 2, compliant numerator 1; carryover 1, overdue 2 | Independent asserted fixture in management.test.cjs | Pending |
| Empty week | Clear only fixture rows in a disposable copy, refresh Weekly | N/A for both rates; carryover and overdue zero | Pure rules test | Pending |
| Repeated blocker | Save same blocker label for two overdue cycles, different next actions | One blocker with count 2 and both latest actions; old superseded actions excluded | Weekly fixture assertion | Pending |
| Concurrency | Trigger save and timer concurrently; repeat identical recovery save and completion | Unique cycle/stage/recovery keys and original history retained | Sequential adapter idempotency only | Pending |
| Frontend visual | Open demo.html at desktop, tablet and mobile widths; exercise six views and drawer keyboard | No overflow beyond scrollable tables, usable navigation, visible focus and dismissible drawer | Static CSS/accessibility and DOM harness only | Pending |

For each live check retain account role, CycleID, expected and actual value, timestamp, screenshot and execution ID. Update evidence status only after observation. Do not send live emails to company staff while testing; use named recipients you control in a separate live-mail acceptance copy. The weekly report is generated in Sheets and exportable from the simulation; no weekly email or AI summary is sent.

## Browser demonstration

Open Scenario controls and load Operating week. Review overdue carryover and the saved supplier blocker in Overview and Weekly. In Manager review, acknowledge a task, open recovery, save a plan, reopen it and update the next action to show the retained versions. Employee completion remains on Workboard. Load Backup coverage and inspect the recorded recipient. Calendar & coverage lets you change the simulation's settings and future recurrence policies. All scenario data is synthetic and local; these controls do not update the live Sheet.

## Production decisions

Approve recurrence and calendar choices per task, backup account and cover window, after-hours SLA availability, recovery owner authority, shared-sheet visibility and incident closure practice. The spreadsheet owner remains trusted; bound-script access is not an adversarial security boundary. Removing a backup from existing incidents requires an explicit owner-reviewed handover rather than silently changing the original alert recipient.
