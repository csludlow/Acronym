# Architecture

The browser and API share one origin. In development, Express mounts Vite middleware; production serves compiled React assets. The server chooses a persistent localhost mode or a public temporary mode before creating any store. Azure always uses temporary mode.

- `shared/model.ts`: original question catalog, setup fields, typed records, input schemas, progress counts, conflict checks, outstanding tasks.
- `shared/handoff.ts`: derives next actions, reviewed security/accessibility transfer blocks, and a submission checklist from the current assessment. New exports store this guide with their fixed snapshot.
- `shared/domain.ts`: validated commands and human-review rules used by both modes. `server/domain.ts` re-exports these rules for compatibility. `shared/validation.ts` holds assessment and portable-backup schemas.
- `server/store.ts`: SQLite aggregate storage with optimistic revisions, prepared statements, and SHA-256-addressed immutable evidence files.
- `migrations/001_initial.sql`: assessment and export-snapshot tables plus migration tracking. Migration 1 is idempotent. Future migrations must be numbered, transactional, and backed up before destructive schema changes.
- `server/extraction.ts`: bounded document readers. A child process isolates parser failures, imposes a memory ceiling and timeout, and returns plain source text. No HTML from uploads is rendered, no macros run, no spreadsheet formulas execute.
- `server/export.ts`: a deep-copy snapshot and generic DOCX renderer. Both the JSON body and DOCX bytes are stored at export creation, so subsequent edits or library upgrades do not alter issued files.
- `server/backup.ts`: portable backup schema, evidence hash validation, and import as a separate assessment. Imported review authority is cleared. Full directory backup preserves issued snapshot files as well.
- `server/adapters.ts`: exact family/version/edition/hash/permission interface. Empty registry; all official requests are unsupported.
- `server/ai.ts`: optional provider and suggestion types; nothing is instantiated. Future suggestions must validate quoted passages, honor evidence exclusions, and cannot approve records.
- `src/main.tsx`: seven workspace sections; native labels, keyboard controls, visible focus, explicit saves, status announcements, human-readable statuses, and responsive layouts.

## Public temporary workspace

`src/workspace.ts` holds assessments, evidence bytes and immutable export blobs in module memory, isolated per tab. There are no storage APIs, cookies, service workers, or shared server sessions for this workspace. It uses the same command validation and human review rules as local mode. Only extraction, export generation and backup validation cross the network. Browser configuration must load before rendering; failure cannot silently switch to persistent mode. Back/forward cache restoration reloads the page to avoid reviving an old workspace. Reload/close discards work; explicit downloads are the only recovery path.

`server/temporary.ts` provides stateless POST endpoints for extraction, generic report generation, and validated restore. It does not instantiate `Store`, load SQLite, create directories, or retain assessment/export state across requests. The public server has no list/read/save-assessment, evidence-download, or saved-export routes. Requests are limited to two concurrent operations per process, 10 MB per upload and 80 MB JSON, with the existing isolated-parser memory/time/expansion limits. Temporary outputs are returned directly as JSON/base64; download blobs stay in the requesting tab. No request body or parser diagnostic text is logged by this public API. Response caching is disabled. Runtime memory reclamation is garbage collection, not secure erasure; the app does not control platform swap, crash recovery or infrastructure diagnostics.

`server/http.ts` validates the platform hostname / configured HTTPS origin, retains same-origin protections and CSP, and leaves only health independent of host/origin restrictions. `server/index.ts` creates the persistent store only in local mode. Azure detection forces temporary mode, listens on all interfaces on the platform port, and uses the platform-provided hostname. Existing portal settings and identity remain unchanged.

Review names remain acknowledgments, not verified identities. Tab-held records are user-controlled; these reports are preparation aids, not signed or tamper-evident certifications. Export still validates structure and completion requirements. Public data is not automatically recoverable; the UI explains downloads and an explicit clear-session action.

## Data and review lifecycle (persistent local mode)

An assessment owns its product configuration, answers, evidence metadata, tests, criteria, and history. Source files are stored under `data/files/<sha256>`; user filenames never select a filesystem path. Metadata includes product/version, upload time, extraction locations, and relevance.

Answers keep applicability independent of workflow state. Negative responses are not rewritten. Review records retain author, reviewer, review time, comments, and support category. Commands append an event containing the prior aggregate (without recursively embedding history) and the submitted command. This is an audit aid, not tamper-evident storage.

All product changes invalidate all approved answers and criterion judgments conservatively. Evidence metadata changes invalidate answers referencing it directly or through tests and judgments using affected tests. Test edits invalidate linked answers and old/new criterion judgments. Editing an approved answer requires review again. Existing export snapshots remain unchanged.

A criterion judgment is separate from each test outcome. Supports needs completed passing tests for the current version plus named scope acknowledgment. Non-applicability needs an explanation. There is no general Not Evaluated category. A final generic package may document Does Not Support and failed tests; missing information/review blocks final completion instead.

## Local security boundary

Local mode binds only to `127.0.0.1`, checks Host and Origin, rejects cross-site requests, and requires a custom header for mutations. The public health endpoint bypasses host/origin checks in both modes; it exposes no user data. There is no CORS permission. Production responses set a Content Security Policy. Local OS users are the trust boundary: there is no account system or verified identity. HTTP on loopback is used, not TLS.

The app requests private directory/file modes on POSIX systems. This does not provide encryption, anti-malware scanning, or protection from another process running as the same user. Evidence downloads use attachment disposition and a binary MIME type. Extracted text and user text are React text nodes. Secret files, SQLite, uploads, snapshots, backups, and local QA outputs are ignored by Git.

The aggregate design trades a simple prototype for write amplification: history stores prior state, including extracted text. It is suited to small local projects, not large enterprise repositories. File garbage collection and deletion workflows are deferred; rejected stale uploads can leave an unreferenced hash file. An owner can archive a complete local data directory.

## CU Launch and future work

CU Launch provides the single-root Express deployment workflow and manifest. Public use is deliberately stateless. Preserve these seams for later increments:

1. Establish platform licensing and exact template fixtures; build and independently verify one official version adapter.
2. If persistent hosted assessments are requested later, define identity, tenancy, retention, encryption and backups first. Do not enable the local database behind a public proxy or repurpose temporary mode as shared storage.
3. Add structured standards catalogs with versioned criterion scope and official terminology rules. An empty registry must remain fail-closed.
4. If adding AI, require opt-in disclosure of exactly what leaves the machine, server-side credentials, evidence exclusions, citation verification, and suggestion-only commands. Source text remains data, including instructions embedded in documents.

The current JSON export is intentionally specific to Acronym; implement OpenACR as a separately validated adapter rather than relabeling it.

PDF support uses `migrations/002_pdf.sql` to add nullable PDF bytes without changing old snapshots. New snapshots store DOCX and PDF bytes together; older snapshots return a visible PDF-unavailable response. `server/export.ts` creates shared report blocks and DOCX; `server/pdf.ts` renders those same blocks locally through PDFKit with bundled open-license fonts. Branding values and reusable descriptions are in `shared/brand.ts`.

CU typography uses Adobe web kit `yya5cit` in the browser. Production CSP permits the specific Adobe font/style hosts. `server/report-fonts.ts` resolves private `CU_PDF_FONT_DIR` files for report embedding or selects explicit open-license serif/sans fallbacks. Proprietary font files are never bundled or served by this code. DOCX uses Minion Pro body styles and Myriad Pro heading/callout styles. See `docs/TYPOGRAPHY.md` for kit ownership, the future Launch hostname, and distinct web/report font requirements.


Progress-file controls use the existing `acronym-backup-v1` format and validation; no new persistence is introduced. `saveProgressFile` creates a browser download in both modes (using the local backup API only in local mode). It checks the 80 MB reopening limit. The workspace prevents downloads while a form has unapplied edits, and shows a reminder to save an updated file before leaving. `shared/resume.ts` selects the first unknown/unconfirmed setup item, incomplete answer, or outstanding accessibility/review work from restored data. It does not trust a stored screen index or revive approvals. Navigation is scoped to the newly imported assessment. Old backups remain compatible; issued report JSON is visibly rejected as a progress file.
