import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canonicalPlatform,
  isPublicFileUrl,
  isReleaseManifest,
  latestDownloadPath,
  preferredDownload,
  type ReleaseDownload,
} from '../shared/release.ts'
import {
  installerObjectKey,
  latestManifestKey,
  resolveReleaseStorageConfig,
  UnsafeReleaseKeyError,
} from '../server/utils/release-storage.ts'

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

describe('private release object keys', () => {
  it('matches the desktop-shell publish layout', () => {
    assert.equal(latestManifestKey('releases'), 'releases/latest.json')
    assert.equal(
      installerObjectKey('releases', '0.1.0', 'Buho_0.1.0_x64-setup.exe'),
      'releases/0.1.0/Buho_0.1.0_x64-setup.exe',
    )
  })

  it('accepts the manifest the publish script writes', () => {
    assert.equal(isReleaseManifest({
      version: '0.1.0',
      publishedAt: '2026-01-01T00:00:00Z',
      notes: 'Buho 0.1.0',
      downloads: [windowsExe],
    }), true)
  })

  it('rejects names that leave the release prefix', () => {
    assert.throws(() => installerObjectKey('releases', '../0.1.0', 'setup.exe'), UnsafeReleaseKeyError)
    assert.throws(() => installerObjectKey('releases', '0.1.0', '../setup.exe'), UnsafeReleaseKeyError)
    assert.throws(() => installerObjectKey('releases', '0.1.0', 'nested/setup.exe'), UnsafeReleaseKeyError)
    assert.throws(() => latestManifestKey('../releases'), UnsafeReleaseKeyError)
    assert.throws(() => latestManifestKey(''), UnsafeReleaseKeyError)
  })
})

describe('release storage config', () => {
  const bucketEnv = {
    S3_BUCKET: 'buho-releases',
    AWS_REGION: 'us-east-1',
  }

  it('reads the same environment names the publish workflow uses', () => {
    const resolved = resolveReleaseStorageConfig({
      env: {
        ...bucketEnv,
        AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'secret',
      },
    })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.deepEqual(resolved.config, {
      bucket: 'buho-releases',
      region: 'us-east-1',
      prefix: 'releases',
      credentials: {
        accessKeyId: 'AKIAEXAMPLE',
        secretAccessKey: 'secret',
      },
    })
  })

  it('prefers Nuxt runtime config and falls back to the workflow names', () => {
    const resolved = resolveReleaseStorageConfig({
      s3Bucket: 'from-nuxt',
      awsRegion: 'eu-west-1',
      env: {
        S3_BUCKET: 'from-env',
        AWS_REGION: 'us-east-1',
      },
    })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.config.bucket, 'from-nuxt')
    assert.equal(resolved.config.region, 'eu-west-1')
    assert.equal(resolved.config.credentials, undefined)
    assert.equal(resolved.config.prefix, 'releases')
  })

  it('leaves credentials empty so an IAM role can be used', () => {
    const resolved = resolveReleaseStorageConfig({ env: bucketEnv })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.config.credentials, undefined)
  })

  it('rejects a half-configured key pair', () => {
    const resolved = resolveReleaseStorageConfig({
      env: {
        ...bucketEnv,
        AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
      },
    })
    assert.deepEqual(resolved, { ok: false, problem: 'partial-credentials' })
  })

  it('reports missing bucket and region', () => {
    const missingBucket = resolveReleaseStorageConfig({ env: { AWS_REGION: 'us-east-1' } })
    assert.equal(missingBucket.ok, false)
    if (missingBucket.ok) return
    assert.equal(missingBucket.problem, 'missing-bucket')

    const missingRegion = resolveReleaseStorageConfig({ env: { S3_BUCKET: 'buho-releases' } })
    assert.equal(missingRegion.ok, false)
    if (missingRegion.ok) return
    assert.equal(missingRegion.problem, 'missing-region')
  })

  it('accepts AWS_DEFAULT_REGION and an overridden prefix', () => {
    const resolved = resolveReleaseStorageConfig({
      env: {
        S3_BUCKET: 'buho-releases',
        AWS_DEFAULT_REGION: 'us-west-2',
        S3_RELEASE_PREFIX: 'desktop/releases',
      },
    })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.config.region, 'us-west-2')
    assert.equal(resolved.config.prefix, 'desktop/releases')
    assert.equal(latestManifestKey(resolved.config.prefix), 'desktop/releases/latest.json')
  })

  it('ignores non-string config values', () => {
    const resolved = resolveReleaseStorageConfig({
      s3Bucket: 123,
      env: bucketEnv,
    })
    assert.equal(resolved.ok, true)
    if (!resolved.ok) return
    assert.equal(resolved.config.bucket, 'buho-releases')
  })
})

describe('presigned installer urls', () => {
  it('signs the private object key without a checksum header', async () => {
    const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3')
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
    const resolved = resolveReleaseStorageConfig({
      env: {
        S3_BUCKET: 'buho-releases',
        AWS_REGION: 'us-east-1',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
    })
    assert.equal(resolved.ok, true)
    if (!resolved.ok || !resolved.config.credentials) return

    const file = 'Buho_0.1.0_x64-setup.exe'
    const key = installerObjectKey(resolved.config.prefix, '0.1.0', file)
    const client = new S3Client({
      region: resolved.config.region,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: resolved.config.credentials,
    })
    try {
      const signed = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: resolved.config.bucket,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${file}"`,
        }),
        { expiresIn: 900 },
      )
      const url = new URL(signed)
      assert.equal(url.protocol, 'https:')
      assert.equal(url.hostname, 'buho-releases.s3.us-east-1.amazonaws.com')
      assert.equal(decodeURIComponent(url.pathname), '/releases/0.1.0/Buho_0.1.0_x64-setup.exe')
      assert.equal(url.searchParams.get('X-Amz-Expires'), '900')
      assert.equal(url.searchParams.has('X-Amz-Signature'), true)
      assert.equal(url.searchParams.get('X-Amz-SignedHeaders'), 'host')
      assert.match(url.searchParams.get('response-content-disposition') ?? '', /filename="Buho_0\.1\.0_x64-setup\.exe"/)
    } finally {
      client.destroy()
    }
  })
})
