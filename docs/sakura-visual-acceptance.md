# Sakura visual acceptance — local preview only

Keep PR #31 in Draft until all seven UI phases are reviewed, CI is green for the exact head, and the owner approves the single production merge.

## Browser runner (Node 22+ and existing Chrome/Chromium)

Use a separate local checkout of the draft branch without production credentials. Start the dev server on loopback, then run in a second Terminal:

```sh
node scripts/sakura-visual-check.mjs
```

The runner launches a fresh headless browser profile, blocks requests to non-preview origins, uses synthetic Demo data only, and writes screenshots plus result.json to a temporary directory outside the repo. It does not sign in, register, submit real data, deploy, install browser packages or change Firebase/Sheets. If Chrome is installed somewhere else, set CHROME_BIN to its executable. SAKURA_PREVIEW_URL is limited to a loopback HTTP address. Keep your existing preview server running.

The automated checks cover document overflow at 1440/1280/800/768/390/320 CSS pixels, mobile navigation breakpoint, Demo dashboard, ranking, score table, settings and theme switching, invalid score rejection and zero retention, and public login/register screenshots. They do not prove visual quality, real mobile Safari behavior, keyboard accessibility throughout, Firebase writes, or print correctness. The runner is newly added and not yet validated against the complete application; inspect any error before treating a run as evidence.

## Manual review after the runner

- Landing and Login/Register: verify illustration crop, branding, contrast, focus, form spacing. Do not submit credentials or registration.
- Dashboard: verify KPI and chart labels, navigation and no banner on subpages. Demo figures are illustrative.
- Scanner/Gradebook: in Demo, try blank, zero, decimal, invalid and cancel; check editing and row actions at 320/390 widths and when the keyboard appears.
- Champions: check podium order, long names and filtered rooms, decorative avatars and readable medals; retain production ranking formulas and existing ties.
- Responsive: review all screenshots visually, keyboard Tab/Enter, menu collapse, touch targets, scroll and no overlapping bottom navigation. Check Sakura/Mint/Night and reduced-motion preference.
- Real workspace and print: use synthetic fixtures or a properly isolated emulator only. Verify role-specific navigation, real scanner audit/score paths, and print preview of synthetic reports and barcode labels. No real Firebase/Sheets data or credential changes.

Record the exact commit, browser version, viewport and actual pass/fail evidence. A green CI or screenshot alone is not full visual acceptance. Do not merge on incomplete evidence. Keep portal and direct Sheets writes disabled.
