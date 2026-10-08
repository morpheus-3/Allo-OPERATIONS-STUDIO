# Hosted acceptance record

Date: 8 October 2026 (IST).

Status: **Core live prototype tests confirmed by the user.** Evidence consists of pasted execution logs and Sheet rows, plus the user's confirmation of actual email receipts. The agent did not independently access the Google account or inbox.

The demonstration uses one owner-controlled account for all dummy roles. It does not prove distinct-user permission isolation.

| Check | Result | Evidence |
| --- | --- | --- |
| Google Sheet and setup | User-reported pass | Successful setup logs and populated task/cycle tables |
| Mail authorization | Pass from pasted log | Quota check returned 100 after authorization |
| Trigger installation | User-reported | installTriggers instructions followed; checkbox completion processed |
| Ticket completion and recurrence | User-reported pass | User confirmed working after proof entered in the correct row |
| Daily completion | User-reported pass | User confirmed daily test |
| Manager acknowledgement | User-reported pass | User confirmed action-note/acknowledgement test |
| Manager email receipt | User-reported pass | EMAIL-TEST-1 SENT followed by receipt confirmation |
| Leadership email receipt | User-reported pass; accelerated clock | Alert timestamp set manually to 08 Oct 2026 12:00; leadership timestamp 18:33 and receipt confirmed |
| Duplicate prevention | User-reported pass | User confirmed one MANAGER and one LEADERSHIP SENT entry after rerun |
| Separate-user permissions | Not tested live | One-account demo cannot prove isolation |
| Employee filter views | Not independently verified | Setup instructions supplied |
| Final Health check | Awaiting confirmation | Run runHealthCheck after installing the latest script |

Defects discovered during guided deployment were corrected in GitHub: checkbox-only blank records, cycles appended far below the header, and stale email errors after recovery. Regression tests cover these cases. Update the bound script to apply the latest correction.

No personal email addresses or credentials are included here. Supply the actual Sheet link directly to the evaluator with appropriate access.
