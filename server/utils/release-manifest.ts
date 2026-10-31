import { isReleaseManifest, type ReleaseManifest } from '../../shared/release'

export async function readReleaseManifest(): Promise<ReleaseManifest> {
  const url = useRuntimeConfig().public.releasesManifestUrl
  if (!url) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Set NUXT_PUBLIC_RELEASES_MANIFEST_URL to the public latest.json URL.',
    })
  }

  let body: unknown
  try {
    body = await $fetch(url)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'The release manifest could not be read from S3.',
    })
  }

  if (!isReleaseManifest(body)) {
    throw createError({
      statusCode: 502,
      statusMessage: 'The release manifest is missing version, notes, or downloads.',
    })
  }

  return body
}
