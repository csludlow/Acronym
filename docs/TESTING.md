# Verification results

## Progress-file workflow — November 6, 2026

Type checking, production build, two resume-selection unit tests, and all **12 browser tests** passed locally. New coverage verifies saving from setup, preventing omission of unapplied edits, reopening after reload at the next unconfirmed setup field, rejecting malformed files without replacing current work, and opening an older backup at the next unanswered questionnaire prompt. Imported approvals require review again; saved negative answers remain negative. The full synthetic workflow also preserves evidence and citations through a progress-file round trip in public mode. Both local and temporary modes pass.

## Guided setup and questionnaire — November 6, 2026

Type checking, production build, and all **8 local browser tests** passed for the guided-flow update (both local and public modes). The new test walks through every setup/questionnaire skip, returns to earlier answers, verifies save errors do not advance, checks keyboard focus on the next question, confirms discarded edits do not overwrite a saved negative answer, and inspects a downloaded draft. Skipped answers stay Unanswered, setup fields remain unconfirmed, and final completion remains blocked. Existing evidence/review/export, keyboard, and font-stall workflows also pass.

## Live Azure verification — November 6, 2026

Deployment [42116061701](https://github.com/cu-app-portal-repos/acronym/actions/runs/42116061701) succeeded on November 5 for commit `b459eca`. The live `/api/health` returned HTTP 200 on November 6. GitHub's clean Linux build and full suite passed in [42115291819](https://github.com/cu-app-portal-repos/acronym/actions/runs/42115291819).

All **3 public browser tests passed against the live Azure URL** using synthetic content only. This exercises extraction, review, failed accessibility findings, DOCX/PDF/JSON downloads, negative answers and source references, portable backup/restore, separate-tab isolation, reload/end-session clearing, and keyboard navigation. The suite also verifies the app remains usable during a stalled Adobe font request. With `CU_VERIFY_FONTS=1`, the full workflow confirmed Minion Pro and Myriad Pro loaded from the live hostname.

The application creates no cookies. Azure does set its two routing cookies (`ARRAffinity` and `ARRAffinitySameSite`); live tests allow only these platform cookies and still require empty local storage, session storage and IndexedDB. This is distinct from assessment persistence. The application data-directory assertion is a local startup check; the live browser test does not inspect Azure's underlying disk, swap, or logs.

Repeat this explicit synthetic live test when needed:

```sh
ACRONYM_TEST_URL=https://app-acronym-cmw2fde0.azurewebsites.net CU_VERIFY_FONTS=1 npm run test:e2e
```

When `ACRONYM_TEST_URL` is set, Playwright uses only the public project and does not launch local servers. Without it, the existing local/public localhost suite remains unchanged. No real vendor records are used.

## Public temporary workspace verification — November 5, 2026

Strict TypeScript checking and production build passed on Node 24.22.1. All **33 backend/document tests** and **6 browser tests** passed; the three public API/startup tests were repeated after tightening the processing limit. The browser workflow runs in both persistent localhost and temporary public modes. Earlier dated results below remain historical.

New checks verify stateless extraction/export/restore, unsupported public persistence routes, no cookie issuance, no response caching, origin/header rejection, public health independent of origin, unsupported-template rejection, final-report gates, and production Azure startup without creating `DATA_DIR` or a SQLite database. Azure detection overrides an accidental local-mode setting.

The public browser test creates a synthetic assessment, attaches evidence, approves a negative answer with its citation, records a failed accessibility test, and downloads DOCX/PDF/JSON and a portable backup. JSON assertions preserve the negative response, approval, citation, and failure. A second tab has no assessments or author; local/session storage, IndexedDB and application cookies remain empty. Reload clears work; explicit backup restore recovers the content and requires renewed review. The end-session action clears work again. Both modes pass keyboard/labels and stalled-Adobe-request tests. Local persistence and document round-trip tests remain in the suite.

The first keyboard run pressed Tab before asynchronous configuration completed. The test now waits for the named author field before checking the first tab stop; all six browser tests then passed. No keyboard navigation code was weakened.

This verifies application behavior, not Azure or browser forensic erasure, memory/swap policy, infrastructure logging, a penetration test, or native desktop accessibility conformance. Synthetic content only was used. Live Azure publishing and a clean Linux installation are checked separately and recorded in publishing notes.


Verified locally on **2026-11-04**, macOS, Node **24.22.1**, installed Google Chrome, and the installed dependency versions from the previous pnpm lockfile.

## CU Launch package compatibility check

After removing the unsupported pnpm lockfile/workspace declaration and switching instructions and CI to npm, strict type checking, the production build, all **27 backend/document tests**, and both **2 browser tests** passed again. The synthetic workflow ran against a separate local data directory. The API test initially hit the sandbox’s localhost-listener restriction; it passed when rerun with that permission.

Node and the test tools were invoked directly from the bundled runtime because npm is absent from both the system and bundle. No runtime was installed. These local results use existing dependencies; fresh npm resolution is checked separately by the updated GitHub workflow. The source package satisfies the supplied single-root Express contract and contains no unsupported package-manager lockfile or workspace declaration. CU Launch’s own preparation check and live Azure behavior remain unverified.

| Check                                     | Result                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| TypeScript strict type checking           | Passed                                                                          |
| Vite production build                     | Passed; 126 modules built                                                       |
| Domain, storage, API, document, deployment-preflight tests | **30 passed, 0 failed**                                              |
| Playwright browser tests                  | **3 passed, 0 failed**                                                          |
| Generic DOCX render and visual inspection | Passed; all 8 pages of a synthetic sample inspected after LibreOffice rendering |
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
npm install
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

On macOS, the test configuration uses installed Google Chrome when present. Set `PLAYWRIGHT_CHANNEL=chromium` to choose the Playwright browser explicitly. The browser test data is separate from the normal app data.

Local document QA used `scripts/qa-report.ts` and the environment’s bundled LibreOffice renderer. The sample contained a negative approved answer, a failed accessibility test, unresolved required criteria, and review history. No clipped text or overlaps were observed on the eight rendered pages. Output is editable DOCX with headings; Microsoft Word rendering and a complete document accessibility audit were not performed.

## Limits of these results

- The API/browser suite needed permission to bind localhost ports and launch Chrome outside the execution sandbox. This is an environment restriction, not an app dependency on a hosted service.
- PDF fixtures intentionally use minimal PDFs; PDF.js logs recovery/font-data warnings while successfully extracting the asserted text. Layout reconstruction, scanned-image recognition, and complex real-world files are not comprehensively tested.
- Vite reports harmless annotation warnings from the installed Zod package; type checking and build complete successfully.
- No real vendor claims were verified. No native Windows app, screen reader, physical printer, carrier API, or payment system was tested.
- The browser accessibility checks are limited smoke tests, not a conformance audit of this assistant.
- No official HECVAT workbook or VPAT-based ACR fidelity claim is made. Licensing and a populated-template verification suite remain prerequisites.
- Local tests passed; the repository also includes GitHub Actions for repeatable Linux checks. A local pass is not a claim that every future CI run passed.

## Guided handoff verification

Four additional tests cover prioritized next actions, explicit unknown purchaser standards, transfer blocks restricted to approved responses, preservation of No and justified non-applicability, immutable exported handoff text, failure-containing accessibility judgments, invalidation after test changes, and continuing submission steps after preparation is complete. The browser workflow verifies actual clipboard contents, readable fallback text, and navigation from the overview through the handoff to Product setup. DOCX round-trip assertions include the next steps and submission checklist; all eight sample pages were rendered and inspected.

## CU colors and PDF verification

PDFKit exports the same report blocks as DOCX, with embedded Noto Sans, text structure tags, CU blue headers and gold accents. Three additional tests cover PDF text/tag preservation, non-destructive migration from an older database, and readable CU foreground combinations. API tests verify PDF MIME type and byte stability; browser tests verify the primary button color and PDF download. The eight-page synthetic PDF was rendered with Poppler and visually inspected, along with the eight-page DOCX. Blue/gold sample pixels were checked on every PDF page. No full PDF/UA audit or spot-color printing verification is claimed.

## CU typography verification

The font-outage regression now holds the Adobe stylesheet request open while completing setup and downloading a PDF. It failed before the non-blocking font loader and passed afterward. Offline rejection and a stalled network request are both covered. The optional live-font verification waits for asynchronously loaded faces rather than assuming page navigation waits for fonts. The full synthetic workflow also passed with real Minion/Myriad faces loaded after this change.

The published Adobe kit `yya5cit` was verified in Chrome: Minion Pro regular and Myriad Pro bold both returned loaded font faces from `document.fonts.load`, and the complete workflow passed (2 browser tests). Default browser tests block Adobe requests to check offline fallback operation separately. Two new backend tests verify DOCX font roles without commercial-font embedding and explicit PDF fallback/incomplete-configuration behavior. The nine-page fallback PDF was rendered with Poppler and all pages inspected. Actual Minion/Myriad PDF embedding remains unverified because server-licensed font files have not been supplied. DOCX XML references were checked; exact desktop rendering depends on the recipient’s installed licensed fonts.
