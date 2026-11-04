# Publishing Lessons Learned

Record manual fixes and deployment blockers here.

## Read-only investigation without personal Azure login

`.github/workflows/diagnose-azure.yml` is manual-only and restricted to main. It reuses CU Launch's existing deployment identity and OIDC trust to read this app's state, configuration, plan state, and deployment results. It does not provision, restart, publish, repair, change settings, or broaden permissions. No personal Azure login is used. The Python helper prints selected status fields and recognized error classes; raw logs, CLI errors, credentials, and HTTP response bodies are suppressed. Endpoint probes do not follow redirects.

The initial diagnostic-only commit uses `[skip ci]` to prevent the existing push-to-deploy workflow from running; diagnostics are then dispatched explicitly. The application/typography fixes remain in draft PR #2. Future ordinary main pushes still trigger the existing deployment workflow.

Local checks: three isolated fixtures verify read-only commands, redaction, host validation and no redirect following; workflow YAML parses through Prettier.
