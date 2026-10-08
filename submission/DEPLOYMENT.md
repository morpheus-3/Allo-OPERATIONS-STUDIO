# Google Sheets deployment and final acceptance

## Prepare

Use one intended automation-owner account. For editor identity capture, use Google Workspace test accounts whose edit events expose email. Do not substitute the trigger owner's identity when it is unavailable.

1. Create a blank Google Sheet, or upload `Allo_Operations_Template.xlsx` and open it as a **Google Sheet**. Excel alone cannot run this automation.
2. Open Extensions → Apps Script. Copy **all three** files: `Engine.gs`, `Code.gs`, `Diagnostics.gs`.
3. Enable manifest editing in project settings. Replace `appsscript.json` with the supplied manifest and save.
4. Run `setup` as the intended owner and grant the requested Google permissions. Reload the Sheet to see the Allo Operations menu.
5. Keep DryRun TRUE. Replace Tasks employee emails and Settings manager/leadership emails. Share the Sheet with the actual participants as editors.
6. Initial cycles snapshot their assignees. Before sharing/starting tests, delete the four sample Workboard data rows after configuring real addresses, then run setup again. Never delete live history to reassign tasks. Changes to Tasks apply to future cycles.
7. Select Install automation triggers. It installs a five-minute timer and one edit trigger under that account. Run the health check and resolve its FAIL entries.
8. Create personal employee filter views. The manager uses Manager for cross-team pending work and missing reviews; action updates happen in Workboard.

## Demonstrate all eight scenarios

Follow DEMO.md with the actual assigned users. Capture screenshots showing completion identity/time, next cycle date, pending manager report, acknowledgement, EmailLog and Health. Owner date overrides are only for accelerating test clocks in a test copy.

## Prove real email

Use a fresh live-mail test Sheet with addresses you control. Do not switch a demo ledger into production: DRY_RUN stage keys are intentionally not resent.

Set DryRun FALSE, create a due cycle, and verify actual manager receipt and SENT status. Accelerate ManagerAlertAt as owner in the test copy, then verify actual leadership receipt. Record receipt time and sender, and test real acknowledgement/completion with the relevant accounts.

## Submission gate

Before sending to the company:

- All local checks pass and the source matches the release archive.
- Live Sheet link exists and the intended evaluator has appropriate access.
- Employee/manager identity is captured correctly and actual edit permissions work.
- Manager and leadership mail receipts are verified, not just logged.
- Health has no unexplained FAIL entries. The MANUAL item is backed by recorded real-user checks.
- Candidate details and genuine portfolio link replace the email draft placeholders.
- Source/report describe any remaining limitations accurately.

## Rollback and recovery

Set DryRun TRUE or remove the timer trigger to stop new real mail. Keep Workboard and EmailLog intact for audit. Review SENDING/REVIEW_REQUIRED rows before retrying, as explained in README. Use a fresh copy for a clean demonstration; retain the original as evidence.

No passwords, company portal credentials or WhatsApp access are needed or included in this release.
