// desktop-shell publishes to s3://<bucket>/releases/latest.json
// and s3://<bucket>/releases/<version>/<file>.

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/

export class UnsafeReleaseKeyError extends Error {
  constructor(value: string) {
    super(`Unsafe release object name: ${value}`)
    this.name = 'UnsafeReleaseKeyError'
  }
}

export type ReleaseCredentials = {
  accessKeyId: string
  secretAccessKey: string
}

export type ResolvedReleaseStorage = {
  bucket: string
  region: string
  prefix: string
  credentials?: ReleaseCredentials
}

export type ReleaseStorageProblem = 'missing-bucket' | 'missing-region' | 'partial-credentials'

export type ResolvedReleaseStorageResult =
  | { ok: true, config: ResolvedReleaseStorage }
  | { ok: false, problem: ReleaseStorageProblem }

type ReleaseStorageInput = {
  s3Bucket?: unknown
  awsRegion?: unknown
  awsAccessKeyId?: unknown
  awsSecretAccessKey?: unknown
  s3ReleasePrefix?: unknown
  env?: Record<string, string | undefined>
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function segment(value: string): string {
  if (!SAFE_SEGMENT.test(value)) throw new UnsafeReleaseKeyError(value)
  return value
}

export function normalizeReleasePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, '')
  const parts = trimmed.split('/')
  if (!trimmed || parts.some(part => !SAFE_SEGMENT.test(part))) {
    throw new UnsafeReleaseKeyError(prefix)
  }
  return parts.join('/')
}

export function latestManifestKey(prefix: string): string {
  return `${normalizeReleasePrefix(prefix)}/latest.json`
}

export function installerObjectKey(prefix: string, version: string, file: string): string {
  return `${normalizeReleasePrefix(prefix)}/${segment(version)}/${segment(file)}`
}

export function resolveReleaseStorageConfig(input: ReleaseStorageInput = {}): ResolvedReleaseStorageResult {
  const env = input.env ?? {}
  const bucket = text(input.s3Bucket) || text(env.S3_BUCKET)
  const region = text(input.awsRegion) || text(env.AWS_REGION) || text(env.AWS_DEFAULT_REGION)
  const prefix = text(input.s3ReleasePrefix) || text(env.S3_RELEASE_PREFIX) || 'releases'
  const accessKeyId = text(input.awsAccessKeyId) || text(env.AWS_ACCESS_KEY_ID)
  const secretAccessKey = text(input.awsSecretAccessKey) || text(env.AWS_SECRET_ACCESS_KEY)

  if (!bucket) return { ok: false, problem: 'missing-bucket' }
  if (!region) return { ok: false, problem: 'missing-region' }
  if ((accessKeyId && !secretAccessKey) || (!accessKeyId && secretAccessKey)) {
    return { ok: false, problem: 'partial-credentials' }
  }

  return {
    ok: true,
    config: {
      bucket,
      region,
      prefix,
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    },
  }
}
