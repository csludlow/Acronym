# Acronym

A local, single-user vendor assessment assistant. It helps small software vendors organize product facts, security responses, evidence, accessibility testing, and human review before preparing purchaser deliverables.

**Working prototype:** React and TypeScript, a Node/Express server, SQLite, and local evidence files. No AI service, API key, or external service is required at runtime. CU Launch hosting and protocols are intentionally deferred.

**Official-template boundary:** this release supplies original preparation content and generic DOCX/JSON reports. It does not bundle HECVAT questions, generate an official HECVAT workbook, or produce an official VPAT®-based ACR. HECVAT platform licensing is not established. Official exports fail visibly rather than guessing. See [standards research](docs/STANDARDS.md).

![Synthetic assessment dashboard](docs/screenshots/dashboard.png)

## Install and run

Requirements: Node.js **24 or newer** and npm; pnpm 11 is recommended for the checked-in lockfile.

```sh
npm install -g pnpm@11
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:4310**. Enter your name and choose **Explore synthetic demo**, or create a blank assessment. No default standard is selected. Saved changes survive reloads and server restarts.

For a production-style local run:

```sh
pnpm build
NODE_ENV=production pnpm start
```

On PowerShell, set `$env:NODE_ENV="production"` before `pnpm start`.

The server always binds to `127.0.0.1`. `PORT` changes its port and `DATA_DIR` changes the local data directory. No external font, analytics, telemetry, or AI endpoint is used by the app. Browser tests use a separate `.local/e2e-data` directory.

An npm-only installation also works with `npm install`, followed by the same `npm run dev`, `npm run build`, and `npm start` commands; it does not use the pnpm lockfile. Prefer pnpm for reproducibility.

## Walk through the prototype

1. **Product setup:** record vendor/product/version, data flows, deployment, responsibilities, owner, purchaser requests, scope, and evaluation methods. Confirm facts separately. Unknowns stay open. The postal demo’s customer descriptions are unconfirmed and do not imply that traffic, support access, backups, or payments are absent.
2. **Evidence:** upload a PDF, DOCX, TXT, XLSX, CSV, or TSV. Inspect extracted text, product/version, source locations, and relevance. Mark it Current only after checking. A policy is evidence of stated policy, not proof of implementation.
3. **Questionnaire:** use the grouped original questions, plain-language explanations, response format, and evidence suggestions. Add an answer, citations, completed tests, or a human attestation. No is valid. Not applicable needs a reason and confirmation. Save before switching questions.
4. **Accessibility:** define actual criterion identifiers, standards, levels, and scope; the supplied areas are just starters. Record screens, workflow, OS/configuration, methods/tools/assistive technologies, expected and observed behavior, tester/date, findings, limitations, and remediation. Link evidence. Record criterion judgments separately with a named reviewer and coverage acknowledgment.
5. **Review queue:** approve supported answers as a named human. A reviewer name is an acknowledgment, not verified identity or a cryptographic signature. Changes to answers, product details, or relevant evidence/test records require renewed review.
6. **Exports:** create a draft snapshot at any time. Download DOCX and JSON from the same fixed snapshot. Final generic completion requires all documentation/review tasks to be resolved, but can include documented failures. This is not a security score, accessibility certification, or official template completion.

The synthetic workflow includes creating a shipment, editing an address, responding to a validation error, and printing a label. It uses no real shipment records or customer addresses. `tests/helpers.ts` contains a complete synthetic fixture for testing final reports with documented failures.

## Backup and restore

**Portable assessment backup:** use Exports → Download assessment backup. It includes that assessment, evidence bytes, extracted text, and history. Use Restore as a copy to import it without overwriting existing work. Hashes and structure are validated. Imported approvals/judgments require fresh review. Portable backups exclude issued export files; download those separately. The restore request limit is 80 MB.

**Full workspace backup, including issued snapshots:** stop the server with Ctrl+C, then copy the entire `data/` directory (or your `DATA_DIR`) to a protected backup location. Include the SQLite database, any `-wal`/`-shm` files, and `files/`. Never copy only a live database file. To recover, keep the existing directory as a fallback, place the backup in a separate directory, and start with `DATA_DIR=/path/to/recovered-data pnpm start`. The app applies numbered SQL migrations automatically on startup. See [architecture](docs/ARCHITECTURE.md).

The application does **not encrypt** local storage, exports, or backups. Use operating-system access controls and disk encryption appropriate to your environment. Keep backups and evidence out of Git. SHA-256 detects accidental changes, not malicious alteration by someone who can edit the whole database and files.

## Tests

```sh
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser test automatically uses installed Chrome on macOS. You can also select it with `PLAYWRIGHT_CHANNEL=chrome`; otherwise it uses Playwright Chromium. CI installs Chromium. Tests exercise the non-AI workflow, persistence, approval gates, negative/unknown/non-applicable answers, exact references, conflicts, stale approvals, test/judgment separation, failure-containing final reports, backup integrity, localhost protections, unsupported adapters, document round trips, and a full synthetic browser workflow.

See [verification results and limitations](docs/TESTING.md). For manual DOCX QA, `node --import tsx scripts/qa-report.ts` creates a synthetic report under `.local/qa/`. Open it in Word or LibreOffice; generated report contents remain editable. The repository does not ship real assessments or evidence.

## Supported formats and limitations

| Capability                     | This release                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Original questionnaire         | Preparation v1, eight original questions; no official HECVAT question set                                                                        |
| Accessibility workspace        | User-defined criteria plus six original starter areas; no automatic standards inventory                                                          |
| Generic exports                | Editable DOCX; `acronym-generic-v1` JSON; fixed snapshots                                                                                        |
| Official HECVAT / VPAT® export | **Unsupported** for every version; explicit rejection                                                                                            |
| Evidence                       | PDF text by page; DOCX by paragraph; UTF-8 TXT/CSV/TSV by line; XLSX by sheet/cell                                                               |
| Upload limits                  | 10 MB/file; 40 MB expanded Office package; 3,000 ZIP entries; 300 PDF pages; 50,000 text lines/cells; 15-second extraction timeout               |
| Scans and legacy Office        | No OCR; image-only pages require manual transcription; `.doc`, `.xls`, macro files, encrypted documents, and embedded Office objects unsupported |
| Backups                        | Portable per-assessment JSON; full offline data-folder copy for complete recovery                                                                |
| AI                             | Disabled; provider interface only; no external processing implementation                                                                         |

CSV/TSV evidence is preserved as line text, not interpreted as a spreadsheet. XLSX formula text and cached values are read without calculation. Complex or unsupported packages can be rejected. Extraction does not guarantee complete reading order, table reconstruction, or semantic accuracy; inspect the source. The app is not a malware scanner.

Conflict checks cover explicit structured traffic/access facts and a small encryption check. They do not comprehensively understand arbitrary prose or documents. No application can verify the truth of an attestation or whether a human actually performed a test.

No hosted authentication, multi-user roles, billing, enterprise integrations, automated native-desktop testing, or official-template adapter is included. Do not expose this prototype through a public proxy. [Architecture and extension points](docs/ARCHITECTURE.md) describe the CU Launch handoff boundary.

## Troubleshooting

- **Node cannot load `node:sqlite`:** install Node 24+, then reinstall dependencies.
- **Port is in use:** stop the other server or use `PORT=4312 pnpm dev` and open that localhost port.
- **Missing production build:** run `pnpm build` before starting with `NODE_ENV=production`.
- **Save conflict:** another tab changed the assessment. Reload it before resubmitting; stale writes are rejected.
- **Cannot approve:** inspect missing author/support, unknown answer/applicability, product conflicts, evidence currency/version, or unfinished linked tests.
- **Cannot record Supports:** complete all recorded tests for that criterion and current product version, resolve failed tests honestly, and confirm coverage. Do not change a failed result merely to obtain Supports.
- **Export stays draft:** use the completion checklist. Confirm setup and scope inventory, review every answer, and record human judgments for the stated criteria.
- **Extraction fails or misses text:** use an unencrypted supported document, reduce its size, or upload a TXT transcription with source notes. Check scanned pages manually.
- **Tests cannot open a local port or launch a browser:** run in an environment that permits localhost listeners and browser processes; this is required by API and end-to-end tests.
