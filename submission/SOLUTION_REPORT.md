# Allo recurring operations solution

## Recommendation

Pilot one Google Sheets Workboard with the four assignment roles. Employees record completion once, the manager owns recovery of overdue work, and leadership receives exceptions that exceed the agreed review or resolution window. This prototype demonstrates the required workflow without a paid AI service or a second employee update channel.

Measure manual follow-up effort and deadline performance during the pilot before claiming business improvement.

## Employee workflow and recurrence

Tasks defines the employee, recurrence, proof type, start date and cutoff. Workboard is the employee's operating location: a personal filter view shows due and overdue work, the employee enters a Ticket ID in Proof where required, then checks Complete. The script records the authenticated event editor and time, closes that cycle, retains its evidence and prepares one next cycle.

Daily work uses an employee confirmation checkbox after the operational action, with an optional evidence link or note. It is attestation, not independent WhatsApp verification. Portal IDs are checked for presence and proof length; they are not verified against an unspecified portal.

Each task chooses completion-based or fixed recurrence and a calendar-day or working-day policy. Completion-based work advances 7, 15 or 30 calendar days after completion. Fixed work retains its StartDate anchor and prepares the first future eligible deadline after completion, recording distinct elapsed schedule dates skipped without inventing completions. WORKING rolls the resulting deadline past configured nonworking days and holidays; intervals still count calendar days. One unresolved cycle remains open. Generated-cycle metrics are not a full missed-day ledger.

## Manager action and escalation

At or after cutoff, normally 17:00 IST, a five-minute best-effort poll creates one manager alert. The manager adds an initial action note and acknowledges the issue. Blocker, recovery owner, target completion time, next action and resolution note are separate editable inputs. SaveRecovery validates the plan and appends a changed version to protected RecoveryLog with manager identity and time. Unchanged retries create no duplicate versions; resolution notes require actual employee completion.

Leadership receives one alert after four elapsed hours without acknowledgement, even if work was later completed, or after 24 elapsed hours if work remains unresolved despite review. Completion plus acknowledgement suppresses further stage alerts. Nights and weekends count. A 17:00 manager alert implies a 21:00 review deadline; the business must approve evening cover or change the settings.

Initial acknowledgement notes lock, while recovery inputs remain editable afterward with retained version history. Configured backup email and inclusive leave dates route new alerts to the substitute; new routing returns to the primary after leave. The primary and original alerted reviewer can finish existing incidents. Leadership acknowledgement is not separately automated. One email per stage limits noise; persistent exceptions require continued follow-up.

## Reliability and control

Stable task/date cycle IDs and cycle/stage mail keys prevent repeated automation creating duplicate work or stage alerts. ScriptLock serializes edit handlers and timer runs. Human typing is not covered by that lock; saves update generated fields without overwriting the human input columns.

EmailLog reserves the stage key before MailApp is called. A successful send call is recorded as SENT. SENDING or REVIEW_REQUIRED entries block automatic retries after an uncertain outcome. The owner checks delivery evidence before marking a confirmed send or retrying a confirmed unsent entry. Exactly-once inbox delivery across Sheets and MailApp is not guaranteed.

System fields and configuration are protected; per-cycle inputs are restricted to the assignee and manager. Completed proof locks. Missing editor identity rejects completion rather than substituting the trigger owner. Shared-sheet data remains visible to editors, and owners and bound-script collaborators must be trusted. Separate-user access remains an acceptance gate.

Health checks configuration, triggers, mail quota, reservations, uniqueness, protections and heartbeat. The updated heartbeat rejects missing, invalid, stale and implausibly future timestamps, with one minute of clock tolerance. Health is an owner-run diagnostic, not an independent outage notification service.

## Demonstration evidence

| Assignment test | Demonstration and evidence |
| --- | --- |
| 1 Recurrence | Complete each 7/15/30-day portal fixture; assert one correctly dated next cycle. |
| 2 Single update | Enter proof and Complete in the same row; inspect retained identity and time. |
| 3 Daily work | Confirm without a ticket; demonstrate Friday-to-Monday rollover. |
| 4 Manager email | No alert before cutoff; manager stage created at cutoff in the adapter. |
| 5 Manager review | Note and acknowledgement record manager action without resolving employee work. |
| 6 Leadership | Missing review creates leadership stage at four elapsed hours. |
| 7 Timing | Reviewed unresolved work escalates at 24 hours; reviewed completed work suppresses it. |
| 8 Deduplication | Repeated jobs preserve cycle counts and unique stage keys; completion metadata is retained. |

Run npm run verify to reproduce local checks. TEST_RESULTS.tap and DEMO_RESULTS.json record actual adapter observations. The adapter simulates Sheets, accounts, time, mail, protections and locks; it does not calculate spreadsheet formulas or prove live scheduling, permissions or inbox receipt.

The 8 October hosted record contains user-confirmed workflow and receipts using one account and accelerated timing. It is historical reported evidence, not acceptance of release 2.1.0. The upgrade has local regression evidence for recovery versions, cover routing, calendar/fixed scheduling and weekly denominators. Updated deployment, separate accounts, actual Google calculations, receipts and evaluator access remain pending. No browser provider was available for frontend visual review; frontend behavior was tested in a DOM harness.

## Pilot and handover

Before live use, agree recurrence and SLA coverage, verify named accounts, run the eight demonstrations, and execute the known Google formula fixture and empty-data check in a disposable copy. Keep evaluator access Restricted and invite the confirmed evaluator account; never make the Sheet publicly editable.

The generated Weekly report measures on-time completion for cycles due in the window, review compliance for deadlines that matured in the window, and prior-week overdue carryover and age. Unresolved due work stays in denominators; zero denominators are N/A. Latest saved blocker and next-action snapshots explain repeated exceptions. The window is Monday 00:00 IST to the earlier of next Monday or report time, current snapshots include the cutoff instant; completed weeks exclude next Monday. No weekly email or AI summary is sent.

The companion frontend includes six views, recovery controls and Gaurang, a read-only record-based chatbot with sources and timestamps. Website chat uses demo records. The separately installed Google Sheets sidebar reads live records for authorized managers. Paid leave adds a 50-day annual entitlement per unique email, employee requests, manager approval and auditable decisions. Full working days exclude configured holidays; no carryover or half-days. Approved future leave reserves balance. No external AI service or general-knowledge answering is included. Source and workbook require Apps Script deployment; updated live and visual acceptance remain pending. No WhatsApp integration is included.
