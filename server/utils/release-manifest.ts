import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { isError, type H3Event } from 'h3'
import { isPublicFileUrl, isReleaseManifest, type ReleaseManifest } from '#shared/release'
import {
  installerObjectKey,
  latestManifestKey,
  resolveReleaseStorageConfig,
  UnsafeReleaseKeyError,
  type ReleaseStorageProblem,
  type ResolvedReleaseStorage,
} from './release-storage'

// Presigned links outlive the 60s API cache. The SDK default is 15 minutes.
const PRESIGN_SECONDS = 900

const storageProblemMessage: Record<ReleaseStorageProblem, string> = {
  'missing-bucket': 'Set S3_BUCKET or NUXT_S3_BUCKET to the private release bucket.',
  'missing-region': 'Set AWS_REGION or NUXT_AWS_REGION for the private release bucket.',
  'partial-credentials': 'Set both AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or leave both empty to use the default AWS credential chain.',
}

let cachedClient: { key: string, client: S3Client } | undefined

function releaseStorage(event: H3Event): ResolvedReleaseStorage {
  const runtime = useRuntimeConfig(event)
  const resolved = resolveReleaseStorageConfig({
    s3Bucket: runtime.s3Bucket,
    awsRegion: runtime.awsRegion,
    awsAccessKeyId: runtime.awsAccessKeyId,
    awsSecretAccessKey: runtime.awsSecretAccessKey,
    s3ReleasePrefix: runtime.s3ReleasePrefix,
    env: process.env,
  })
  if (!resolved.ok) {
    throw createError({
      statusCode: 500,
      statusMessage: storageProblemMessage[resolved.problem],
    })
  }
  return resolved.config
}

function s3Client(config: ResolvedReleaseStorage): S3Client {
  const key = [
    config.region,
    config.credentials?.accessKeyId ?? '',
    config.credentials?.secretAccessKey ?? '',
  ].join('\0')
  if (cachedClient?.key === key) return cachedClient.client

  cachedClient?.client.destroy()
  // WHEN_REQUIRED keeps checksum headers out of presigned GETs, so a browser
  // can follow the redirect without sending x-amz-checksum-mode.
  const client = new S3Client({
    region: config.region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    ...(config.credentials ? { credentials: config.credentials } : {}),
  })
  cachedClient = { key, client }
  return client
}

function s3Failure(error: unknown, action: 'read' | 'sign') {
  const name = error && typeof error === 'object' && 'name' in error
    ? String((error as { name: unknown }).name)
    : ''
  const status = error && typeof error === 'object' && '$metadata' in error
    ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
    : undefined

  if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
    return createError({
      statusCode: 404,
      statusMessage: 'No release has been published yet.',
    })
  }
  if (name === 'CredentialsProviderError') {
    return createError({
      statusCode: 500,
      statusMessage: 'AWS credentials are not configured for the private release bucket.',
    })
  }
  console.error(
    action === 'sign'
      ? 'Failed to sign a release download'
      : 'Failed to read the release manifest from S3',
    name || error,
  )
  return createError({
    statusCode: 502,
    statusMessage: action === 'sign'
      ? 'The installer link could not be signed.'
      : 'The release manifest could not be read from S3.',
  })
}

function manifestKey(config: ResolvedReleaseStorage): string {
  try {
    return latestManifestKey(config.prefix)
  } catch (error) {
    if (error instanceof UnsafeReleaseKeyError) {
      throw createError({
        statusCode: 500,
        statusMessage: 'S3_RELEASE_PREFIX is not a safe releases path.',
      })
    }
    throw error
  }
}

function installerKey(config: ResolvedReleaseStorage, version: string, file: string): string {
  try {
    return installerObjectKey(config.prefix, version, file)
  } catch (error) {
    if (error instanceof UnsafeReleaseKeyError) {
      throw createError({
        statusCode: 404,
        statusMessage: 'The latest release does not include a signable installer.',
      })
    }
    throw error
  }
}

export async function readReleaseManifest(event: H3Event): Promise<ReleaseManifest> {
  const config = releaseStorage(event)
  const client = s3Client(config)
  try {
    const output = await client.send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: manifestKey(config),
    }))
    const text = await output.Body?.transformToString()
    if (!text) {
      throw createError({
        statusCode: 502,
        statusMessage: 'The release manifest could not be read from S3.',
      })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: 'The release manifest is missing version, notes, or downloads.',
      })
    }
    if (!isReleaseManifest(parsed)) {
      throw createError({
        statusCode: 502,
        statusMessage: 'The release manifest is missing version, notes, or downloads.',
      })
    }
    return parsed
  } catch (error) {
    if (isError(error)) throw error
    throw s3Failure(error, 'read')
  }
}

export async function presignReleaseDownload(event: H3Event, version: string, file: string): Promise<string> {
  const config = releaseStorage(event)
  const key = installerKey(config, version, file)
  try {
    const url = await getSignedUrl(
      s3Client(config),
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${file}"`,
      }),
      { expiresIn: PRESIGN_SECONDS },
    )
    if (!isPublicFileUrl(url)) {
      throw createError({
        statusCode: 502,
        statusMessage: 'The installer link could not be signed.',
      })
    }
    return url
  } catch (error) {
    if (isError(error)) throw error
    throw s3Failure(error, 'sign')
  }
}
