<template>
  <div class="sonarr-view">
    <div class="page-header">
      <div>
        <h1>Unmonitored Episodes</h1>
        <p>
          Find shows in Sonarr with unmonitored seasons or episodes and optionally enable monitoring.
          <span v-if="lastRunLabel" class="last-run">{{ lastRunLabel }}</span>
        </p>
      </div>
      <div class="header-actions">
        <Button
          label="Run Check"
          icon="pi pi-play"
          :loading="loading"
          @click="store.runCheck()"
        />
      </div>
    </div>

    <Message v-if="error" severity="error" :closable="false" style="margin-bottom: 1rem">
      {{ error }}
    </Message>

    <!-- Summary cards -->
    <div v-if="result" class="summary-row">
      <div class="summary-card summary-total">
        <div class="summary-num">{{ result.summary.totalSeries }}</div>
        <div class="summary-label">Total Series</div>
      </div>
      <div class="summary-card summary-flagged">
        <div class="summary-num">{{ result.summary.seriesWithIssues }}</div>
        <div class="summary-label">With Issues</div>
      </div>
      <div class="summary-card summary-seasons">
        <div class="summary-num">{{ result.summary.totalUnmonitoredSeasons }}</div>
        <div class="summary-label">Unmonitored Seasons</div>
      </div>
      <div class="summary-card summary-episodes">
        <div class="summary-num">{{ result.summary.totalUnmonitoredEpisodes }}</div>
        <div class="summary-label">Unmonitored Episodes</div>
      </div>
    </div>

    <!-- Results table -->
    <div v-if="result && result.results.length > 0" class="section">
      <h2 class="section-title">
        <i class="pi pi-exclamation-circle" style="color: #e5a00d" />
        Series with Unmonitored Content ({{ result.results.length }})
      </h2>

      <!-- Bulk action toolbar -->
      <div v-if="selectedSeries.length > 0" class="bulk-toolbar">
        <span class="bulk-count">{{ selectedSeries.length }} selected</span>
        <Button
          label="Monitor All Selected"
          icon="pi pi-eye"
          severity="warn"
          size="small"
          :loading="monitoring"
          @click="monitorSelected"
        />
        <Button
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          title="Clear selection"
          @click="selectedSeries = []"
        />
      </div>

      <DataTable
        :value="result.results"
        v-model:selection="selectedSeries"
        v-model:expandedRows="expandedRows"
        selection-mode="multiple"
        data-key="seriesId"
        :paginator="result.results.length > 20"
        :rows="20"
        striped-rows
        size="small"
      >
        <Column selection-mode="multiple" style="width: 3rem" />
        <Column expander style="width: 3rem" />
        <Column field="title" header="Series" sortable>
          <template #body="{ data }">
            <div class="title-cell">
              <span>{{ data.title }}</span>
              <span class="movie-year">{{ data.year }}</span>
            </div>
          </template>
        </Column>
        <Column header="Unmonitored Seasons" sortable :sort-field="'unmonitoredSeasons.length'">
          <template #body="{ data }">
            <Tag
              v-if="data.unmonitoredSeasons.length > 0"
              :value="`${data.unmonitoredSeasons.length} season(s)`"
              severity="warn"
            />
            <span v-else class="muted">—</span>
          </template>
        </Column>
        <Column header="Unmonitored Episodes" sortable :sort-field="'unmonitoredEpisodes.length'">
          <template #body="{ data }">
            <Tag
              v-if="data.unmonitoredEpisodes.length > 0"
              :value="`${data.unmonitoredEpisodes.length} episode(s)`"
              severity="warn"
            />
            <span v-else class="muted">—</span>
          </template>
        </Column>
        <Column header="Links" style="width: 80px">
          <template #body="{ data }">
            <div class="link-buttons">
              <a
                v-if="data.titleSlug && sonarrBaseUrl"
                :href="`${sonarrBaseUrl}/series/${data.titleSlug}`"
                target="_blank"
                rel="noopener"
                class="icon-link sonarr-link"
                data-tooltip="Open in Sonarr"
              ><i class="pi pi-list" /></a>
            </div>
          </template>
        </Column>

        <!-- Expansion template -->
        <template #expansion="{ data: series }">
          <div class="expansion-content">
            <div v-if="series.unmonitoredSeasons.length > 0" class="expansion-section">
              <h4>Unmonitored Seasons</h4>
              <DataTable :value="series.unmonitoredSeasons" size="small" class="nested-table">
                <Column field="seasonNumber" header="Season" sortable>
                  <template #body="{ data: season }">
                    Season {{ season.seasonNumber }}
                  </template>
                </Column>
                <Column field="totalEpisodes" header="Total Episodes" />
                <Column field="unmonitoredEpisodes" header="Unmonitored" />
              </DataTable>
            </div>
            <div v-if="series.unmonitoredEpisodes.length > 0" class="expansion-section">
              <h4>Individually Unmonitored Episodes (in monitored seasons)</h4>
              <DataTable :value="series.unmonitoredEpisodes" size="small" class="nested-table">
                <Column header="Episode">
                  <template #body="{ data: ep }">
                    S{{ String(ep.seasonNumber).padStart(2, '0') }}E{{ String(ep.episodeNumber).padStart(2, '0') }}
                  </template>
                </Column>
                <Column field="title" header="Title" />
                <Column field="hasFile" header="Has File">
                  <template #body="{ data: ep }">
                    <i :class="ep.hasFile ? 'pi pi-check' : 'pi pi-times'" :style="{ color: ep.hasFile ? '#44bd7d' : '#e57373' }" />
                  </template>
                </Column>
                <Column header="Link" style="width: 60px">
                  <template #body>
                    <a
                      v-if="series.titleSlug && sonarrBaseUrl"
                      :href="`${sonarrBaseUrl}/series/${series.titleSlug}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="icon-link sonarr-link"
                      data-tooltip="Open in Sonarr"
                      aria-label="Open in Sonarr"
                    ><i class="pi pi-external-link" /></a>
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </template>
      </DataTable>
    </div>

    <div v-if="result && result.results.length === 0 && !loading" class="empty-state">
      <i class="pi pi-check-circle" />
      <p>All monitored series have fully monitored seasons and episodes.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner style="width: 48px; height: 48px" />
      <p>Scanning Sonarr for unmonitored content…</p>
    </div>

    <!-- Idle -->
    <div v-if="!result && !loading" class="idle-state">
      <i class="pi pi-list" />
      <p>Run a check to find shows with unmonitored seasons or episodes in Sonarr.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useSonarrMonitoringStore } from '../stores/sonarrMonitoring'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

const store = useSonarrMonitoringStore()
const toast = useToast()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const sonarrBaseUrl = computed(() => store.result?.summary?.sonarrUrl || '')

const selectedSeries = ref([])
const expandedRows = ref([])
const monitoring = ref(false)

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
.sonarr-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.page-header h1 { margin: 0 0 0.4rem; font-size: 1.8rem; }

.page-header p {
  color: #b0b8c8;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.last-run { font-size: 0.8rem; color: #7a8a9a; font-style: italic; }
.header-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }

.summary-row {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.summary-card {
  flex: 1;
  min-width: 110px;
  padding: 1rem;
  border-radius: 10px;
  text-align: center;
  border: 1px solid transparent;
}

.summary-total    { background: rgba(100,100,100,0.1); border-color: #444; }
.summary-flagged  { background: rgba(229,160,13,0.1);  border-color: #e5a00d66; }
.summary-seasons  { background: rgba(229,115,13,0.1);  border-color: #e5730d66; }
.summary-episodes { background: rgba(229,115,115,0.1); border-color: #e5737366; }

.summary-num { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: 0.3rem; }
.summary-flagged .summary-num  { color: #e5a00d; }
.summary-seasons .summary-num  { color: #e5730d; }
.summary-episodes .summary-num { color: #e57373; }

.summary-label { font-size: 0.78rem; color: #b0b8c8; text-transform: uppercase; letter-spacing: 0.04em; }

.section { margin-bottom: 2.5rem; }

.section-title {
  font-size: 1.1rem;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-cell { display: flex; align-items: baseline; gap: 0.5rem; }
.movie-year { font-size: 0.85rem; color: #b0b8c8; }
.muted { color: #666; }

.bulk-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  margin-bottom: 0.75rem;
  background: rgba(229, 160, 13, 0.1);
  border: 1px solid #e5a00d66;
  border-radius: 8px;
}

.bulk-count { font-size: 0.9rem; color: #e5a00d; font-weight: 600; margin-right: auto; }

.link-buttons { display: flex; gap: 0.5rem; align-items: center; }

.icon-link { position: relative; font-size: 1.1rem; }
.sonarr-link { color: #4fa3e0; }

.icon-link[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1e2530;
  color: #e0e6f0;
  font-size: 0.75rem;
  white-space: nowrap;
  padding: 4px 10px;
  border-radius: 5px;
  border: 1px solid #3a4555;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 100;
}
.icon-link[data-tooltip]:hover::after { opacity: 1; }

.expansion-content {
  padding: 0.75rem 1rem 0.75rem 3rem;
}

.expansion-section {
  margin-bottom: 1rem;
}

.expansion-section:last-child {
  margin-bottom: 0;
}

.expansion-section h4 {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #b0b8c8;
}

.nested-table {
  font-size: 0.85rem;
}

.empty-state, .idle-state, .loading-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #b0b8c8;
}

.empty-state i, .idle-state i { font-size: 3rem; display: block; margin-bottom: 1rem; }
.empty-state i { color: #44bd7d; }
.idle-state i  { color: #b0b8c8; }
.loading-state p { margin-top: 1rem; }
</style>
