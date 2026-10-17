# Paid leave — release 2.1.0

Settings.AnnualPaidLeaveDays defaults to 50. Entitlement belongs to each unique employee email, not each Task or employee label. Multiple roles using the same Gmail share one balance. The policy covers calendar years, full configured working days and configured holidays. No carryover, prorating, half-days or automatic task delegation is implemented. Split cross-year requests. The calendar-day interval used for tasks is separate from working-day leave counting.

Employees submit their own requests from the **Paid leave** website page or the **Paid leave requests and balances** Google Sheets menu. In Apps Script, install Leave.gs with the other four .gs files or use the combined bundle. Add an HTML file named Leave from src/Leave.html. Rerun setup as the owner to create protected LeaveRequests and LeaveLog sheets and the entitlement setting. The workbook template has thirteen sheets.

The Sheets endpoint verifies Session.getActiveUser; a client-supplied email is never trusted. Primary managers and active approved backups can approve or reject requests. Self-review is blocked. Employees can withdraw pending requests with a note. Managers can cancel approved future leave with a note; cancellation is blocked once its start date is reached. No leave action sends email.

Pending requests do not reserve balance. Approval rechecks the remaining entitlement while holding the script lock, so two pending requests cannot both spend the same remaining days. Approved leave, including future leave, reserves balance for its request year. Cancelled/rejected requests do not consume balance. Requests snapshot their working-day count; later calendar changes do not rewrite it.

Request IDs deduplicate retries. Decisions are journaled in protected LeaveLog before the request row is updated. API reads apply that decision ledger, so an interrupted row write cannot release an already-approved reservation. Retrying reconciles the display row without adding another decision. Both sheets are owner-managed; direct owner edits and script collaborators remain trusted. As elsewhere in this shared workbook, Sheet editors can see ledger contents. Do not store sensitive leave reasons; use brief operational decision notes.

Website mode uses local demonstration records and explicit demo identity selection, which is not authentication. It is separate from the live Google Sheets ledger. Gaurang can report balances from the relevant available ledger. The all-employee view is available only to managers in the live sidebar; employees receive only their own records from the endpoint.

## Live acceptance still required

Use a disposable Sheet copy and distinct Google identities. Verify own-account submission, employee denial of approval, backup expiry, self-review denial, annual balance limits, overlap rejection, holiday counting, cancellation, retry deduplication and the decision journal. Compare sidebar balances with the ledger. Local tests simulate services and do not establish Google permissions or browser usability.

## Owner-processed live queue

Live sidebar mutations enqueue a signed command in LeaveQueue, the only leave-related sheet writable by enrolled employees and configured managers. The owner-run five-minute automation verifies the signature and rechecks identity, current cover authority and balance before writing protected LeaveRequests/LeaveLog. Caller roles cannot directly edit those protected ledgers through the sidebar. Refresh after processing; queued does not mean approved. Invalid signatures are ignored. Processing errors are retained as receipts. The queue is a shared staging surface: editors can disrupt pending commands by editing/deleting queue cells, but cannot create a valid new signed command through those cells. Bound-script collaborators and the owner remain trusted and can access script properties. This is not isolation against a malicious script editor.
