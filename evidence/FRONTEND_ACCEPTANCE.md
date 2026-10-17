# Frontend acceptance

Reviewed all six user-supplied desktop screenshots on 17 October 2026: overview, workboard, manager review, weekly report, activity and calendar/coverage. No clipping was evident in these desktop captures.

Corrected the exact-cutoff weekly mismatch, populated the selected Monday, removed duplicate global metrics from report/settings/activity views, improved supporting text contrast and keyboard focus, added a purposeful empty-chart action, clarified overdue dates and event labels. Shared-engine and DOM-harness regression checks cover the cutoff and navigation behavior.

Updated frontend browser rendering, mobile layouts and recovery drawer visual acceptance remain pending. These screenshots show the preceding build; they do not verify the updated UI or live Google Sheets integration.

Gaurang chat added with source mode, timestamps, suggested questions, pending/error states and safe text rendering. Endpoint and DOM tests pass. Chat desktop/mobile visuals and deployed Sheets sidebar acceptance remain pending; browser inventory was empty during this update.

Release 2.1.0 adds a responsive Paid leave page, local role simulation and a live sidebar with signed commands processed by owner automation. End-to-end demo request/approval/balance behavior is tested in a DOM harness. Desktop/mobile browser visuals remain unverified.
