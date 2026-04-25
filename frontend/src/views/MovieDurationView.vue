<template>
  <div class="duration-view app-page app-page--wide">
    <div class="page-header">
      <div>
        <p>
          Compare actual Plex durations against expected runtimes from Radarr.
          <span v-if="lastRunLabel" class="last-run">{{ lastRunLabel }}</span>
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
        <i class="pi pi-exclamation-triangle" style="color: var(--accent)" />
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
        <i class="pi pi-question-circle" style="color: var(--fg-subtle)" />
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

