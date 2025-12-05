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
   - Use the GridFS `files` documents themselves as metadata: rely on the
     document `_id` as the canonical identifier (exposed externally as
     `file_<ObjectId>`), store the visibility flag in `metadata.hidden`, and
     stamp creation dates directly on the GridFS document.
   - Implement repository functions for create/read/update-visibility that
     coordinate GridFS writes/reads only—no parallel metadata collection.
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
   - Note the reliance on GridFS indexes (`filename`, `metadata.hidden`,
     `created`) alongside the default `_id` and ensure deployment instructions
     mention building them with the bucket.
