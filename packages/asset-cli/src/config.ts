// Load AWS + bucket config from process.env. Fails loudly (throws)
// when a required var is missing — the CLI catches and prints a friendly
// error. Credentials are pulled by the AWS SDK automatically from
// AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN;
// we only need REGION + BUCKET here.
//
// This file must NEVER be imported by the browser bundle. It reads
// server-only environment variables.

export interface AssetCliConfig {
  region: string;
  bucketName: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AssetCliConfig {
  const region = env.AWS_REGION?.trim();
  const bucketName = env.S3_BUCKET_NAME?.trim();
  const missing: string[] = [];
  if (!region) missing.push("AWS_REGION");
  if (!bucketName) missing.push("S3_BUCKET_NAME");
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in the root .env or export them before running the CLI.`,
    );
  }
  // AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY are consumed implicitly by
  // the SDK — presence check only, no echo. Missing creds surface as an
  // S3 UnrecognizedClientException at PutObject time with a clear message.
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    console.warn(
      "[wc-asset] Warning: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not present in env.",
      "Uploads will fail unless an IAM role / instance profile supplies credentials.",
    );
  }
  return { region: region!, bucketName: bucketName! };
}
