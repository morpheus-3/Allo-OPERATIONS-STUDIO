# Allo recurring operations prototype

**Submission status: working prototype complete.** The user has confirmed live workflow/email tests and passing automated Health checks. Review `HOSTED_ACCEPTANCE.md` for evidence and the one-account testing limitation.

Working Sheet: https://docs.google.com/spreadsheets/d/1aLoeuykOMAq-sWQ7JCzsnpEkuSQle93c6mgVHKYYsn4/edit (request access from the candidate if needed).

## Reviewer route (about five minutes)

1. Read `SOLUTION_REPORT.docx` for the problem, decisions and evidence.
2. Open `demo.html` in a browser. Complete one portal task, then inspect its prepared future cycle. Daily tasks need no ticket.
3. Reset the demo, advance to 17:00 and run automation repeatedly. See one manager alert per open cycle. Add a manager action note and acknowledge one task.
4. Advance four hours: unacknowledged items escalate. Complete and acknowledge a task to stop its escalation. Advance a day to see unresolved acknowledged work escalate.
5. Review `evidence/TEST_RESULTS.tap` and `evidence/DEMO_RESULTS.json`.
6. For the actual operating system, follow `DEPLOYMENT.md`. Import `Allo_Operations_Template.xlsx` or start with a blank Sheet; copy the script files and run setup.

## Included files

- `src/`: deployable Apps Script and manifest.
- `submission/Allo_Operations_Template.xlsx`: importable workbook structure, sample task master and instructions. XLSX does not embed or run Apps Script.
- `submission/SOLUTION_REPORT.docx`: project explanation and evidence boundaries.
- `submission/DEPLOYMENT.md`: Google account deployment and acceptance steps.
- `CHECKPOINTS.md` and `REQUIREMENTS.md`: delivery status and requirement mapping.
- `evidence/`: generated test output and deterministic scenario results.

This release can be reviewed and exercised offline immediately. The accompanying live Google Sheet and actual mail receipts were subsequently confirmed by the user; the XLSX and offline simulation alone do not provide those services.
