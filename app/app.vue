<script setup lang="ts">
import { latestDownloadPath, preferredDownload, type ReleaseManifest } from '#shared/release'

const { data, error, status } = await useFetch<ReleaseManifest>('/api/release')

const downloads = computed(() => {
  const items = data.value?.downloads ?? []
  const windows = preferredDownload(items, 'windows')
  const mac = preferredDownload(items, 'macos')
  return items.map((download) => {
    const href = download === windows
      ? latestDownloadPath('windows')
      : download === mac
        ? latestDownloadPath('macos')
        : download.url
    return {
      ...download,
      href,
      detail: href.startsWith('/download/') ? href : download.file,
    }
  })
})

const published = computed(() => {
  const raw = data.value?.publishedAt
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date)
})

useHead({
  title: 'Buho',
  meta: [{ name: 'description', content: 'Download the latest Buho desktop app.' }],
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <main class="page">
      <img class="logo" src="/logo.png" width="88" height="88" alt="" />
      <p class="mark">Desktop</p>
      <h1>Buho</h1>
      <p class="lede">
        A window on this computer that serves your web app and keeps its settings.
      </p>

      <article v-if="data" class="release">
        <div class="meta">
          <span>Version {{ data.version }}</span>
          <time :datetime="data.publishedAt">{{ published }}</time>
        </div>
        <p class="notes">{{ data.notes }}</p>
        <ul class="downloads">
          <li v-for="download in downloads" :key="download.url">
            <a :href="download.href" :title="download.file">
              <span>Download for {{ download.name }}</span>
              <span class="file">{{ download.detail }}</span>
            </a>
          </li>
        </ul>
      </article>

      <p v-else-if="status === 'pending'" class="status">Looking up the latest release.</p>
      <p v-else class="status">{{ error?.statusMessage || 'No release has been published yet.' }}</p>
    </main>
  </div>
</template>
