# Managing Allo recurring operations

Release 2.1.0. Pilot with the four assignment roles. Employees enter evidence once; the manager owns recovery, leadership decides exceptions outside manager authority, and the automation owner maintains the system. These are proposed operating practices, not measured business outcomes or approved company policies.

## Responsibilities and actions

| Role | Responsibility | Action |
| --- | --- | --- |
| Employee | Honest completion and sufficient proof | Complete work, enter ticket proof where required, check Complete in the same row |
| Manager | Recover exceptions and review evidence | Write an initial Q note and acknowledge N; enter blocker, recovery owner, target time and next action in T:W; check SaveRecovery Y |
| Backup | Approved cover during inclusive leave dates | Review new routed alerts and maintain recovery versions; coordinate handover with primary |
| Leadership | Resolve resource and priority conflicts | Give the manager a named decision owner and next decision time; leadership acknowledgement remains manual |
| Automation owner | Maintain triggers, protections, quotas and delivery recovery | Review Health and ambiguous EmailLog reservations; apply tested releases with a backup |

## Recovery discipline

Keep the initial acknowledgement note concise: what was reviewed and the immediate decision. It locks after acknowledgement. Structured recovery inputs remain editable afterward. SaveRecovery records a complete snapshot in protected RecoveryLog with version, editor, time and changed fields. A repeated unchanged save creates no new version. Draft inputs are not committed history until saved.

Example plan: blocker Portal outage; owner Employee B; target 17 October 11:00 IST; action Retry through approved alternate route. If the target is missed, revise the action and save another version rather than overwriting the earlier entry. A resolution note can be saved only after employee completion; it never completes the task for the employee.

Weekly blocker analysis reads the latest saved recovery version at the report cutoff. The Manager recovery query shows editable draft values and their last saved version number. The owner is trusted and can override protections; RecoveryLog is operational history rather than a tamper-proof external audit ledger.

## Assumptions that need business agreement

| Current behavior | Consequence | Decision to confirm |
| --- | --- | --- |
| Each task chooses COMPLETION or FIXED | Completion mode shifts after late work; fixed mode retains the StartDate schedule and records elapsed distinct dates skipped | Select the right policy for each operational obligation |
| One unresolved cycle remains open | Avoids duplicate work but is not a complete missed-daily-occurrence ledger | Decide whether a full occurrence ledger is required |
| Intervals count calendar days; WORKING rolls the result past configured nonworking days and holidays | A 7-day interval is not seven business days | Approve WorkingDays, HolidayDates and each task CalendarPolicy |
| Leave start/end dates are inclusive in Asia/Kolkata | New manager alerts go to backup during leave and automatically return after it | Approve substitute account, dates and authority |
| Primary and originally alerted reviewer retain incident access | Existing incidents do not lose their reviewer at midnight on return | Agree handover; owner explicitly removes obsolete incident access if required |
| Four-hour review and 24-hour resolution use elapsed hours | Evenings, weekends and holidays count; 17:00 can imply review by 21:00 | Name available cover or change the windows |
| Daily evidence is attestation and ticket proof is presence-checked | External completion is not independently verified | Define sufficient evidence and manager sampling |
| Shared Sheet data is visible to editors and script collaborators are trusted | Range protections do not provide confidential or adversarial access isolation | Approve this model or require a controlled backend |
| Missing edit identity rejects the update | Some account contexts cannot complete the workflow | Verify actual employee and manager accounts |
| Ambiguous sends need owner review and Health has no independent outage notifier | Recovery can require manual intervention | Assign daily operational and infrastructure checks |

## Useful weekly measures

1. On-time completion: generated cycles due inside the reporting window completed at or before DueAt, divided by all generated cycles due in that window, including unresolved work.
2. Review compliance: manager alerts whose acknowledgement deadline matured in the window and were acknowledged by that deadline, divided by all alerts whose acknowledgement deadline matured in the window.
3. Overdue carryover and age: tasks due before the week that remain unresolved at cutoff, plus age buckets for all unresolved overdue work. Inspect repeated blocker counts and latest saved next actions alongside these numbers.

Window: Monday 00:00 IST to the earlier of next Monday or report time, current snapshots include the cutoff instant; completed weeks exclude next Monday. Zero denominators are N/A. Current-week results are partial. Retained dry-run/sample data is included, so use a clean accepted copy for operational reporting. Skipped-date counts are associated with newly generated cycles due in the window and are not an independent missed-occurrence ledger. Do not invent savings targets: establish a baseline for manual follow-up time before claiming improvement.

Weekly review compliance uses the currently configured AckHours. Historical per-alert SLA settings are not snapshotted, so changing AckHours can change historical results. Keep the approved setting stable during the pilot and record any policy change before comparing weeks.

## Daily routine and exception decisions

Start with overdue work, missed recovery targets and unreviewed alerts. Confirm each recovery owner and next action, save any changed plan, and follow the target time. Review completed evidence before marking an incident resolved. At four hours without review or 24 hours unresolved, leadership receives one escalation. Continue active follow-up after that email; the system does not send repeated daily reminders.

For SENDING or REVIEW_REQUIRED, the automation owner examines execution and mail evidence. Confirm delivery before marking SENT with SentAt; retry only a confirmed unsent attempt. An ambiguous send is never blindly deleted. If the heartbeat is invalid or older than 15 minutes, manager checks work manually while the owner restores automation and reconciles catch-up alerts.

## Pilot and release controls

Back up the current Sheet/script. Verify migration, distinct users, real formulas, recovery versions, cover routing, calendar boundaries, reporting denominators and actual receipts in separate acceptance copies. See V2_ACCEPTANCE.md and DEMONSTRATION_PROTOCOL.md. Keep sharing Restricted and confirm the evaluator account; do not make the Sheet publicly editable.

After acceptance run a small pilot, record employee friction and follow-up effort, and review repeated blockers with leadership. Expand based on observed need. No WhatsApp integration, messaging access, AI email summaries or automatic weekly email is part of this release. If a release fails, pause its triggers, restore the prior tested script and reconcile Workboard, RecoveryLog and EmailLog before resuming; manager maintains manual exception follow-up during interruption.

Local tests pass, but the updated release has not been observed in Google. Earlier user-reported one-account results are historical evidence. Browser visual review is also pending because no provider was available. Do not present these pending checks as completed.
