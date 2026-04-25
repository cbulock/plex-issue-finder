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
        <i class="pi pi-exclamation-circle" style="color: var(--accent)" />
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
        :row-class="rowClass"
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
            <div v-if="data.unmonitoredEpisodes.length > 0" class="episodes-cell">
              <Tag
                :value="`${data.unmonitoredEpisodes.length} episode(s)`"
                severity="warn"
              />
              <template v-for="missingCount in [missingFileCount(data)]" :key="`missing-files-${data.seriesId}`">
                <Tag
                  v-if="missingCount > 0"
                  :value="`${missingCount} missing file(s)`"
                  severity="danger"
                  class="missing-files-tag"
                />
              </template>
            </div>
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
              ><i class="pi pi-external-link" /></a>
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
                    <i :class="ep.hasFile ? 'pi pi-check' : 'pi pi-times'" :style="{ color: ep.hasFile ? 'var(--success)' : 'var(--danger)' }" />
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
