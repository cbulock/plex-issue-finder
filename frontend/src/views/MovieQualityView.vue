<template>
  <div class="quality-view app-page app-page--wide">
    <div class="page-header">
      <div>
        <p>
          Flag movies below their library's minimum resolution threshold.
          <span v-if="lastRunLabel" class="last-run">{{ lastRunLabel }}</span>
        </p>
      </div>
      <div class="header-actions">
        <label class="inline-toggle" for="movie-quality-deep-scan">
          <CindorCheckbox
            id="movie-quality-deep-scan"
            :model-value="deepScan"
            :disabled="loading"
            @update:model-value="deepScan = !!$event"
          />
          <span>Deep scan</span>
        </label>
        <CindorButton type="button" :disabled="loading" @click="store.runCheck({ deepScan })">
          <span class="button-content">
            <AppIcon :name="loading ? 'loader-pinwheel' : 'play'" :size="16" />
            <span>{{ loading ? 'Running…' : 'Run Check' }}</span>
          </span>
        </CindorButton>
      </div>
    </div>

    <CindorAlert v-if="error" tone="danger" class="page-alert">
      {{ error }}
    </CindorAlert>

    <CindorAlert v-if="result?.summary?.deepScan" tone="neutral" class="page-alert">
      Deep scan fetched per-movie Plex metadata for this run.
      <span v-if="result.summary.deepScanFallbacks"> {{ result.summary.deepScanFallbacks }} item(s) fell back to the faster library scan after metadata fetch errors.</span>
    </CindorAlert>

    <div v-if="result" class="summary-row">
      <CindorStatCard label="Total Movies" :value="String(result.summary.total)" tone="neutral" />
      <CindorStatCard label="Below Threshold" :value="String(result.summary.flagged)" tone="negative" />
      <CindorStatCard label="Above Threshold" :value="String(result.summary.overThreshold || 0)" tone="neutral" />
      <CindorStatCard label="OK" :value="String(result.summary.ok)" tone="positive" />
    </div>

    <div v-if="result && flaggedRows.length > 0" class="section">
      <h2 class="section-title">
        <AppIcon name="triangle-alert" :size="18" />
        Below Threshold ({{ flaggedRows.length }})
      </h2>

      <div v-if="selectedUpgradeMovies.length > 0" class="bulk-toolbar">
        <span class="bulk-count">{{ selectedUpgradeMovies.length }} selected</span>
        <CindorButton type="button" variant="ghost" :disabled="redownloading" @click="upgradeSelected">
          <span class="button-content">
            <AppIcon :name="redownloading ? 'loader-pinwheel' : 'refresh-cw'" :size="16" />
            <span>{{ redownloading ? 'Queueing…' : 'Upgrade' }}</span>
          </span>
        </CindorButton>
        <CindorButton type="button" variant="ghost" @click="selectedUpgradeMovies = []">
          <span class="button-content">
            <AppIcon name="x" :size="16" />
            <span>Clear</span>
          </span>
        </CindorButton>
      </div>

      <AppDataTable
        :columns="flaggedColumns"
        density="compact"
        :rows="flaggedRows"
        row-key="plexRatingKey"
        :rows-per-page="20"
        selectable
        :selected-rows="selectedUpgradeMovies"
        @update:selected-rows="selectedUpgradeMovies = $event"
      >
        <template #cell-title="{ row }">
          <div class="title-cell">
            <span>{{ row.title }}</span>
            <span class="movie-year">{{ row.year }}</span>
          </div>
        </template>
        <template #cell-videoResolution="{ row }">
          <AppTag
            :value="row.videoResolution || 'Unknown'"
            :severity="resolutionSeverity(row.videoResolution)"
          />
        </template>
        <template #cell-audioChannels="{ row }">
          {{ formatAudio(row.audioChannels, row.audioCodec) }}
        </template>
        <template #cell-links="{ row }">
          <div class="link-buttons">
            <AppExternalLink
              v-if="row.plexRatingKey && plexMachineId"
              :href="plexLink(row.plexRatingKey)"
              class="icon-link plex-link"
              title="Open in Plex"
              aria-label="Open in Plex"
            ><AppIcon name="circle-play" :size="16" /></AppExternalLink>
            <AppExternalLink
              v-if="row.radarrSlug && radarrBaseUrl"
              :href="radarrLink(row.radarrSlug)"
              class="icon-link radarr-link"
              title="Open in Radarr"
              aria-label="Open in Radarr"
            ><AppIcon name="video" :size="16" /></AppExternalLink>
          </div>
        </template>
      </AppDataTable>
    </div>

    <div v-if="result && overThresholdRows.length > 0" class="section">
      <h2 class="section-title">
        <AppIcon name="arrow-down" :size="18" />
        Above Threshold ({{ overThresholdRows.length }})
      </h2>

      <CindorAlert tone="neutral" class="section-note">
        Downgrade queues a replacement search in Radarr after deleting the current file. Radarr will only grab a lower-quality copy if that movie's quality profile allows it.
      </CindorAlert>

      <div v-if="selectedDowngradeMovies.length > 0" class="bulk-toolbar">
        <span class="bulk-count">{{ selectedDowngradeMovies.length }} selected</span>
        <CindorButton type="button" variant="ghost" :disabled="downgrading" @click="downgradeSelected">
          <span class="button-content">
            <AppIcon :name="downgrading ? 'loader-pinwheel' : 'arrow-down'" :size="16" />
            <span>{{ downgrading ? 'Queueing…' : 'Downgrade' }}</span>
          </span>
        </CindorButton>
        <CindorButton type="button" variant="ghost" @click="selectedDowngradeMovies = []">
          <span class="button-content">
            <AppIcon name="x" :size="16" />
            <span>Clear</span>
          </span>
        </CindorButton>
      </div>

      <AppDataTable
        :columns="flaggedColumns"
        density="compact"
        :rows="overThresholdRows"
        row-key="plexRatingKey"
        :rows-per-page="20"
        selectable
        :selected-rows="selectedDowngradeMovies"
        @update:selected-rows="selectedDowngradeMovies = $event"
      >
        <template #cell-title="{ row }">
          <div class="title-cell">
            <span>{{ row.title }}</span>
            <span class="movie-year">{{ row.year }}</span>
          </div>
        </template>
        <template #cell-videoResolution="{ row }">
          <AppTag
            :value="row.videoResolution || 'Unknown'"
            :severity="resolutionSeverity(row.videoResolution)"
          />
        </template>
        <template #cell-audioChannels="{ row }">
          {{ formatAudio(row.audioChannels, row.audioCodec) }}
        </template>
        <template #cell-links="{ row }">
          <div class="link-buttons">
            <AppExternalLink
              v-if="row.plexRatingKey && plexMachineId"
              :href="plexLink(row.plexRatingKey)"
              class="icon-link plex-link"
              title="Open in Plex"
              aria-label="Open in Plex"
            ><AppIcon name="circle-play" :size="16" /></AppExternalLink>
            <AppExternalLink
              v-if="row.radarrSlug && radarrBaseUrl"
              :href="radarrLink(row.radarrSlug)"
              class="icon-link radarr-link"
              title="Open in Radarr"
              aria-label="Open in Radarr"
            ><AppIcon name="video" :size="16" /></AppExternalLink>
          </div>
        </template>
      </AppDataTable>
    </div>

    <div v-if="result && flaggedRows.length === 0 && overThresholdRows.length === 0 && !loading" class="empty-state">
      <AppIcon name="circle-check" :size="42" />
      <p>All movies match their library quality threshold.</p>
    </div>

    <div v-if="loading" class="loading-state">
      <CindorSpinner />
      <p>Fetching movie quality data from Plex...</p>
    </div>

    <div v-if="!result && !loading" class="idle-state">
      <AppIcon name="video" :size="42" />
      <p>Run a check to see which movies are below or above their library quality threshold.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMovieQualityStore } from '../stores/movieQuality'
import { useSettingsStore } from '../stores/settings'
import { useAppToast } from '../composables/useAppToast'
import { apiPost } from '../api/client'
import { CindorAlert, CindorButton, CindorCheckbox, CindorSpinner, CindorStatCard } from 'cindor-ui-vue'
import AppDataTable from '../components/AppDataTable.vue'
import AppExternalLink from '../components/AppExternalLink.vue'
import AppIcon from '../components/AppIcon.vue'
import AppTag from '../components/AppTag.vue'

const store = useMovieQualityStore()
const settingsStore = useSettingsStore()
const toast = useAppToast()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const plexBaseUrl = computed(() => store.result?.summary?.plexUrl || '')
const plexMachineId = computed(() => store.result?.summary?.plexMachineId || '')
const radarrBaseUrl = computed(() => store.result?.summary?.radarrUrl || '')
const flaggedRows = computed(() => store.result?.flagged || [])
const overThresholdRows = computed(() => store.result?.overThreshold || [])

const selectedUpgradeMovies = ref([])
const selectedDowngradeMovies = ref([])
const redownloading = ref(false)
const downgrading = ref(false)
const deepScan = ref(false)

const flaggedColumns = [
  { key: 'title', label: 'Title', sortable: true, minWidth: '12rem', priority: 1 },
  { key: 'sectionTitle', label: 'Library', sortable: true, minWidth: '8rem', truncate: true, priority: 1 },
  { key: 'videoResolution', label: 'Resolution', sortable: true, minWidth: '6.5rem', width: '6.5rem', priority: 1 },
  { key: 'videoCodec', label: 'Codec', sortable: true, minWidth: '6rem', width: '6rem', truncate: true, priority: 3 },
  { key: 'audioChannels', label: 'Audio', sortable: true, minWidth: '7rem', width: '7rem', truncate: true, priority: 2 },
  { key: 'threshold', label: 'Threshold', minWidth: '6.5rem', width: '6.5rem', priority: 2 },
  { key: 'links', label: 'Links', minWidth: '5rem', width: '5rem', priority: 1 },
]

const lastRunLabel = computed(() => {
  if (!store.lastRun) return null
  const now = new Date()
  const run = store.lastRun
  const sameDay =
    run.getFullYear() === now.getFullYear() &&
    run.getMonth() === now.getMonth() &&
    run.getDate() === now.getDate()
  return sameDay
    ? `Last run: ${run.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : `Last run: ${run.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${run.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
})

onMounted(async () => {
  await settingsStore.fetchSettings()
  deepScan.value = settingsStore.settings.quality_deep_scan === '1'
})

function plexLink(ratingKey) {
  const key = encodeURIComponent(`/library/metadata/${ratingKey}`)
  return `${plexBaseUrl.value}/web/index.html#!/server/${plexMachineId.value}/details?key=${key}`
}

function radarrLink(slug) {
  return `${radarrBaseUrl.value}/movie/${slug}`
}

const RESOLUTION_RANK = { 'Unknown': 0, '480p': 1, '720p': 2, '1080p': 3, '4K': 4 }

function resolutionSeverity(res) {
  const rank = RESOLUTION_RANK[res] ?? 0
  if (rank === 0) return 'secondary'
  if (rank <= 1) return 'danger'
  if (rank <= 2) return 'warn'
  return 'success'
}

function formatAudio(channels, codec) {
  if (!channels) return codec || '—'
  const ch = channels >= 8 ? '7.1' : channels >= 6 ? '5.1' : `${channels}ch`
  return codec ? `${ch} ${codec.toUpperCase()}` : ch
}

function getSelectedMovieIds(rows) {
  const ids = []
  let skipped = 0

  for (const row of rows) {
    if (!row.radarrId) {
      skipped++
      continue
    }

    if (!ids.includes(row.radarrId)) {
      ids.push(row.radarrId)
    }
  }

  return { ids, skipped }
}

async function queueReplacementSearch(rows, loadingRef, successSummary, errorSummary, emptyDetail, additionalDetail = '') {
  const { ids, skipped } = getSelectedMovieIds(rows)
  if (ids.length === 0) {
    toast.add({ severity: 'warn', summary: 'No Radarr match', detail: emptyDetail, life: 5000 })
    return false
  }

  loadingRef.value = true
  try {
    const data = await apiPost('/api/movies/redownload', { movieIds: ids })
    const detail = [
      `${data.queued} replacement search(es) queued`,
      `${data.deleted} file(s) deleted`,
      skipped ? `${skipped} skipped without a Radarr match` : '',
      data.errors.length ? `${data.errors.length} error(s)` : '',
      additionalDetail,
    ].filter(Boolean).join('. ') + '.'

    toast.add({
      severity: 'success',
      summary: successSummary,
      detail,
      life: 6000,
    })
    return true
  } catch (err) {
    toast.add({ severity: 'error', summary: errorSummary, detail: err.message, life: 6000 })
    return false
  } finally {
    loadingRef.value = false
  }
}

async function upgradeSelected() {
  const queued = await queueReplacementSearch(
    selectedUpgradeMovies.value,
    redownloading,
    'Upgrade search queued',
    'Upgrade search failed',
    'Selected movies do not have a matching Radarr entry.',
  )
  if (queued) selectedUpgradeMovies.value = []
}

async function downgradeSelected() {
  const queued = await queueReplacementSearch(
    selectedDowngradeMovies.value,
    downgrading,
    'Downgrade search queued',
    'Downgrade search failed',
    'Selected movies do not have a matching Radarr entry.',
    'Radarr will use each movie\'s current quality profile when choosing a replacement',
  )
  if (queued) selectedDowngradeMovies.value = []
}
</script>

<style scoped>
.section-note {
  margin-block-end: var(--space-3);
}

.title-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: var(--space-2);
  min-width: 0;
}

.title-cell > :first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-buttons {
  justify-content: center;
  flex-wrap: nowrap;
}

.inline-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--fg-muted);
  font-size: var(--text-sm);
}
</style>
