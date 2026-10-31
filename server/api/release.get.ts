import { readReleaseManifest } from '../utils/release-manifest'

export default defineEventHandler(async (event) => {
  const manifest = await readReleaseManifest()
  setResponseHeader(event, 'cache-control', 'public, max-age=60')
  return manifest
})
