# Reproducible demonstrations for release 2.0.0

## Local reproduction and observed results

Run `npm run verify` from the project root with Node 18 or later. It rebuilds the demo, checks source syntax, executes tests and runs scripts/demo-report.cjs against the Google-service adapter. The adapter starts at 8 October 2026 16:00 IST, creates four sample tasks and configures simulated accounts. All actions below run in isolated fixtures. `evidence/DEMO_RESULTS.json` contains actual observed values; `evidence/TEST_RESULTS.tap` contains assertions. Simulated mail is not a real received email.

| Test | Exact local actions in demo-report.cjs | Expected | Actual locally observed | Live result |
| --- | --- | --- | --- | --- |
| 1 Recurrence | For Workboard rows 3 4 5 enter TICKET-7 TICKET-15 TICKET-30 in H; edit I true as their assignees | Close each cycle and create one next due date | 15 Oct, 23 Oct, 7 Nov 2026 respectively, 17:00 IST; see result 1 | Pending for 2.0.0 |
| 2 One location | In row 3 enter PORTAL-DEMO-100 in H, then I true as employeeb@allo.test | Proof editor time and Completed in same row | Result 2 records Workboard H:I, proof, editor and timestamp | Pending |
| 3 Daily | Set fixture clock to 9 Oct 16:00 IST; row 2 I true as employeea@allo.test | No ticket required; next weekday due | Completion accepted; next due Monday 12 Oct 17:00 IST; result 3 | Pending |
| 4 Manager alert | Run at 16:00; advance clock to 17:00; run again | No alert early; one manager entry per overdue cycle | DRY_RUN manager entry at cutoff; actualEmailSent false; result 4 | Historical receipt user-reported; new release pending |
| 5 Review | After alert enter recovery note in Q3; N3 true as manager; inspect K3; then employee completes | Acknowledgement does not complete task | K3 remains blank until employee completion; result 5 retains both identities | Pending |
| 6 Missing review | Alert at 17:00; leave unacknowledged; run at 21:00 | Leadership stage at four hours | LeadershipAlertAt at 21:00 IST; result 6 | Historical accelerated receipt reported; new release pending |
| 7 Timing | Acknowledge at alert; run at +4h then +24h; repeat in resolved-and-reviewed fixture | No missing-review alert after review; unresolved escalates at 24h; resolved suppresses | All three conditions asserted; result 7 | Pending |
| 8 Deduplication | Alert then run automation five more times at same clock | Stable cycle and alert counts | Before and after: four cycles and four alerts; result 8. Additional completion tests preserve original metadata | Pending |

For a live execution use DEMO.md in a fresh test copy with DryRun TRUE first. Use actual assigned accounts, not the owner impersonating them. Make date changes only as the owner in an identified test copy. Record test ID, CycleID, account role, expected result, actual result, local time, screenshot location and execution ID. Never fill an unexecuted result with PASS.

## Actual Google formula acceptance

Use `scripts/google-sheets-acceptance.gs` only in a disposable copy named `ALLO ACCEPTANCE ...`. Configure real participant addresses, run setup there, and remove that copy's timer and edit triggers before the data-only formula test. Confirm book().getId() equals the active copy ID; setup establishes this binding. Do not run the helper in the live prototype.

The helper calls setup to install the actual formulas, replaces test-copy Workboard data with known rows, writes a fixed acceptance clock in Acceptance, and evaluates copies of the actual Manager formulas against that clock. Original Manager P3:P9 retain NOW(). It asserts timezone Asia/Kolkata and locale en_IN, records actual and expected results, and throws on mismatch. It sends no emails and requires DryRun TRUE. Its fixture ledger contains two deliberately simulated ambiguous reservations for the delivery-count check. Do not run automation against this fixture; discard the copy after the data test.

Run `runFormulaAcceptance` as the configured owner. Inspect Acceptance A3:D9, screenshot it and save its JSON execution output. Expected base counts are **5 overdue, 1 due later today, 2 late reviews, 2 unresolved beyond SLA, 2 ambiguous reservations, 2 completed**. Exact four-hour and 24-hour boundaries are included. Run `runEmptyFormulaAcceptance` to clear the fixture and check six zeros. A local independent data oracle verifies these populations and helper guards reject an unsafe copy, active automation triggers and live mode. This does not evaluate formulas: **actual Google results are pending**.

Then delete the fixture copy. In a separate clean acceptance copy, verify the original Manager scorecard against NOW(), check spreadsheet refresh behavior, and rerun the eight live workflow cases. Fixed-clock formulas do not prove timer scheduling or automatic recalculation frequency.

## Separate-user and mail acceptance

1. Share the clean test copy as Restricted with named test employees and manager. Each employee completes their own row; record CompletedBy. Attempt other employees' proof/checkbox and generated fields: expected access denied. Attempt manager acknowledgement as an employee: expected access denied or rejected. Manager adds note and acknowledges: record AcknowledgedBy.
2. Verify unavailable edit identity rejects completion, if that event can be reproduced. If identity is not exposed by the chosen accounts, record a failed acceptance and select suitable Workspace accounts; do not use owner identity as a fallback.
3. Use personal filter views concurrently and confirm each user's view does not change the other's. All shared data remains visible; this is not confidentiality isolation.
4. In a fresh live-mail copy with real recipients you control, set DryRun FALSE, install the intended owner's triggers and verify actual manager receipt. Accelerate only test timestamps for escalation; disclose acceleration. Verify leadership receipt and repeated-run suppression. Record received time and stage key, not only SENT status.
5. Run Health and inspect actual executions. Verify the installed trigger catches a real cutoff and check the scorecard after a real edit. Local locks are simulated; schedule concurrent edits and timer runs and compare retained cycles and stage keys.

All checks in this section remain pending for release 2.0.0. Earlier user-reported tests are retained separately in HOSTED_ACCEPTANCE.md without upgrading their evidence status.

## Evaluator access

Keep General access Restricted. Add the hiring evaluator's confirmed Google account as Viewer for review; use an isolated demonstration copy and named Editor access only when participation is agreed. Do not assume the submission email is the evaluator's Google account. Test the invited account's access or request acknowledgement. Do not change the Sheet to publicly editable. Current evaluator access has not been confirmed.
