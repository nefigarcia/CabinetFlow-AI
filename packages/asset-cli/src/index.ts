// Re-exports for programmatic consumption. The `bin.ts` file is the
// user-facing CLI entrypoint.

export { loadConfig, type AssetCliConfig } from "./config";
export {
  validateAndHashFile,
  type FileValidationOptions,
  type ValidatedFile,
} from "./file-validation";
export {
  uploadSceneAsset,
  type PutObjectFn,
  type PutObjectRequest,
  type UploadInput,
  type UploadResult,
} from "./uploader";
export {
  createS3Ops,
  createS3Uploader,
  type HeadObjectResult,
  type S3Ops,
} from "./s3-client";
export {
  verifyUpload,
  type HeadObjectFn,
  type VerifyIssue,
  type VerifyReport,
} from "./verify";
export {
  validateCatalog,
  type CatalogIssue,
} from "./catalog-validation";
export { parseUploadArgs, UsageError, usage, type UploadArgs } from "./argv";
