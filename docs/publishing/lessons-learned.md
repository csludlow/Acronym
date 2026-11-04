# CU Launch import preparation

Request: `cmw2fde0x00o4qkj2q3wfalkm`. Updated 2026-11-04.

The source repository remains `https://github.com/csludlow/Acronym` (`origin`). CU Launch’s managed repository is `https://github.com/cu-app-portal-repos/acronym` (`portal`). Fetch and fast-forward from the managed repository before making changes; push prepared changes there.

## Package compatibility correction

CU Launch rejected `pnpm-lock.yaml` and `pnpm-workspace.yaml`. The workspace file only allowed esbuild’s install script; this was already a single root Express application, with a start script in the root package. Removed both pnpm files and changed setup instructions and CI to npm. Express, React/Vite, routes, data, assets, and history are preserved.

CU Launch explicitly supports `npm install` without a lockfile. This fallback is used because the local system and bundled runtime provide Node 24 and pnpm but no npm executable, and the request prohibits downloading development runtimes merely because one is missing. Local checks use installed dependencies; GitHub CI checks fresh npm resolution. No hand-written npm lockfile is substituted. Dependency resolution is not reproducible until a real npm-generated lockfile is verified and committed.

No deployment manifest, Azure workflow, static runner, resources, managed database, or Cedarville login has been invented. The supplied app-local CU Launch skill was restored exactly. The existing public health endpoint remains unchanged.

## Hosted-operation boundary

Passing package compatibility does not prove Azure operation. This prototype still binds to localhost and accepts only localhost hosts/origins; it uses SQLite and local evidence files, and has no login or user isolation. Keep local behavior intact until CU Launch generates publishing guidance and the hosted trust/storage model is deliberately addressed. Runtime must provide Node 24 or newer for built-in SQLite. Adobe’s font kit currently permits localhost; a future host needs an authorized kit-domain update.

No live deployment or portal preparation has been verified. First publish requires separate authorization. If the app is already published with auto-deploy enabled, pushing the managed default branch starts deployment; a successful Git push alone does not prove the app is live.
