# Assignment coverage

| Assignment requirement | Implementation | Evidence |
| --- | --- | --- |
| Daily, 7-, 15-, 30-day sample tasks | Tasks setup with Employee A–D | Setup integration test; workbook template |
| Automatic next recurring cycle | Completion-anchored calendar interval; daily weekends skipped | Engine + workflow tests; DEMO_RESULTS.json |
| Employee pending report | Workboard with personal filter views, DueAt, Status, ProofType | Setup source; manual filter-view check |
| Completion from the same location | Proof and Complete inputs on Workboard | Persistence-adapter completion test |
| Ticket task completion | Ticket presence required before closing cycle | Positive/negative completion tests |
| Daily task tracking | Completion checkbox attestation; optional evidence URL/note | Daily workflow and Friday-to-Monday tests |
| Who/when/proof captured | CompletedBy, CompletedAt, Proof retained on completed cycle | Workflow tests; locked inputs |
| Manager visibility across employees | Manager due/overdue QUERY report plus missing-review report | Setup source; formula installation test |
| Same-day manager email | Five-minute polling at/after 17:00 IST | Boundary tests; MailApp adapter; real receipt pending |
| Manager action/acknowledgement | ManagerNote plus Acknowledge; identity/time captured | Manager workflow and negative identity tests |
| Unresolved task escalation | 24 elapsed hours after manager alert | SLA boundary tests |
| Missing manager action escalation | 4 elapsed hours after manager alert, even if employee later completes | SLA tests |
| Actual SLA and rationale | README and solution report | Explicit elapsed-hour policy and weekend treatment |
| No duplicate alerts/work | Stable cycle IDs, reserved stage keys, ScriptLock | Repeated-run tests, ambiguous failure tests |
| Working Google Sheet | Installer creates configured sheets; importable XLSX template | Source/workbook delivered; live account setup pending |
| Apps Script automation | Engine.gs, Code.gs, Diagnostics.gs and manifest | Syntax checks, source bundle |
| Demonstration/test cases | All eight scenarios and guardrails | Automated tests, deterministic results, hosted checklist |

## Deliberate scope decisions

1. **Google Sheets remains the operating interface.** The browser walkthrough is a companion simulation, not a substitute for the required Sheet.
2. **Completion anchors recurrence.** Late work shifts the next due date; one unresolved cycle remains open. This avoids duplicate overdue work and is stated explicitly for the evaluator.
3. **Daily completion is attestation.** An employee confirms posting the update. Independent WhatsApp verification would require an authorized integration and is not claimed.
4. **Ticket presence is validated.** No unspecified company portal API or credentials are assumed.
5. **Acknowledgement and resolution are separate.** Leadership can be alerted about missing manager review after employee completion, as the assignment permits.
6. **At-most-once automatic send attempt per stage.** Ambiguous send outcomes require owner review. Exactly-once email delivery across two services is not claimed.
7. **Cooperative internal prototype.** Range protections prevent routine accidental edits; this shared bound-script model is not an adversarial security boundary. Spreadsheet owners and collaborators with script access must be trusted.
8. **Live verification is separate from local tests.** Account identity availability, Google scheduling, quota and actual email receipt must be demonstrated in a live account.
