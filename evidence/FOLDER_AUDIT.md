# Folder audit ? 17 October 2026

Cleanup completed using Windows Recycle Bin after permanent bulk deletion was previously blocked. All targets were resolved inside the workspace and checked for reparse points before recycling. Source, tests, .git, current deliverables, current QA renders and external runtime dependencies are preserved.

1006 obsolete files (26,179,714 bytes) moved to the Recycle Bin; recoverable until the user empties it. Details: CLEANUP.json.

Removed: obsolete .build-deps, extracted old releases, obsolete PDF renders, superseded release/document history, temporary root debug scripts, old inspection notes and the generated workbook inspection sidecar.

Remaining current file inventory:

## evidence
- evidence/ARTIFACT_QA.json
- evidence/ARTIFACT_QA_REQUEST.json
- evidence/CLEANUP.json
- evidence/DEMO_RESULTS.json
- evidence/DEMO_RESULTS.md
- evidence/FOLDER_AUDIT.md
- evidence/FRONTEND_ACCEPTANCE.md
- evidence/HOSTED_HEALTH.json
- evidence/TEST_RESULTS.tap
- evidence/UPGRADE_RESULTS.json
- evidence/VERIFICATION.json
- evidence/VERIFICATION.md
## private
- private/CONFIGURATION_IMPORT.md
- private/CONFIRMED_SETTINGS.tsv
- private/OPERATING_SETTINGS_DRAFT.json
## release
- release/Allo_AI_Operations_Manager_v2.0.0.zip
- release/SHA256SUMS.json
## scripts
- scripts/build-preview.cjs
- scripts/build-workbook.mjs
- scripts/check.cjs
- scripts/demo-report.cjs
- scripts/google-sheets-acceptance.gs
- scripts/management-report.cjs
- scripts/package_release.py
- scripts/serve.cjs
- scripts/verify.cjs
## src
- src/appsscript.json
- src/Assistant.gs
- src/Code.gs
- src/Diagnostics.gs
- src/Engine.gs
- src/Gaurang.html
## submission
- submission/Allo_Operations_AppsScript.gs
- submission/Allo_Operations_Template.xlsx
- submission/ASSESSMENT.md
- submission/DEMONSTRATION_PROTOCOL.md
- submission/DEPLOYMENT.md
- submission/GAURANG_GUIDE.md
- submission/HOSTED_ACCEPTANCE.md
- submission/INTERVIEW_PREPARATION.md
- submission/MANAGER_OPERATING_PLAYBOOK.md
- submission/SOLUTION_REPORT.md
- submission/SOLUTION_REPORT.pdf
- submission/START_HERE.md
- submission/V2_ACCEPTANCE.md
## tests
- tests/acceptance.test.cjs
- tests/assistant.test.cjs
- tests/google-adapter.cjs
- tests/integration.test.cjs
- tests/management.test.cjs
- tests/preview.test.cjs
- tests/system.test.cjs
## web
- web/demo.template.html
- web/gaurang.css
- web/gaurang.html
- web/gaurang.js
- web/preview.js

## Retained build intermediates

tmp/artifact-build/qa retains current reviewed images referenced by ARTIFACT_QA.json. External runtime dependencies are not deleted.
