# Files Record & GridFS Integration Plan

## Goals

- Introduce a `files` entity to Rolo that stores arbitrarily large payloads with
  metadata similar to other records.
- Back file contents with MongoDB GridFS to avoid current Blob size limits while
  keeping storage close to the rest of the Rolo data.
- Expose API endpoints that allow uploading, retrieving, and listing files by
  both unique `fileId` and unique `name`.

## Work Plan

1. **Data Contracts & Validation**
   - Add Zod schemas for file creation and lookup in `src/common` (fields:
     `fileId`, `name`, `size`, `created`, `hidden` flag for availability).
   - Define filename rules (allow slashes, reject traversal and duplicate
     separators) and ensure uniqueness on `name`.
   - Update TypeScript types shared between services and tests.
2. **Persistence & GridFS Wiring**
   - Extend the Mongo helper to initialize a `GridFSBucket` (e.g.,
     `filesBucket`) configured for the `files` namespace.
   - Create a new `files` collection for metadata with unique indexes on
     `fileId` and `name`, referencing the GridFS `_id` and storing the `hidden`
     flag for soft deletes (defaulting to `false` on insert).
   - Implement repository functions for create/read/update-visibility that
     coordinate metadata writes and GridFS streams without ever replacing
     content once created.
3. **API Layer**
   - Add new routes/controllers under `src/rolo/files` for `POST /files`,
     `GET /files` (paginated), `GET /files/:fileId`, and `GET /files/:name`.
   - Handle uploads via streaming (raw body with `X-File-Name`) and return
     `fileId` plus metadata; enforce conflicts on duplicate names and default
     new files to `hidden: false`.
   - When retrieving by name, stream the binary contents as
     `application/octet-stream`; when retrieving by `fileId`, return a JSON
     metadata payload consistent with other records.
4. **Testing**
   - Expand AVA suites (`test/rolo/files`) to cover happy paths, duplicate name
     errors, and streaming downloads, using an in-memory Mongo or dedicated test
     database.
   - Add integration tests for the HTTP endpoints and repository-level unit
     tests for metadata/index behavior.
5. **Docs & Ops Updates**
   - Document the new endpoints in README/AGENTS, including sample `curl`
     commands.
   - Note any new environment variables (e.g., bucket names) and update `.env-*`
     templates if necessary.
   - Provide migration notes for deploying indexes on existing Mongo instances.
