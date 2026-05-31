<template>
  <div class="duration-view app-page app-page--wide">
    <div class="page-header">
      <div>
        <p>
          Compare actual Plex episode durations against expected runtimes from Sonarr.
          <span v-if="lastRunLabel" class="last-run">{{ lastRunLabel }}</span>
        </p>
      </div>
      <div class="header-actions">
        <CindorButton type="button" :disabled="loading" @click="store.runCheck()">
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

    <div v-if="result" class="summary-row">
      <CindorStatCard label="Managed Episodes" :value="String(result.summary.total)" tone="neutral" />
      <CindorStatCard label="Flagged" :value="String(result.summary.flagged)" tone="negative" />
      <CindorStatCard label="OK" :value="String(result.summary.ok)" tone="positive" />
      <CindorStatCard label="No Runtime" :value="String(result.summary.noMatch)" tone="neutral" />
      <CindorStatCard label="Tolerance" :value="`${result.summary.leewayPercent}%`" tone="neutral" />
      <CindorStatCard label="Min Diff" :value="`${result.summary.minDiffMinutes}m`" tone="neutral" />
    </div>

    <div v-if="result && result.flagged.length > 0" class="section">
      <h2 class="section-title">
        <AppIcon name="triangle-alert" :size="18" />
        Flagged Episodes ({{ result.flagged.length }})
      </h2>

      <div v-if="selectedEpisodes.length > 0" class="bulk-toolbar">
        <span class="bulk-count">{{ selectedEpisodes.length }} selected</span>
        <CindorButton type="button" variant="ghost" :disabled="redownloading" @click="redownload">
          <span class="button-content">
            <AppIcon :name="redownloading ? 'loader-pinwheel' : 'refresh-cw'" :size="16" />
            <span>{{ redownloading ? 'Queueing…' : 'Redownload' }}</span>
          </span>
        </CindorButton>
        <CindorButton type="button" variant="ghost" @click="selectedEpisodes = []">
          <span class="button-content">
            <AppIcon name="x" :size="16" />
            <span>Clear</span>
          </span>
        </CindorButton>
      </div>

      <AppDataTable
        :columns="flaggedColumns"
        :rows="result.flagged"
        row-key="plexRatingKey"
        :rows-per-page="20"
        selectable
        :selected-rows="selectedEpisodes"
        @update:selected-rows="selectedEpisodes = $event"
      >
        <template #cell-showTitle="{ row }">
          <div class="title-cell">
            <span class="show-title">{{ row.showTitle }}</span>
            <span class="show-year">{{ row.showYear }}</span>
          </div>
        </template>
        <template #cell-seasonNumber="{ row }">
          <div class="episode-id">
            <span class="ep-code">S{{ String(row.seasonNumber).padStart(2, '0') }}E{{ String(row.episodeNumber).padStart(2, '0') }}</span>
            <span class="ep-title">{{ row.title }}</span>
          </div>
        </template>
        <template #cell-plexDurationMin="{ row }">
          {{ formatMinutes(row.plexDurationMin) }}
        </template>
        <template #cell-expectedDurationMin="{ row }">
          {{ formatMinutes(row.expectedDurationMin) }}
        </template>
        <template #cell-diffPercent="{ row }">
          <AppTag
            :value="`${row.diffPercent}%`"
            :severity="row.diffPercent > 20 ? 'danger' : 'warn'"
          />
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
              v-if="row.sonarrSeriesSlug && sonarrBaseUrl"
              :href="`${sonarrBaseUrl}/series/${row.sonarrSeriesSlug}`"
              class="icon-link sonarr-link"
              title="Open in Sonarr"
              aria-label="Open in Sonarr"
            ><AppIcon name="video" :size="16" /></AppExternalLink>
          </div>
        </template>
      </AppDataTable>
    </div>

    <div v-if="result && result.flagged.length === 0 && !loading" class="empty-state">
      <AppIcon name="circle-check" :size="42" />
      <p>No episodes flagged! Differences stayed within the larger of {{ result.summary.leewayPercent }}% or {{ result.summary.minDiffMinutes }} minutes.</p>
    </div>

    <div v-if="result && result.noMatch.length > 0" class="section">
      <h2 class="section-title">
        <AppIcon name="circle-help" :size="18" />
        No Runtime in Sonarr ({{ result.noMatch.length }})
      </h2>
      <AppDataTable
        :columns="noMatchColumns"
        :rows="result.noMatch"
        row-key="plexRatingKey"
        :rows-per-page="10"
        empty-message="No unmatched episodes."
      >
        <template #cell-showTitle="{ row }">
          <div class="title-cell">
            <span class="show-title">{{ row.showTitle }}</span>
            <span class="show-year">{{ row.showYear }}</span>
          </div>
        </template>
        <template #cell-seasonNumber="{ row }">
          S{{ String(row.seasonNumber).padStart(2, '0') }}E{{ String(row.episodeNumber).padStart(2, '0') }}
        </template>
        <template #cell-plexDurationMin="{ row }">
          {{ formatMinutes(row.plexDurationMin) }}
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
          </div>
        </template>
      </AppDataTable>
    </div>

    <div v-if="!result && !loading" class="idle-state">
      <AppIcon name="clock" :size="42" />
      <p>Click <strong>Run Check</strong> to scan your Plex library for episodes with unexpected durations.</p>
    </div>

    <div v-if="loading" class="loading-state">
      <CindorSpinner />
      <p>Fetching episode data from Plex and Sonarr...</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useEpisodeDurationStore } from '../stores/episodeDuration'
import { useAppToast } from '../composables/useAppToast'
import { apiPost } from '../api/client'
import { CindorAlert, CindorButton, CindorSpinner, CindorStatCard } from 'cindor-ui-vue'
import AppDataTable from '../components/AppDataTable.vue'
import AppExternalLink from '../components/AppExternalLink.vue'
import AppIcon from '../components/AppIcon.vue'
import AppTag from '../components/AppTag.vue'

const store = useEpisodeDurationStore()
const toast = useAppToast()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const plexBaseUrl = computed(() => store.result?.summary?.plexUrl || '')
const plexMachineId = computed(() => store.result?.summary?.plexMachineId || '')
const sonarrBaseUrl = computed(() => store.result?.summary?.sonarrUrl || '')

const selectedEpisodes = ref([])
const redownloading = ref(false)

const flaggedColumns = [
  { key: 'showTitle', label: 'Show', sortable: true },
  { key: 'seasonNumber', label: 'Episode', sortable: true },
  { key: 'plexDurationMin', label: 'Plex Duration', sortable: true },
  { key: 'expectedDurationMin', label: 'Expected', sortable: true },
  { key: 'diffPercent', label: 'Difference', sortable: true },
  { key: 'links', label: 'Links', width: '7rem' },
]

const noMatchColumns = [
  { key: 'showTitle', label: 'Show', sortable: true },
  { key: 'seasonNumber', label: 'Episode', sortable: true },
  { key: 'plexDurationMin', label: 'Plex Duration', sortable: true },
  { key: 'reason', label: 'Reason' },
  { key: 'links', label: 'Links', width: '5rem' },
]

async function redownload() {
  const payload = selectedEpisodes.value.map((ep) => ({
    sonarrSeriesId: ep.sonarrSeriesId,
    seasonNumber: ep.seasonNumber,
    episodeNumber: ep.episodeNumber,
  }))

  if (payload.some((ep) => !ep.sonarrSeriesId)) {
    toast.add({ severity: 'warn', summary: 'Missing Sonarr ID', detail: 'Some selected episodes have no Sonarr series ID.', life: 5000 })
    return
  }

  redownloading.value = true
  try {
    const data = await apiPost('/api/episode-duration/redownload', { episodes: payload })
    toast.add({
      severity: 'success',
      summary: 'Redownload queued',
      detail: `${data.queued} search(es) queued, ${data.deleted} file(s) deleted.${data.errors.length ? ` ${data.errors.length} error(s).` : ''}`,
      life: 6000,
    })
    selectedEpisodes.value = []
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Redownload failed', detail: err.message, life: 6000 })
  } finally {
    redownloading.value = false
  }
}

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

function formatMinutes(min) {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function plexLink(ratingKey) {
  const key = encodeURIComponent(`/library/metadata/${ratingKey}`)
  return `${plexBaseUrl.value}/web/index.html#!/server/${plexMachineId.value}/details?key=${key}`
}
</script>

<style scoped>
.episode-id {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ep-code {
  color: var(--fg);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.03em;
}

.ep-title {
  color: var(--fg-subtle);
  font-size: var(--text-xs);
}
</style>
