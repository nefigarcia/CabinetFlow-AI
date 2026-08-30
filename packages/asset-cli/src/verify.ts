import {
  IMMUTABLE_CACHE_CONTROL,
  toS3ObjectKey,
  type AssetUploadManifest,
} from "@woodcraft/shared";
import type { HeadObjectResult } from "./s3-client";

// Post-upload verification. Compares S3 HeadObject output against what
// the manifest says WE uploaded. Any drift is reported as a failure so
// we don't silently ship a wrong Content-Type / Cache-Control.

export interface VerifyIssue {
  key: string;
  message: string;
}

export interface VerifyReport {
  ok: boolean;
  issues: VerifyIssue[];
  checked: { key: string; assetKey: string }[];
}

export interface HeadObjectFn {
  (bucket: string, key: string): Promise<HeadObjectResult>;
}

export async function verifyUpload(input: {
  bucket: string;
  manifest: AssetUploadManifest;
  headObject: HeadObjectFn;
}): Promise<VerifyReport> {
  const { bucket, manifest, headObject } = input;
  const issues: VerifyIssue[] = [];
  const checked: { key: string; assetKey: string }[] = [];

  const files: Array<{
    assetKey: string;
    sizeBytes: number;
    contentType: string;
  }> = [
    {
      assetKey: manifest.model.assetKey,
      sizeBytes: manifest.model.sizeBytes,
      contentType: manifest.model.contentType,
    },
  ];
  if (manifest.thumbnail) {
    files.push({
      assetKey: manifest.thumbnail.assetKey,
      sizeBytes: manifest.thumbnail.sizeBytes,
      contentType: manifest.thumbnail.contentType,
    });
  }

  for (const f of files) {
    const physicalKey = toS3ObjectKey(f.assetKey);
    if (!physicalKey) {
      issues.push({
        key: f.assetKey,
        message: `Refused to HeadObject — logical assetKey failed normalization: "${f.assetKey}"`,
      });
      continue;
    }
    checked.push({ key: physicalKey, assetKey: f.assetKey });
    let head: HeadObjectResult;
    try {
      head = await headObject(bucket, physicalKey);
    } catch (err) {
      issues.push({
        key: physicalKey,
        message: `HeadObject failed: ${(err as Error).message}`,
      });
      continue;
    }
    if (head.contentType !== f.contentType) {
      issues.push({
        key: physicalKey,
        message: `Content-Type mismatch — expected "${f.contentType}", got "${head.contentType ?? "(unset)"}".`,
      });
    }
    if (head.cacheControl !== IMMUTABLE_CACHE_CONTROL) {
      issues.push({
        key: physicalKey,
        message: `Cache-Control mismatch — expected "${IMMUTABLE_CACHE_CONTROL}", got "${head.cacheControl ?? "(unset)"}".`,
      });
    }
    if (head.contentLength !== f.sizeBytes) {
      issues.push({
        key: physicalKey,
        message: `Content-Length mismatch — expected ${f.sizeBytes}, got ${head.contentLength ?? "(unset)"}.`,
      });
    }
    if (!head.metadata || head.metadata["source-name"] !== manifest.provenance.sourceName) {
      issues.push({
        key: physicalKey,
        message: `Provenance metadata "source-name" missing or mismatched.`,
      });
    }
    if (!head.metadata || head.metadata["license"] !== manifest.provenance.license) {
      issues.push({
        key: physicalKey,
        message: `Provenance metadata "license" missing or mismatched.`,
      });
    }
  }

  return { ok: issues.length === 0, issues, checked };
}
