<template>
  <div class="sonarr-view app-page app-page--wide">
    <div class="page-header">
      <div>
        <p>
          Find shows in Sonarr with unmonitored seasons or episodes and optionally enable monitoring.
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
      <CindorStatCard label="Total Series" :value="String(result.summary.totalSeries)" tone="neutral" />
      <CindorStatCard label="With Issues" :value="String(result.summary.seriesWithIssues)" tone="negative" />
      <CindorStatCard label="Unmonitored Seasons" :value="String(result.summary.totalUnmonitoredSeasons)" tone="negative" />
      <CindorStatCard label="Unmonitored Episodes" :value="String(result.summary.totalUnmonitoredEpisodes)" tone="negative" />
    </div>

    <div v-if="result && result.results.length > 0" class="section">
      <h2 class="section-title">
        <AppIcon name="triangle-alert" :size="18" />
        Series with Unmonitored Content ({{ result.results.length }})
      </h2>

      <div v-if="selectedSeries.length > 0" class="bulk-toolbar">
        <span class="bulk-count">{{ selectedSeries.length }} selected</span>
        <CindorButton type="button" variant="ghost" :disabled="monitoring" @click="monitorSelected">
          <span class="button-content">
            <AppIcon :name="monitoring ? 'loader-pinwheel' : 'eye'" :size="16" />
            <span>{{ monitoring ? 'Updating…' : 'Monitor All Selected' }}</span>
          </span>
        </CindorButton>
        <CindorButton type="button" variant="ghost" @click="selectedSeries = []">
          <span class="button-content">
            <AppIcon name="x" :size="16" />
            <span>Clear</span>
          </span>
        </CindorButton>
      </div>

      <AppDataTable
        :columns="seriesColumns"
        :rows="result.results"
        row-key="seriesId"
        :rows-per-page="20"
        selectable
        expandable
        :selected-rows="selectedSeries"
        :expanded-keys="expandedRows"
        :row-class="rowClass"
        @update:selected-rows="selectedSeries = $event"
        @update:expanded-keys="expandedRows = $event"
      >
        <template #cell-title="{ row }">
          <div class="title-cell">
            <span>{{ row.title }}</span>
            <span class="movie-year">{{ row.year }}</span>
          </div>
        </template>
        <template #cell-unmonitoredSeasonsCount="{ row }">
          <AppTag
            v-if="row.unmonitoredSeasons.length > 0"
            :value="`${row.unmonitoredSeasons.length} season(s)`"
            severity="warn"
          />
          <span v-else class="muted">—</span>
        </template>
        <template #cell-unmonitoredEpisodesCount="{ row }">
          <div v-if="row.unmonitoredEpisodes.length > 0" class="episodes-cell">
            <AppTag
              :value="`${row.unmonitoredEpisodes.length} episode(s)`"
              severity="warn"
            />
            <AppTag
              v-if="missingFileCount(row) > 0"
              :value="`${missingFileCount(row)} missing file(s)`"
              severity="danger"
              class="missing-files-tag"
            />
          </div>
          <span v-else class="muted">—</span>
        </template>
        <template #cell-links="{ row }">
          <div class="link-buttons">
            <AppExternalLink
              v-if="row.titleSlug && sonarrBaseUrl"
              :href="`${sonarrBaseUrl}/series/${row.titleSlug}`"
              class="icon-link sonarr-link"
              title="Open in Sonarr"
              aria-label="Open in Sonarr"
            ><AppIcon name="external-link" :size="16" /></AppExternalLink>
          </div>
        </template>
        <template #expanded="{ row: series }">
          <div class="expansion-content">
            <div v-if="series.unmonitoredSeasons.length > 0" class="expansion-section">
              <h4>Unmonitored Seasons</h4>
              <AppDataTable
                :columns="seasonColumns"
                :rows="series.unmonitoredSeasons"
                row-key="seasonNumber"
                :rows-per-page="10"
                empty-message="No unmonitored seasons."
              >
                <template #cell-seasonNumber="{ row: season }">
                  Season {{ season.seasonNumber }}
                </template>
              </AppDataTable>
            </div>
            <div v-if="series.unmonitoredEpisodes.length > 0" class="expansion-section">
              <h4>Individually Unmonitored Episodes (in monitored seasons)</h4>
              <AppDataTable
                :columns="episodeColumns"
                :rows="series.unmonitoredEpisodes"
                row-key="episodeId"
                :rows-per-page="10"
                empty-message="No individually unmonitored episodes."
              >
                <template #cell-episodeCode="{ row: ep }">
                  S{{ String(ep.seasonNumber).padStart(2, '0') }}E{{ String(ep.episodeNumber).padStart(2, '0') }}
                </template>
                <template #cell-hasFile="{ row: ep }">
                  <AppIcon
                    :name="ep.hasFile ? 'check' : 'x'"
                    :size="16"
                    :style="{ color: ep.hasFile ? 'var(--success)' : 'var(--danger)' }"
                  />
                </template>
                <template #cell-links>
                  <AppExternalLink
                    v-if="series.titleSlug && sonarrBaseUrl"
                    :href="`${sonarrBaseUrl}/series/${series.titleSlug}`"
                    class="icon-link sonarr-link"
                    title="Open in Sonarr"
                    aria-label="Open in Sonarr"
                  ><AppIcon name="external-link" :size="16" /></AppExternalLink>
                </template>
              </AppDataTable>
            </div>
          </div>
        </template>
      </AppDataTable>
    </div>

    <div v-if="result && result.results.length === 0 && !loading" class="empty-state">
      <AppIcon name="circle-check" :size="42" />
      <p>All monitored series have fully monitored seasons and episodes.</p>
    </div>

    <div v-if="loading" class="loading-state">
      <CindorSpinner />
      <p>Scanning Sonarr for unmonitored content...</p>
    </div>

    <div v-if="!result && !loading" class="idle-state">
      <AppIcon name="list" :size="42" />
      <p>Run a check to find shows with unmonitored seasons or episodes in Sonarr.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSonarrMonitoringStore } from '../stores/sonarrMonitoring'
import { useAppToast } from '../composables/useAppToast'
import { CindorAlert, CindorButton, CindorSpinner, CindorStatCard } from 'cindor-ui-vue'
import AppDataTable from '../components/AppDataTable.vue'
import AppExternalLink from '../components/AppExternalLink.vue'
import AppIcon from '../components/AppIcon.vue'
import AppTag from '../components/AppTag.vue'

const store = useSonarrMonitoringStore()
const toast = useAppToast()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const sonarrBaseUrl = computed(() => store.result?.summary?.sonarrUrl || '')

function missingFileCount(series) {
  return series.unmonitoredEpisodes.filter((ep) => !ep.hasFile).length
}

function hasMissingFiles(series) {
  return series.unmonitoredEpisodes.some((ep) => !ep.hasFile)
}

function rowClass(data) {
  return hasMissingFiles(data) ? 'row-missing-files' : null
}

const selectedSeries = ref([])
const expandedRows = ref([])
const monitoring = ref(false)

const seriesColumns = [
  { key: 'title', label: 'Series', sortable: true },
  { key: 'unmonitoredSeasonsCount', label: 'Unmonitored Seasons' },
  { key: 'unmonitoredEpisodesCount', label: 'Unmonitored Episodes' },
  { key: 'links', label: 'Links', width: '5rem' },
]

const seasonColumns = [
  { key: 'seasonNumber', label: 'Season', sortable: true },
  { key: 'totalEpisodes', label: 'Total Episodes', sortable: true },
  { key: 'unmonitoredEpisodes', label: 'Unmonitored', sortable: true },
]

const episodeColumns = [
  { key: 'episodeCode', label: 'Episode' },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'hasFile', label: 'Has File', sortable: true },
  { key: 'links', label: 'Link', width: '4rem' },
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

async function monitorSelected() {
  const episodeIds = []
  const seasons = []

  for (const series of selectedSeries.value) {
    // Collect all episode IDs from unmonitored seasons
    if (series.unmonitoredSeasons.length > 0) {
      seasons.push({
        seriesId: series.seriesId,
        seasonNumbers: series.unmonitoredSeasons.map((s) => s.seasonNumber),
      })
    }

    // Collect individually unmonitored episode IDs
    for (const ep of series.unmonitoredEpisodes) {
      episodeIds.push(ep.episodeId)
    }
  }

  if (episodeIds.length === 0 && seasons.length === 0) {
    toast.add({ severity: 'warn', summary: 'Nothing to monitor', detail: 'No unmonitored content found in selected series.', life: 5000 })
    return
  }

  monitoring.value = true
  try {
    const res = await fetch('/api/sonarr/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episodeIds, seasons }),
    })
    const contentType = res.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await res.json() : null
    if (!res.ok) throw new Error((data && data.error) || 'Monitor failed')

    const parts = []
    if (data && data.monitoredSeasons > 0) parts.push(`${data.monitoredSeasons} season(s)`)
    if (data && data.monitoredEpisodes > 0) parts.push(`${data.monitoredEpisodes} episode(s)`)

    toast.add({
      severity: 'success',
      summary: 'Monitoring enabled',
      detail: parts.length > 0 ? `Enabled monitoring for ${parts.join(' and ')}.` : 'No changes needed.',
      life: 6000,
    })

    const errors = Array.isArray(data?.errors) ? data.errors : []
    if (errors.length > 0) {
      const firstError = String(errors[0])
      const additionalCount = errors.length - 1
      toast.add({
        severity: 'warn',
        summary: 'Monitoring completed with warnings',
        detail:
          additionalCount > 0
            ? `${firstError} (${additionalCount} more error(s))`
            : firstError,
        life: 8000,
      })
    }
    selectedSeries.value = []
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Monitor failed', detail: err.message, life: 6000 })
  } finally {
    monitoring.value = false
  }
}
</script>

<style scoped>
.expansion-content {
  padding: var(--space-4) var(--space-4) var(--space-4) calc(var(--space-6) + var(--space-2));
}

.expansion-section + .expansion-section {
  margin-top: var(--space-4);
}

.expansion-section h4 {
  margin: 0 0 var(--space-3);
  color: var(--fg-muted);
  font-size: var(--text-sm);
}

.episodes-cell {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.missing-files-tag {
  font-size: var(--text-2xs);
}

:deep(.nested-table) {
  margin-top: var(--space-2);
}

:deep(.row-missing-files) {
  background: color-mix(in srgb, var(--danger) 8%, var(--surface)) !important;
}

:deep(.row-missing-files:hover) {
  background: color-mix(in srgb, var(--danger) 12%, var(--surface)) !important;
}
</style>
