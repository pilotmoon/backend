#!/usr/bin/env bun
import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

type Options = {
  directory: string;
  dryRun: boolean;
};

function printUsage() {
  console.log(`Usage: bun scripts/upload-files.ts <directory> [--dry-run]

Environment:
  ROLO_FILES_URL   Base URL for the files endpoint (default: http://localhost:3000/files)
  ROLO_API_KEY     Bearer token used for Authorization header (required)

Options:
  --dry-run        Log each file without uploading`);
}

function parseArgs(argv: string[]): Options {
  const args = argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }
  let directory = "";
  let dryRun = false;
  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("-")) {
      printUsage();
      process.exit(1);
    }
    if (!directory) {
      directory = arg;
    } else {
      printUsage();
      process.exit(1);
    }
  }
  if (!directory) {
    printUsage();
    process.exit(1);
  }
  return { directory, dryRun };
}

async function* walk(dir: string, base: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath, base);
    } else if (entry.isFile()) {
      const rel = relative(base, fullPath).split(sep).join("/");
      yield rel;
    }
  }
}

async function main() {
  const { directory, dryRun } = parseArgs(process.argv);
  const root = resolve(directory);
  try {
    const stats = await stat(root);
    if (!stats.isDirectory()) {
      console.error(`Not a directory: ${root}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Unable to access ${root}:`, (error as Error).message);
    process.exit(1);
  }

  const apiUrl = process.env.ROLO_FILES_URL ?? "http://localhost:3000/files";
  const apiKey = process.env.ROLO_API_KEY;
  if (!apiKey) {
    console.error("ROLO_API_KEY must be set with a bearer token");
    process.exit(1);
  }

  let count = 0;
  for await (const relPath of walk(root, root)) {
    count += 1;
    if (dryRun) {
      console.log(`[dry-run] ${relPath}`);
      continue;
    }
    const url = new URL(apiUrl);
    url.searchParams.set("name", relPath);
    const bunFile = Bun.file(join(root, relPath));
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/octet-stream",
      },
      body: bunFile.stream(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(
        `Failed to upload ${relPath}: ${response.status} ${response.statusText} ${text}`,
      );
      process.exitCode = 1;
    } else {
      console.log(`Uploaded ${relPath}`);
    }
  }
  if (count === 0) {
    console.log("No files found to upload");
  }
}

await main();
