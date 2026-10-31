import {
  canonicalPlatform,
  isPublicFileUrl,
  preferredDownload,
} from '../../../shared/release'
import { readReleaseManifest } from '../../utils/release-manifest'

export default defineEventHandler(async (event) => {
  const platform = canonicalPlatform(getRouterParam(event, 'platform') || '')
  if (!platform) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Unknown download platform. Use /download/windows or /download/mac.',
    })
  }

  const manifest = await readReleaseManifest()
  const download = preferredDownload(manifest.downloads, platform)
  if (!download || !isPublicFileUrl(download.url)) {
    throw createError({
      statusCode: 404,
      statusMessage: platform === 'windows'
        ? 'No Windows installer is in the latest release.'
        : 'No Mac installer is in the latest release.',
    })
  }

  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return sendRedirect(event, download.url, 302)
})
