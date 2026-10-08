# Demonstration checklist

Use a fresh test Sheet, DryRun TRUE and real Workspace test accounts. Actual employee/manager accounts must perform their edits; owner overrides are only for accelerating test clocks.

| Test | Action | Expected result |
| --- | --- | --- |
| 1 Recurrence | Complete a due portal task with a Ticket ID | Completed cycle records editor/time; one future cycle appears 7/15/30 days after completion |
| 2 Single update | Complete from an employee's Workboard filter view | No duplicate entry elsewhere; manager view refreshes |
| 3 Daily | Post WhatsApp update, optionally add proof, check Complete | Accepted without ticket; next cycle is next weekday |
| 4 Same-day alert | Owner sets a sample open cycle DueAt earlier today; run automation | One MANAGER EmailLog entry and ManagerAlertAt |
| 5 Manager review | Manager adds note and checks Acknowledge | Manager identity/time recorded; work remains pending |
| 6 Leadership | For another cycle owner sets ManagerAlertAt five hours ago; no acknowledgement; run | One LEADERSHIP alert |
| 7 SLA | Acknowledge another cycle, set ManagerAlertAt 25 hours ago, leave incomplete | Escalates unresolved work; completion plus review suppresses escalation |
| 8 Deduplication | Run automation three times and repeat completed-row edits | Stable cycle count, completion metadata and unique stage keys |

Use separate tasks/cycles for each alert test because each stage sends once. Complete a Friday daily task to demonstrate next-Monday recurrence.

Before live operation, verify:

- Employees cannot edit other employees' proof/checkboxes or generated metadata.
- Employees cannot acknowledge as manager; missing editor identity and missing ticket reject completion visibly.
- Completed evidence and acknowledged review inputs are locked.
- Independent filter views work for concurrent users.
- In a separate live-mail test copy, use recipients you control and DryRun FALSE. Verify actual manager and leadership receipt and SENT ledger status.
- The five-minute trigger runs under the intended owner; review execution failures and email quotas in Google Apps Script.

Local tests use service adapters; they do not claim Google integration or real email delivery.
