import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canonicalPlatform,
  isPublicFileUrl,
  latestDownloadPath,
  preferredDownload,
  type ReleaseDownload,
} from '../shared/release.ts'

const windowsExe: ReleaseDownload = {
  platform: 'windows',
  name: 'Windows',
  file: 'Buho_0.1.0_x64-setup.exe',
  url: 'https://cdn.example/releases/0.1.0/Buho_0.1.0_x64-setup.exe',
  sha256: 'exe',
}

const windowsMsi: ReleaseDownload = {
  ...windowsExe,
  file: 'Buho_0.1.0_x64_en-US.msi',
  url: 'https://cdn.example/releases/0.1.0/Buho_0.1.0_x64_en-US.msi',
  sha256: 'msi',
}

const windowsArm: ReleaseDownload = {
  ...windowsExe,
  file: 'Buho_0.1.0_arm64-setup.exe',
  url: 'https://cdn.example/releases/0.1.0/Buho_0.1.0_arm64-setup.exe',
  sha256: 'arm',
}

const macArm: ReleaseDownload = {
  platform: 'macos',
  name: 'macOS',
  file: 'Buho_0.1.0_aarch64.dmg',
  url: 'https://cdn.example/releases/0.1.0/Buho_0.1.0_aarch64.dmg',
  sha256: 'arm-dmg',
}

const macIntel: ReleaseDownload = {
  ...macArm,
  file: 'Buho_0.1.0_x64.dmg',
  url: 'https://cdn.example/releases/0.1.0/Buho_0.1.0_x64.dmg',
  sha256: 'x64-dmg',
}

const macUniversal: ReleaseDownload = {
  ...macArm,
  file: 'Buho_0.1.0_universal.dmg',
  url: 'https://cdn.example/releases/0.1.0/Buho_0.1.0_universal.dmg',
  sha256: 'universal-dmg',
}

describe('preferredDownload', () => {
  it('picks the Windows setup exe over an msi', () => {
    assert.equal(preferredDownload([windowsMsi, windowsExe], 'windows'), windowsExe)
  })

  it('picks the x64 Windows setup over an arm64 setup', () => {
    assert.equal(preferredDownload([windowsArm, windowsExe], 'windows'), windowsExe)
  })

  it('picks a universal Mac image, then Apple silicon, then Intel', () => {
    assert.equal(preferredDownload([macIntel, macArm, macUniversal], 'macos'), macUniversal)
    assert.equal(preferredDownload([macIntel, macArm], 'macos'), macArm)
    assert.equal(preferredDownload([macIntel], 'macos'), macIntel)
  })

  it('returns null when that platform has no installer', () => {
    assert.equal(preferredDownload([windowsExe], 'macos'), null)
  })
})

describe('latest download links', () => {
  it('uses stable paths that can be shared', () => {
    assert.equal(latestDownloadPath('windows'), '/download/windows')
    assert.equal(latestDownloadPath('macos'), '/download/mac')
  })

  it('accepts the public platform names', () => {
    assert.equal(canonicalPlatform('windows'), 'windows')
    assert.equal(canonicalPlatform('Mac'), 'macos')
    assert.equal(canonicalPlatform('macos'), 'macos')
    assert.equal(canonicalPlatform('linux'), null)
  })

  it('only redirects to http(s) file urls', () => {
    assert.equal(isPublicFileUrl(windowsExe.url), true)
    assert.equal(isPublicFileUrl('http://127.0.0.1:8765/Buho.exe'), true)
    assert.equal(isPublicFileUrl('javascript:alert(1)'), false)
    assert.equal(isPublicFileUrl('/etc/passwd'), false)
  })
})
