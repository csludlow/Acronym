# Verification results

Verified locally on **2026-11-04**, macOS, Node **24.22.1**, installed Google Chrome, and the versions in `pnpm-lock.yaml`.

| Check                                     | Result                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| TypeScript strict type checking           | Passed                                                                          |
| Vite production build                     | Passed; 124 modules built                                                       |
| Domain, storage, API, and document tests  | **18 passed, 0 failed**                                                         |
| Playwright browser tests                  | **2 passed, 0 failed**                                                          |
| Generic DOCX render and visual inspection | Passed; all 7 pages of a synthetic sample inspected after LibreOffice rendering |
| Dashboard visual inspection               | Passed; synthetic screenshot in `screenshots/dashboard.png`                     |

The browser workflow created a synthetic postal vendor, saved product details, uploaded a TXT source, marked it current, linked an exact source location, saved a negative response, approved it with a named reviewer, recorded a failed keyboard test for label printing, created/downloaded a draft report, reloaded, and recovered the same response and citation. A separate keyboard test verified the skip link, main-content focus, language declaration, and named author field.

## Acceptance coverage

| Requested behavior                        | Verification                                                                                                                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persistence across restart                | SQLite connection closed/reopened and full saved aggregate compared; browser reload recovered the workflow.                                                                               |
| Unknown remains unresolved                | Approval/final export rejected; initial postal descriptions do not infer traffic or access facts.                                                                                         |
| Justified non-applicability               | Missing confirmation rejected; reason plus human confirmation can be reviewed.                                                                                                            |
| Preserve a negative response              | No preserved through approval, JSON snapshot, and DOCX raw-text round trip.                                                                                                               |
| Flag conflicting descriptions             | Explicit carrier traffic/transmission and remote-support/vendor-access contradictions plus encryption-provider ambiguity detected; approvals blocked.                                     |
| Traceable sources                         | Exact source locations and quoted passages validated; missing passages rejected; references retained in snapshot.                                                                         |
| Re-review after change                    | Approved answer, product, evidence, and test changes covered; history retains previous values.                                                                                            |
| Untested criterion cannot become Supports | Empty, untested, failed, or unknown-detail tests rejected for Supports; coverage acknowledgment required.                                                                                 |
| Failure-containing completion             | Final generic report with reviewed Does Not Support judgments and failed tests succeeds; unresolved criterion blocks final.                                                               |
| Official workbook preservation            | **Not verified / not supported.** No official adapter exists. Test checks rejection; XLSX extraction separately checks source bytes remain unchanged and formulas are not executed.       |
| Unsupported versions                      | HECVAT 4.1.6, VPAT 2.5Rev, and arbitrary future versions rejected by the empty official registry.                                                                                         |
| AI disabled                               | Health endpoint and provider configuration confirm no AI processing; workflow uses no API keys.                                                                                           |
| Document round trips                      | DOCX output re-extracted; required response/reviewer/finding text retained. PDF page extraction and blank-page handling; XLSX sheet/cell references; TXT instruction strings remain data. |
| Backup and request safety                 | Hash mismatch rejected, restored copy preserves originals and clears approvals, stale revisions rejected, Host/Origin and mutation-header protections tested.                             |

## Reproduction

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

On macOS, the test configuration uses installed Google Chrome when present. Set `PLAYWRIGHT_CHANNEL=chromium` to choose the Playwright browser explicitly. The browser test data is separate from the normal app data.

Local document QA used `scripts/qa-report.ts` and the environment’s bundled LibreOffice renderer. The sample contained a negative approved answer, a failed accessibility test, unresolved required criteria, and review history. No clipped text or overlaps were observed on the seven rendered pages. Output is editable DOCX with headings; Microsoft Word rendering and a complete document accessibility audit were not performed.

## Limits of these results

- The API/browser suite needed permission to bind localhost ports and launch Chrome outside the execution sandbox. This is an environment restriction, not an app dependency on a hosted service.
- PDF fixtures intentionally use minimal PDFs; PDF.js logs recovery/font-data warnings while successfully extracting the asserted text. Layout reconstruction, scanned-image recognition, and complex real-world files are not comprehensively tested.
- Vite reports harmless annotation warnings from the installed Zod package; type checking and build complete successfully.
- No real vendor claims were verified. No native Windows app, screen reader, physical printer, carrier API, or payment system was tested.
- The browser accessibility checks are limited smoke tests, not a conformance audit of this assistant.
- No official HECVAT workbook or VPAT-based ACR fidelity claim is made. Licensing and a populated-template verification suite remain prerequisites.
- Local tests passed; the repository also includes GitHub Actions for repeatable Linux checks. A local pass is not a claim that every future CI run passed.
