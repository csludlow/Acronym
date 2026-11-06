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


## 2026-11-05: recovered deployment services and public temporary workspace

Read-only diagnostic run `42109921924` could read empty deployment history and download runtime logs; these reads had returned 503 on November 4. Runtime diagnostics still found `ENOENT`, npm errors, and failed-start signals. Public health was 503 before this retry. These observations indicate the deployment/log services responded again; they do not establish the precise root cause of the platform incident.

The owner clarified the hosted audience: public access for outside vendors doing real assessments, with no saved data. Hosted startup now selects a separate stateless app, never the local SQLite store. Browser tab memory holds each vendor's workspace; the server processes documents/exports per request in memory. Reload/close clears the tab. Explicit reports and portable backups are vendor-owned downloads. Local mode retains its existing persistence. The UI and README disclose these boundaries, transmissions, external fonts, and limits of application-level non-persistence.

Azure uses its supplied `WEBSITE_HOSTNAME` and `PORT`; health is always public, and hosted mode binds to all interfaces. A local-mode setting cannot enable persistent storage on Azure. No cloud resources, secrets, sign-in, or database were added. Adobe font failure still cannot block the app or PDF export.

Authoritative runtime guidance checked November 5, 2026: [App Service environment variables](https://learn.microsoft.com/en-us/azure/app-service/reference-app-settings) and [Node.js configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs). The browser-memory workspace and no-persistence policy are product decisions from the owner's request, not Azure requirements.


## 2026-11-06: successful deployment and live verification

PR #2 merged at `b459eca` after local checks and clean Linux CI [42115291819](https://github.com/cu-app-portal-repos/acronym/actions/runs/42115291819) passed. The merge used `[skip ci]` to avoid a simultaneous automatic deployment while requesting one explicit retry. The CU Launch retry connector returned `ACTION_REQUIRED` / “Open CU Launch for this app workflow” for this imported app. Following the documented recovery path and the owner's retry authorization, the existing GitHub deployment workflow was dispatched against main. No personal Azure login or new cloud identity was used.

[Deployment run 42116061701](https://github.com/cu-app-portal-repos/acronym/actions/runs/42116061701) completed successfully on November 5: install, frontend build, settings preflight, first OIDC login attempt, and Azure deployment all succeeded. On November 6, the public health endpoint returned HTTP 200 and all three public browser tests passed against the live Azure URL. Tests covered the synthetic vendor workflow, document downloads, backup restore, separate tabs, reload/clear behavior, keyboard access, real Adobe font loading, and stalled-font resilience. See `docs/TESTING.md`.

CU Launch's status connector still reports its older November 4 failed attempt (`41889830163`), rather than this manually dispatched successful run. This is a stale portal record; the successful GitHub run and direct live checks are the verification sources. No attempt was made to rewrite portal records or broaden permissions.

The managed repository is private; the original `csludlow/Acronym` repository is public. The public repository is kept as a source mirror, with the CU Launch managed repository remaining the deployment source of truth. Deployment and diagnostic jobs now explicitly require `github.repository == 'cu-app-portal-repos/acronym'`, so copying source to the public repository cannot trigger Azure actions there. The verification/documentation commit uses `[skip ci]` because no application runtime code changed and another deployment is unnecessary.

Azure adds two routing cookies even though the app creates no application cookies. They contain no assessment data. No assessment persistence setting, database, resource, secret, or authentication policy was added or changed in this retry.


## Guided preparation update — November 6, 2026

The owner requested a clearer saving notice and one-question-at-a-time guidance for both setup and the questionnaire. Public mode now says “Your work is not saved automatically”; AI behavior is explained in privacy information. Each flow has Back, Save and next, and Skip for now, a return list, and an end summary. Skip changes only navigation; it never changes applicability, review, or confirmation. Unsaved edits require an explicit discard choice, and failed validation does not advance. Saving and advancing happens only after the existing command succeeds. Navigation positions are tab memory, scoped per assessment and section; assessment storage rules are unchanged.

Local verification: TypeScript, production build, and eight browser tests passed. This normal update uses the existing main-branch automatic deployment; no Azure resources or settings change.


## Progress-file handoff — November 6, 2026

The owner requested visible save/open controls and resume behavior. Save progress file is available across assessment sections; Open progress file is on the welcome screen and available from an open workspace. The UI reminds users to save before leaving and requires current form edits to be applied first. Existing backup validation/format and approval invalidation are preserved, including compatibility with older files. Reopening navigates to unfinished recorded content. No database, automatic browser storage, cloud resource, or retention setting was added. Local type/build checks, two resume unit tests, and twelve browser tests passed before publishing through the existing automatic deployment.
