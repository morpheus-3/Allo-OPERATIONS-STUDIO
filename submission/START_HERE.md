# Allo recurring operations release 2.1.0

Start with SOLUTION_REPORT.pdf. Google Sheets is the operating interface; demo.html is an offline simulation.

Working Sheet: https://docs.google.com/spreadsheets/d/1aLoeuykOMAq-sWQ7JCzsnpEkuSQle93c6mgVHKYYsn4/edit

## Evidence status

45 local tests and eight deterministic scenarios pass. The 8 October hosted record contains user-confirmed results with one account across roles and accelerated escalation timing. Updated deployment, distinct users, actual formula results and evaluator access remain pending. Adapter tests do not prove real Google service acceptance.

## Five minute reviewer route

1. Read SOLUTION_REPORT.pdf for workflow and tradeoffs.
2. Read ASSESSMENT.md for requirement coverage and evidence boundaries.
3. Open demo.html and complete a portal task. Inspect retained proof and the next cycle. Daily work needs no ticket.
4. Reset, advance to 17:00 and run repeatedly. Add a recovery note and acknowledge one task. Advance four hours and then a day to inspect both escalation paths.
5. Inspect evidence/DEMO_RESULTS.json and TEST_RESULTS.tap. Run npm run verify to reproduce local observations.

## Required deliverables

- SOLUTION_REPORT.pdf: formatted explanation and confirmed candidate details.
- Allo_Operations_Template.xlsx: importable structure without embedded Apps Script.
- Allo_Operations_AppsScript.gs or src/: install one source form only; src/appsscript.json is required.
- DEPLOYMENT.md: setup, authorization and rollback.
- DEMONSTRATION_PROTOCOL.md: exact actions, expected results, observed local results and pending Google checks.

V2_ACCEPTANCE.md covers recovery, backup routing, calendars, fixed recurrence, weekly reporting and browser checks. UPGRADE_RESULTS.json records observed adapter results. The frontend remains a local simulation.

## Supporting material

MANAGER_OPERATING_PLAYBOOK.md explains recovery ownership, assumptions and pilot metrics. HOSTED_ACCEPTANCE.md retains historical user-reported evidence. evidence/ARTIFACT_QA.json records visual review tied to artifact hashes. SHA256SUMS.json verifies packaged files.

Candidate interview preparation and the unsent email are excluded from the archive. Use Restricted sharing with a confirmed evaluator account. Evaluator access is pending.
