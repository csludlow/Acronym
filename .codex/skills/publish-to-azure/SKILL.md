---
name: publish-to-azure
description: Use when an older CU Launch-managed Cedarville app or prompt asks Codex to publish to Azure from this repository.
---

# Publish to Azure

Use the `cu-app-portal` skill for this CU Launch-managed app.

Direct Azure-first publishing is now a recovery path, not the default path for CU Launch-managed apps. Read `app-portal/deployment-manifest.json`, then prefer CU Launch for publishing setup, Repair Publishing Setup, first publish, push-to-deploy settings, GitHub access, collaborator workflows, and scoped deletion.

Ask the user for permission before using the CU Launch plugin or connector, and wait for approval before calling any of its tools. Once approved, use it only within the user's authorized scope. Browser, Computer Use, and Chrome may access and operate CU Launch when the user asks for that method. Follow the cu-app-portal skill's access and authorization guidance, including required confirmations and secure sign-in.
