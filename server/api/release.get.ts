import { presignReleaseDownload, readReleaseManifest } from '../utils/release-manifest'

export default defineEventHandler(async (event) => {
  const manifest = await readReleaseManifest(event)
  // latest.json stores public object URLs. The bucket is private, so replace
  // them with presigned links for the same releases/<version>/<file> keys.
  const downloads = await Promise.all(manifest.downloads.map(async download => ({
    ...download,
    url: await presignReleaseDownload(event, manifest.version, download.file),
  })))

  setResponseHeader(event, 'cache-control', 'private, max-age=60')
  return { ...manifest, downloads }
})
