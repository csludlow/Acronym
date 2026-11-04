# Architecture

The browser and API share one localhost origin. In development, Express mounts Vite middleware. In production, it serves the compiled React assets. No cloud process is involved.

- `shared/model.ts`: original question catalog, setup fields, typed records, input schemas, progress counts, conflict checks, outstanding tasks.
- `shared/handoff.ts`: derives next actions, reviewed security/accessibility transfer blocks, and a submission checklist from the current assessment. New exports store this guide with their fixed snapshot.
- `server/domain.ts`: validated commands and human-review rules. All persisted business mutations pass through commands except creation, evidence upload, and validated restore.
- `server/store.ts`: SQLite aggregate storage with optimistic revisions, prepared statements, and SHA-256-addressed immutable evidence files.
- `migrations/001_initial.sql`: assessment and export-snapshot tables plus migration tracking. Migration 1 is idempotent. Future migrations must be numbered, transactional, and backed up before destructive schema changes.
- `server/extraction.ts`: bounded document readers. A child process isolates parser failures, imposes a memory ceiling and timeout, and returns plain source text. No HTML from uploads is rendered, no macros run, no spreadsheet formulas execute.
- `server/export.ts`: a deep-copy snapshot and generic DOCX renderer. Both the JSON body and DOCX bytes are stored at export creation, so subsequent edits or library upgrades do not alter issued files.
- `server/backup.ts`: portable backup schema, evidence hash validation, and import as a separate assessment. Imported review authority is cleared. Full directory backup preserves issued snapshot files as well.
- `server/adapters.ts`: exact family/version/edition/hash/permission interface. Empty registry; all official requests are unsupported.
- `server/ai.ts`: optional provider and suggestion types; nothing is instantiated. Future suggestions must validate quoted passages, honor evidence exclusions, and cannot approve records.
- `src/main.tsx`: seven workspace sections; native labels, keyboard controls, visible focus, explicit saves, status announcements, human-readable statuses, and responsive layouts.

## Data and review lifecycle

An assessment owns its product configuration, answers, evidence metadata, tests, criteria, and history. Source files are stored under `data/files/<sha256>`; user filenames never select a filesystem path. Metadata includes product/version, upload time, extraction locations, and relevance.

Answers keep applicability independent of workflow state. Negative responses are not rewritten. Review records retain author, reviewer, review time, comments, and support category. Commands append an event containing the prior aggregate (without recursively embedding history) and the submitted command. This is an audit aid, not tamper-evident storage.

All product changes invalidate all approved answers and criterion judgments conservatively. Evidence metadata changes invalidate answers referencing it directly or through tests and judgments using affected tests. Test edits invalidate linked answers and old/new criterion judgments. Editing an approved answer requires review again. Existing export snapshots remain unchanged.

A criterion judgment is separate from each test outcome. Supports needs completed passing tests for the current version plus named scope acknowledgment. Non-applicability needs an explanation. There is no general Not Evaluated category. A final generic package may document Does Not Support and failed tests; missing information/review blocks final completion instead.

## Local security boundary

The server binds only to `127.0.0.1`, checks Host and Origin, rejects cross-site requests, and requires a custom header for mutations. There is no CORS permission. Production responses set a Content Security Policy. Local OS users are the trust boundary: there is no account system or verified identity. HTTP on loopback is used, not TLS.

The app requests private directory/file modes on POSIX systems. This does not provide encryption, anti-malware scanning, or protection from another process running as the same user. Evidence downloads use attachment disposition and a binary MIME type. Extracted text and user text are React text nodes. Secret files, SQLite, uploads, snapshots, backups, and local QA outputs are ignored by Git.

The aggregate design trades a simple prototype for write amplification: history stores prior state, including extracted text. It is suited to small local projects, not large enterprise repositories. File garbage collection and deletion workflows are deferred; rejected stale uploads can leave an unreferenced hash file. An owner can archive a complete local data directory.

## CU Launch and future work

No CU Launch protocol or deployment configuration was supplied, so none is invented. Preserve these seams for the next increment:

1. Establish platform licensing and exact template fixtures; build and independently verify one official version adapter.
2. Define CU Launch identity, tenancy, origins, storage, encryption/retention, backups, and deployment protocols before exposing a hosted service. Replace loopback trust with authenticated authorization and isolate each customer’s data.
3. Add structured standards catalogs with versioned criterion scope and official terminology rules. An empty registry must remain fail-closed.
4. If adding AI, require opt-in disclosure of exactly what leaves the machine, server-side credentials, evidence exclusions, citation verification, and suggestion-only commands. Source text remains data, including instructions embedded in documents.

The current JSON export is intentionally specific to Acronym; implement OpenACR as a separately validated adapter rather than relabeling it.
