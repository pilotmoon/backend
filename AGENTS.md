# Repository Guidelines

## Project Structure & Module Organization

TypeScript sources live under `src/`, split into `src/rolo` (primary API),
`src/twix` (adapters for external services), and `src/common` (shared
validation, mailers, and data helpers). Build artifacts land in `dist/` via the
TypeScript compiler; never edit files there directly. Unit, service, and
integration tests live in `test/` (for example `test/unit` and `test/rolo`), and
are compiled during `npm run build` so the runtime looks in `dist/test`.
Environment helpers and local runner scripts live in `scripts/`, while
configuration such as `tsconfig.json` and `biome.json` sit at the repository
root.

## Build, Test, and Development Commands

Use Node `22.17.0` (enforced in `package.json`). Run `npm run build` to
type-check and emit JavaScript, or `npm run check` when you only need static
type validation. `npm run dev-rolo` and `npm run dev-twix` wrap `tsc-watch`,
automatically sourcing `.env-rolo` or `.env-twix` through `scripts/env` and
restarting the appropriate server. Production entry points are
`npm run start-rolo` and `npm run start-twix`, which execute the `dist` builds.
Deploy by pushing `main` to the `deploy` branch via `npm run deploy`, which
mirrors the convention used in CI.

## Coding Style & Naming Conventions

All code must pass Biome (`npm exec biome lint .`) which enforces space
indentation, organized imports, and the repository’s TypeScript style defaults.
Follow camelCase for functions and variables, PascalCase for classes, and
kebab-case for filenames and directories (matching existing `src/rolo`). Shared
DTOs and validators live in `src/common`; prefer reusing these instead of
redefining schemas inside service folders. Keep modules focused: routers in
`src/*/routes`, services in `src/*/services`, and helpers alongside their
feature.

## Testing Guidelines

Ava (`ava` in `devDependencies`) drives all tests. Keep specs colocated in
`test/<area>` and mirror the runtime folder structure, naming files `test*.ts`
(see `test/testRolo.ts`). Prefer letting the maintainer run suites such as
`bun run test-local`; this environment often lacks the running services those
suites require, so avoid invoking them unless explicitly asked. Add targeted
tests with every feature (for example `test/rolo/testFiles.ts` validates GridFS
uploads/downloads) and update snapshots or fixtures alongside the change. The
local scripts compile sources, hydrate secrets via `scripts/env`, and source
`.env-rolotest` or `.env-twixtest`, so ensure those templates stay current.

## Commit & Pull Request Guidelines

Git history favors concise, imperative summaries (`update fudge with small fix`,
`change test to 7.0 and 8.0`). Follow that pattern, mentioning the component
(rolo, twix, common) first when possible. Each pull request should include: a
brief problem statement, the solution outline, commands/tests executed (copy
relevant `npm run …` lines), and references to Linear/Jira issues. Attach
screenshots or sample payloads for API changes, and note any schema or
environment updates so reviewers can regenerate `.env-*` files.

## Files & GridFS Storage

Rolo now exposes `/files` for large payloads backed by MongoDB GridFS. Upload by
sending the raw file body to `POST /files?name=<path>`; new files default to
visible (`hidden: false`). Retrieve metadata via `GET /files/{fileId}` while
`GET /files/{file/path.ext}` streams binary data as `application/octet-stream`,
gated by the `hidden` flag. Use `PATCH /files/{fileId}` with
`{ "hidden": true }` for soft-delete behavior—names stay unique forever so no
replacements occur. Keep shared schemas in `src/common/fileSchemas.ts`,
controllers in `src/rolo/controllers/filesController.ts`, and update tests
whenever storage or routing is adjusted.

## Security & Configuration Tips

Never commit `.env-*`; use `scripts/env` to materialize secrets via `op inject`
and keep templates updated when variables change. Scripts set `COMMIT_HASH` for
runtime introspection, so ensure the git state is clean before running
long-lived dev servers. Validate any new third-party integration in `src/twix`
with sandbox credentials first, and document required keys in the corresponding
template file.
