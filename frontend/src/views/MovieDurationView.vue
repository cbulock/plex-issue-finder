<template>
  <div class="duration-view">
    <div class="page-header">
      <div>
        <h1>Movie Duration Check</h1>
        <p>
          Compare actual Plex durations against expected runtimes from Radarr.
          <span v-if="lastRunLabel" class="last-run">Last run: {{ lastRunLabel }}</span>
        </p>
      </div>
      <div class="header-actions">
        <Button
          label="Run Check"
          icon="pi pi-play"
          :loading="loading"
          @click="store.runCheck(false)"
        />
        <Button
          label="Force Refresh Cache"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          :loading="loading"
          @click="store.runCheck(true)"
          v-tooltip="'Clears the Radarr runtime cache and re-fetches all runtimes'"
        />
      </div>
    </div>

    <Message v-if="error" severity="error" :closable="false" style="margin-bottom: 1rem">
      {{ error }}
    </Message>

    <!-- Summary cards -->
    <div v-if="result" class="summary-row">
      <div class="summary-card summary-total">
        <div class="summary-num">{{ result.summary.total }}</div>
        <div class="summary-label">Total Movies</div>
      </div>
      <div class="summary-card summary-flagged">
        <div class="summary-num">{{ result.summary.flagged }}</div>
        <div class="summary-label">Flagged</div>
      </div>
      <div class="summary-card summary-ok">
        <div class="summary-num">{{ result.summary.ok }}</div>
        <div class="summary-label">OK</div>
      </div>
      <div class="summary-card summary-nomatch">
        <div class="summary-num">{{ result.summary.noMatch }}</div>
        <div class="summary-label">No Radarr Match</div>
      </div>
      <div class="summary-card summary-leeway">
        <div class="summary-num">{{ result.summary.leewayPercent }}%</div>
        <div class="summary-label">Tolerance</div>
      </div>
      <div class="summary-card summary-threshold">
        <div class="summary-num">{{ result.summary.minDiffMinutes }}m</div>
        <div class="summary-label">Min Diff</div>
      </div>
    </div>

    <!-- Flagged movies table -->
    <div v-if="result && result.flagged.length > 0" class="section">
      <h2 class="section-title">
        <i class="pi pi-exclamation-triangle" style="color: #e5a00d" />
        Flagged Movies ({{ result.flagged.length }})
      </h2>
      <!-- Bulk action toolbar -->
      <div v-if="selectedMovies.length > 0" class="bulk-toolbar">
        <span class="bulk-count">{{ selectedMovies.length }} selected</span>
        <Button
          label="Redownload"
          icon="pi pi-refresh"
          severity="warn"
          size="small"
          :loading="redownloading"
          @click="redownload"
        />
        <Button
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          title="Clear selection"
          @click="selectedMovies = []"
        />
      </div>

      <DataTable
        :value="result.flagged"
        v-model:selection="selectedMovies"
        selection-mode="multiple"
        data-key="plexRatingKey"
        :paginator="result.flagged.length > 20"
        :rows="20"
        class="flagged-table"
        striped-rows
        size="small"
      >
        <Column selection-mode="multiple" style="width: 3rem" />
        <Column field="title" header="Title" sortable>
          <template #body="{ data }">
            <div class="title-cell">
              <span class="movie-title">{{ data.title }}</span>
              <span class="movie-year">{{ data.year }}</span>
            </div>
          </template>
        </Column>
        <Column field="plexDurationMin" header="Plex Duration" sortable>
          <template #body="{ data }">
            {{ formatMinutes(data.plexDurationMin) }}
          </template>
        </Column>
        <Column field="expectedDurationMin" header="Expected" sortable>
          <template #body="{ data }">
            {{ formatMinutes(data.expectedDurationMin) }}
          </template>
        </Column>
        <Column field="diffPercent" header="Difference" sortable>
          <template #body="{ data }">
            <Tag
              :value="`${data.diffPercent}%`"
              :severity="data.diffPercent > 20 ? 'danger' : 'warn'"
            />
          </template>
        </Column>
        <Column header="Links" style="width: 110px">
          <template #body="{ data }">
            <div class="link-buttons">
              <a
                v-if="data.plexRatingKey && plexMachineId"
                :href="plexLink(data.plexRatingKey)"
                target="_blank"
                rel="noopener"
                class="icon-link plex-link"
                data-tooltip="Open in Plex"
              ><i class="pi pi-play-circle" /></a>
              <a
                v-if="data.radarrSlug && radarrBaseUrl"
                :href="`${radarrBaseUrl}/movie/${data.radarrSlug}`"
                target="_blank"
                rel="noopener"
                class="icon-link radarr-link"
                data-tooltip="Open in Radarr"
              ><i class="pi pi-video" /></a>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <div v-if="result && result.flagged.length === 0 && !loading" class="empty-state">
      <i class="pi pi-check-circle" />
      <p>No movies flagged! Differences stayed within the larger of {{ result.summary.leewayPercent }}% or {{ result.summary.minDiffMinutes }} minutes.</p>
    </div>

    <!-- No Radarr match -->
    <div v-if="result && result.noMatch.length > 0" class="section">
      <h2 class="section-title">
        <i class="pi pi-question-circle" style="color: #b0b8c8" />
        No Radarr Match ({{ result.noMatch.length }})
      </h2>
      <DataTable
        :value="result.noMatch"
        :paginator="result.noMatch.length > 10"
        :rows="10"
        size="small"
        striped-rows
      >
        <Column field="title" header="Title" sortable>
          <template #body="{ data }">
            <div class="title-cell">
              <span class="movie-title">{{ data.title }}</span>
              <span class="movie-year">{{ data.year }}</span>
            </div>
          </template>
        </Column>
        <Column field="plexDurationMin" header="Plex Duration">
          <template #body="{ data }">
            {{ formatMinutes(data.plexDurationMin) }}
          </template>
        </Column>
        <Column field="reason" header="Reason" />
        <Column header="Links" style="width: 80px">
          <template #body="{ data }">
            <div class="link-buttons">
              <a
                v-if="data.plexRatingKey && plexMachineId"
                :href="plexLink(data.plexRatingKey)"
                target="_blank"
                rel="noopener"
                class="icon-link plex-link"
                data-tooltip="Open in Plex"
              ><i class="pi pi-play-circle" /></a>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- Initial state -->
    <div v-if="!result && !loading" class="idle-state">
      <i class="pi pi-clock" />
      <p>Click <strong>Run Check</strong> to scan your Plex library for movies with unexpected durations.</p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner />
      <p>Fetching movie data from Plex and Radarr…</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useMovieDurationStore } from '../stores/movieDuration'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

const store = useMovieDurationStore()
const toast = useToast()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

// Pre-compute link bases outside row slots to avoid reactive reads during DataTable render
const plexBaseUrl = computed(() => store.result?.summary?.plexUrl || '')
const plexMachineId = computed(() => store.result?.summary?.plexMachineId || '')
const radarrBaseUrl = computed(() => store.result?.summary?.radarrUrl || '')

const selectedMovies = ref([])
const redownloading = ref(false)

async function redownload() {
  const ids = selectedMovies.value.map((m) => m.radarrId).filter(Boolean)
  if (ids.length === 0) {
    toast.add({ severity: 'warn', summary: 'No Radarr ID', detail: 'Selected movies have no Radarr ID. Try running a forced refresh.', life: 5000 })
    return
  }
  redownloading.value = true
  try {
    const res = await fetch('/api/movies/redownload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieIds: ids }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Redownload failed')
    toast.add({
      severity: 'success',
      summary: 'Redownload queued',
      detail: `${data.queued} search(es) queued, ${data.deleted} file(s) deleted.${data.errors.length ? ` ${data.errors.length} error(s).` : ''}`,
      life: 6000,
    })
    selectedMovies.value = []
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
.duration-view {
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

.page-header h1 {
  margin: 0 0 0.4rem;
  font-size: 1.8rem;
}

.page-header p {
  color: #b0b8c8;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.last-run {
  font-size: 0.8rem;
  color: #7a8a9a;
  font-style: italic;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

/* Bulk action toolbar */
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

.bulk-count {
  font-size: 0.9rem;
  color: #e5a00d;
  font-weight: 600;
  margin-right: auto;
}

/* Summary cards */
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

.summary-total   { background: rgba(100, 100, 100, 0.1); border-color: #444; }
.summary-flagged { background: rgba(229, 160, 13, 0.1);  border-color: #e5a00d66; }
.summary-ok      { background: rgba(68, 189, 125, 0.1);  border-color: #44bd7d66; }
.summary-nomatch { background: rgba(150, 150, 150, 0.08); border-color: #55555566; }
.summary-leeway  { background: rgba(100, 149, 237, 0.1); border-color: #6495ed66; }
.summary-threshold { background: rgba(142, 124, 195, 0.1); border-color: #8e7cc366; }

.summary-num {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 0.3rem;
}

.summary-flagged .summary-num { color: #e5a00d; }
.summary-ok .summary-num      { color: #44bd7d; }

.summary-label {
  font-size: 0.78rem;
  color: #b0b8c8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Sections */
.section {
  margin-bottom: 2.5rem;
}

.section-title {
  font-size: 1.1rem;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Link buttons */
.link-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* CSS tooltips */
.icon-link {
  position: relative;
}

.plex-link   { color: #e5a00d; }
.radarr-link { color: #4fa3e0; }
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

.icon-link[data-tooltip]:hover::after {
  opacity: 1;
}

/* Title cell */
.title-cell {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.movie-year {
  font-size: 0.85rem;
  color: #b0b8c8;
}

/* States */
.empty-state,
.idle-state,
.loading-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #b0b8c8;
}

.empty-state i,
.idle-state i {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.empty-state i { color: #44bd7d; }
.idle-state i  { color: #b0b8c8; }

.loading-state p {
  margin-top: 1rem;
}
</style>
