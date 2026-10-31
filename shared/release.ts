export type ReleaseDownload = {
  platform: 'windows' | 'macos' | 'linux'
  name: string
  file: string
  url: string
  sha256: string
}

export type ReleaseManifest = {
  version: string
  publishedAt: string
  notes: string
  downloads: ReleaseDownload[]
}

export function isReleaseManifest(value: unknown): value is ReleaseManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as ReleaseManifest
  return typeof manifest.version === 'string'
    && typeof manifest.publishedAt === 'string'
    && typeof manifest.notes === 'string'
    && Array.isArray(manifest.downloads)
    && manifest.downloads.every(download =>
      download
      && typeof download.platform === 'string'
      && typeof download.name === 'string'
      && typeof download.file === 'string'
      && typeof download.url === 'string'
      && typeof download.sha256 === 'string',
    )
}

export type DownloadPlatform = 'windows' | 'macos'

export function canonicalPlatform(value: string): DownloadPlatform | null {
  const key = value.trim().toLowerCase()
  if (key === 'windows' || key === 'win') return 'windows'
  if (key === 'mac' || key === 'macos' || key === 'osx') return 'macos'
  return null
}

export function latestDownloadPath(platform: DownloadPlatform): '/download/windows' | '/download/mac' {
  return platform === 'windows' ? '/download/windows' : '/download/mac'
}

export function isPublicFileUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function windowsRank(file: string): number {
  const name = file.toLowerCase()
  const format = name.endsWith('.exe') ? 0 : name.endsWith('.msi') ? 10 : 20
  const arm = name.includes('arm64') || name.includes('aarch64') ? 1 : 0
  return format + arm
}

function macRank(file: string): number {
  const name = file.toLowerCase()
  if (!name.endsWith('.dmg')) return 20
  if (name.includes('universal')) return 0
  if (name.includes('aarch64') || name.includes('arm64')) return 1
  if (name.includes('x64') || name.includes('x86_64') || name.includes('amd64')) return 2
  return 1
}

export function preferredDownload(
  downloads: ReleaseDownload[],
  platform: DownloadPlatform,
): ReleaseDownload | null {
  const matches = downloads.filter(download => download.platform === platform)
  if (matches.length === 0) return null
  const rank = platform === 'windows' ? windowsRank : macRank
  return matches.slice().sort((left, right) => {
    const byRank = rank(left.file) - rank(right.file)
    if (byRank !== 0) return byRank
    return left.file.localeCompare(right.file)
  })[0]
}
