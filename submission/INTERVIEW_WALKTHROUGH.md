# Explain the project clearly

## Opening (30 seconds)

“I used Google Sheets as the operating interface so employees can see pending work and complete it in the same row. Apps Script closes the current cycle, creates the next one and manages alerts. I separated employee completion from manager acknowledgement because reviewing a delay does not mean the work is resolved.”

## Show, then explain

1. Complete Portal Task A with a Ticket ID. Point out editor, timestamp, retained proof and automatically calculated next deadline.
2. Complete the daily task without a ticket. Explain that this is an employee attestation after posting the WhatsApp update; evidence is optional, and independent WhatsApp verification is outside the prototype.
3. Show manager pending work and outstanding reviews. Add an action note and acknowledge.
4. Demonstrate the 4h/24h rules and repeated automation without duplicate stage keys.
5. Show failed-send recovery. Explain why an ambiguous delivery is held for review rather than blindly retried.

## Likely questions

**Why completion-anchored recurrence?** It makes the next deadline automatic and avoids generating multiple copies while one cycle remains unresolved. A fixed-calendar policy is also possible, but would require a decision about missed-cycle backlog.

**Why four and 24 hours?** Four elapsed hours creates same-evening review visibility after the 17:00 cutoff. Twenty-four hours gives a full day to resolve work. Nights and weekends count; the company can choose different SLA values.

**What does the checkbox prove?** It records who confirmed completion and when. It does not prove the truth of an external WhatsApp message or Ticket ID without an authorized integration.

**What prevents duplicates?** Stable task/date cycle IDs, a cycle/stage email key, ScriptLock and durable reservations before sending. Cross-service exactly-once delivery is not claimed.

**What needs production hardening?** Real Google identity/permission validation, quota monitoring, holiday policy if required, and a more isolated backend if collaborators cannot be trusted with a bound-script project.

## Be accurate

Describe local adapters as simulations. Only call email delivered after seeing the actual receipt. Only claim work and portfolio experience that are yours. Use the final checkpoint status to explain what was verified, and avoid promising hiring outcomes.
