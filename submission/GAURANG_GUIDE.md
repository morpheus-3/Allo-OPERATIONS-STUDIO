# Gaurang — operations assistant

Gaurang answers questions from recorded tasks, cycles, manager coverage settings, saved recovery versions and the website's workflow rules. It is a deterministic, read-only chatbot, not a general-purpose language model. It does not browse websites, infer employee leave, approve actions or send messages. Questions are independent: include the task or employee name each time.

## Website preview

Refresh demo.html and select **Ask Gaurang** at the bottom right. The website chat reads the current local demo state on every question, including changes made through the Workboard, calendar and recovery controls. It considers all team records; the dashboard's employee filter does not restrict chat. Answers show **Website demo**, a simulated timestamp and cycle references. Chat history stays in page memory and resets on reload; it is not written to Google Sheets.

Try:

- Which tasks are overdue?
- Show tasks for Employee B.
- Which reviews are awaiting acknowledgement?
- Show completed tasks today.
- Show saved recovery plans.
- Who covers manager leave?
- List holidays.
- How often does Portal Task A repeat?
- Show weekly report 2026-10-05.
- Why does acknowledgement not complete a task?

## Live Google Sheets sidebar

1. Install the updated combined Apps Script bundle **or** all five .gs source files, including Assistant.gs and Leave.gs. Never install both forms.
2. In the bound Apps Script project, add an **HTML** file named **Gaurang**. Paste the contents of src/Gaurang.html. The .gs bundle alone is insufficient for the sidebar.
3. Apply src/appsscript.json, including the container UI and user email scopes. Save, configure real manager addresses and reload the Sheet.
4. Sign in as the configured primary manager or the backup during its approved leave window. Select **Allo Operations → Ask Gaurang** and authorize the updated script if prompted.
5. Ask a question. The server checks the active user's identity and reads Tasks, Workboard, Settings and RecoveryLog on each request. Missing identity and unauthorized users are rejected. The automation owner's identity is never substituted for the caller.

This does not connect the localhost website to the live sheet. The authenticated sidebar is the live chat interface. No public endpoint, API key or third-party model is used. Shared Sheet visibility and trusted script collaborators retain the existing system's access limitations; this sidebar is not an additional security boundary around the workbook.

Employee balances now come from LeaveRequests and its authoritative decision ledger, LeaveLog. The default entitlement is 50 days per unique email per calendar year. Leave requests and decisions are made through Paid leave, not chat. Recovery answers use saved RecoveryLog versions rather than unsaved Workboard drafts. Long task results show the earliest twelve matching cycles and state the total count.

## Acceptance before live use

Local tests verify record grounding, citations, completion vs acknowledgement, missing employee leave, weekly metrics, recurrence, saved recovery versions, rejection of unauthorized users, backup expiry, safe text rendering and request/error handling. They simulate Google services.

In Google, verify a primary manager can open chat, an employee cannot call askGaurang, a current backup can ask and an expired backup cannot. Complete a test cycle and ask again to confirm a fresh answer. Compare weekly counts with the generated report; check source cycle IDs, timestamps and saved recovery revisions. Verify the deployed sidebar renders and authorization works with the actual accounts. Website desktop/mobile chat visual acceptance also remains pending because no browser provider is connected.

The identity check follows Google's [Session documentation](https://developers.google.com/apps-script/reference/base/session). The sidebar calls server functions through [google.script.run](https://developers.google.com/apps-script/guides/html/communication).
