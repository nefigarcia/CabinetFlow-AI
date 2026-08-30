import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

// Filesystem-side validation for the upload CLI. Kept in a small module
// so the AWS-facing uploader stays testable with mocks — we don't have
// to touch the network to exercise these checks.

export interface ValidatedFile {
  /** Absolute resolved path. */
  absolutePath: string;
  /** File name (with extension) — used for MIME detection. */
  basename: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** SHA-256 hex digest of the file contents. */
  sha256: string;
  /** The file contents (Buffer) — kept for a single PutObject write. */
  body: Buffer;
}

export interface FileValidationOptions {
  /** Whitelist of extensions (with dot, lower-case). Reject on mismatch. */
  allowedExtensions: readonly string[];
  /** Optional hard cap. Advisory limits are handled elsewhere (fileSizeAdvice). */
  maxBytes?: number;
  /** For GLB: require the standard 4-byte magic header `glTF` at offset 0. */
  requireGlbHeader?: boolean;
}

const GLB_MAGIC = Buffer.from("glTF", "ascii");

/**
 * Validates + hashes a candidate file. Throws with a clear message on:
 *   · path traversal outside the current working directory
 *   · file missing / not a regular file
 *   · unsupported extension
 *   · exceeds `maxBytes`
 *   · GLB header check failure (when `requireGlbHeader` is set)
 */
export async function validateAndHashFile(
  path: string,
  options: FileValidationOptions,
): Promise<ValidatedFile> {
  const absolutePath = resolve(process.cwd(), path);
  // Path-traversal defense: after resolving, insist the file lives inside
  // the working directory tree. This blocks `../../etc/passwd` style
  // shenanigans when the CLI is scripted.
  const cwd = process.cwd();
  if (!absolutePath.startsWith(cwd)) {
    throw new Error(
      `Refusing to upload a file outside the working directory: ${absolutePath}`,
    );
  }

  const info = await stat(absolutePath).catch((e: unknown) => {
    throw new Error(`Cannot stat "${path}": ${(e as Error).message}`);
  });
  if (!info.isFile()) {
    throw new Error(`Path "${path}" is not a regular file.`);
  }

  const bn = basename(absolutePath);
  const ext = extname(bn);
  if (!options.allowedExtensions.includes(ext)) {
    throw new Error(
      `Unsupported extension "${ext}" for "${bn}". Allowed: ${options.allowedExtensions.join(", ")}`,
    );
  }

  if (options.maxBytes !== undefined && info.size > options.maxBytes) {
    throw new Error(
      `File "${bn}" is ${info.size} bytes; exceeds hard cap of ${options.maxBytes} bytes.`,
    );
  }

  const body = await readFile(absolutePath);

  if (options.requireGlbHeader) {
    if (body.length < 4 || !body.subarray(0, 4).equals(GLB_MAGIC)) {
      throw new Error(
        `File "${bn}" does not begin with the GLB magic header 'glTF'. Refusing to upload.`,
      );
    }
  }

  const sha256 = createHash("sha256").update(body).digest("hex");

  return { absolutePath, basename: bn, sizeBytes: info.size, sha256, body };
}

function extname(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0) return "";
  return filename.slice(idx).toLowerCase();
}
