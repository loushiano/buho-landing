// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/main.css'],
  runtimeConfig: {
    // Server-only. Overridden at runtime by NUXT_S3_BUCKET, NUXT_AWS_REGION,
    // NUXT_AWS_ACCESS_KEY_ID, NUXT_AWS_SECRET_ACCESS_KEY, and NUXT_S3_RELEASE_PREFIX.
    // Unprefixed AWS_*/S3_* variables are also read in the release loader.
    s3Bucket: '',
    awsRegion: '',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    s3ReleasePrefix: '',
  },
})
