# Publishing Lessons Learned

Record manual fixes and deployment blockers here.

## 2026-11-04: publishing failures and workflow corrections

- Run `41887932613` began on the publishing-workflow merge. Azure login received missing inputs and exhausted its retries. The newer runs `41888230069` and `41889830163` successfully authenticated through OIDC, then failed in OneDeploy with HTTP 503. Thus the original login error does not explain the later failures. GitHub logs do not establish the underlying Azure service failure; CU Launch/Azure diagnostics are still needed.
- The generated Express workflow installed dependencies but omitted `npm run build`. Acronym's production startup requires `dist/index.html`, which is ignored by Git. Added the build before login/deployment so the deployed source package includes compiled browser assets and a failed build stops deployment.
- Added a preflight that checks presence of the four portal-managed deployment settings. It reports missing names only, never values. It does not create credentials, confirm their correctness, or replace CU Launch setup.
- Updated checkout/setup-node to v6 and Azure login to v3, whose action definitions use Node 24. Pinned the runner to Ubuntu 24.04 to avoid the changing `ubuntu-latest` image. The application remains on Node 24. Existing OIDC permissions and secret names are preserved.
- These workflow changes do not claim to fix an Azure OneDeploy 503. They are being reviewed on a separate branch; merging into main triggers the existing deployment workflow.
- Local verification: strict type checking, production build, 30 backend/document/preflight tests, and two browser tests passed. YAML syntax parsed through Prettier. Preflight fixtures use synthetic values and verify missing/blank handling and absence of values in logs. Real Azure login with the updated action and live deployment remain unverified.

### Remaining hosted-operation work

The app remains a local single-user prototype: loopback binding, localhost Host/Origin checks, SQLite/local evidence storage, and no user isolation. A public Azure URL needs a deliberate hosted access/storage design; package import compatibility and a successful upload do not establish that. The requested service choices still add no managed database or Entra login. Do not remove the local request boundary merely to obtain a successful health probe.

References: [Azure login inputs](https://github.com/Azure/login), [GitHub action-runtime transition](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/). No Azure settings or resources were changed during repository diagnosis.

## Font-kit investigation

Holding the Adobe stylesheet request open reproduced a blank/unavailable first screen with the original header link: the named author field never appeared within the test timeout. Immediate font-request rejection in the existing offline tests had not caught this case. Move the optional kit to a React effect with nonmatching media during download, applying it after load. The same regression now creates an assessment and downloads its PDF while the request remains stalled.

Build and Node startup contain no Adobe fetch or font-readiness wait. PDF generation resolves local fonts when a report is requested; a missing `CU_PDF_FONT_DIR` file can fail a report but is not read during startup. The four fallback font files total about 2.3 MB. The typography commit did not change the package dependencies or server listener. This establishes a browser-loading defect, not the cause of OneDeploy's HTTP 503. Azure-side service diagnostics are still needed; no live cause is inferred from the local tests.
## Read-only investigation without personal Azure login

`.github/workflows/diagnose-azure.yml` is manual-only and restricted to main. It reuses CU Launch's existing deployment identity and OIDC trust to read this app's state, configuration, plan state, and deployment results. It does not provision, restart, publish, repair, change settings, or broaden permissions. No personal Azure login is used. The Python helper prints selected status fields and recognized error classes; raw logs, CLI errors, credentials, and HTTP response bodies are suppressed. Endpoint probes do not follow redirects.

The initial diagnostic-only commit uses `[skip ci]` to prevent the existing push-to-deploy workflow from running; diagnostics are then dispatched explicitly. The application/typography fixes remain in draft PR #2. Future ordinary main pushes still trigger the existing deployment workflow.

Local checks: three isolated fixtures verify read-only commands, redaction, host validation and no redirect following; workflow YAML parses through Prettier.
