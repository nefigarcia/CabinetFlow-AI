import {
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { PutObjectFn, PutObjectRequest } from "./uploader";

// Thin AWS-SDK wrapper. The rest of the CLI depends only on the small
// interfaces defined below, so unit tests never touch the SDK. This
// file is the ONLY module that instantiates an S3Client.

export interface HeadObjectResult {
  contentType?: string;
  contentLength?: number;
  cacheControl?: string;
  eTag?: string;
  metadata?: Record<string, string>;
}

export interface S3Ops {
  put: PutObjectFn;
  headBucket: (bucket: string) => Promise<void>;
  listObjectsV2: (bucket: string, prefix: string, maxKeys: number) => Promise<{ keys: string[] }>;
  headObject: (bucket: string, key: string) => Promise<HeadObjectResult>;
}

export function createS3Ops(region: string): S3Ops {
  const client = new S3Client({ region });
  return {
    put: async (req: PutObjectRequest) => {
      await client.send(
        new PutObjectCommand({
          Bucket: req.bucket,
          Key: req.key,
          Body: req.body,
          ContentType: req.contentType,
          CacheControl: req.cacheControl,
          Metadata: req.metadata,
        }),
      );
    },
    headBucket: async (bucket: string) => {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    },
    listObjectsV2: async (bucket: string, prefix: string, maxKeys: number) => {
      const out = await client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: maxKeys }),
      );
      return { keys: (out.Contents ?? []).map((o) => o.Key ?? "").filter((k) => k.length > 0) };
    },
    headObject: async (bucket: string, key: string) => {
      const out = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return {
        contentType: out.ContentType,
        contentLength: out.ContentLength,
        cacheControl: out.CacheControl,
        eTag: out.ETag,
        metadata: out.Metadata,
      };
    },
  };
}

/** Backwards-compat shim — earlier tests / callers only needed a put. */
export function createS3Uploader(region: string): PutObjectFn {
  return createS3Ops(region).put;
}
