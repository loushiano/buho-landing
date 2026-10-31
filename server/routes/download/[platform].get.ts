import {
  canonicalPlatform,
  isPublicFileUrl,
  preferredDownload,
} from '#shared/release'
import { presignReleaseDownload, readReleaseManifest } from '../../utils/release-manifest'

export default defineEventHandler(async (event) => {
  const platform = canonicalPlatform(getRouterParam(event, 'platform') || '')
  if (!platform) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Unknown download platform. Use /download/windows or /download/mac.',
    })
  }

  const manifest = await readReleaseManifest(event)
  const download = preferredDownload(manifest.downloads, platform)
  if (!download) {
    throw createError({
      statusCode: 404,
      statusMessage: platform === 'windows'
        ? 'No Windows installer is in the latest release.'
        : 'No Mac installer is in the latest release.',
    })
  }

  const url = await presignReleaseDownload(event, manifest.version, download.file)
  if (!isPublicFileUrl(url)) {
    throw createError({
      statusCode: 502,
      statusMessage: 'The installer link could not be signed.',
    })
  }

  setResponseHeader(event, 'cache-control', 'private, no-store')
  return sendRedirect(event, url, 302)
})
