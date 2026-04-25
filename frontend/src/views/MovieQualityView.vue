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
        <div class="summary-num">{{ result.summary.total }}</div>
        <div class="summary-label">Total Movies</div>
      </div>
      <div class="summary-card summary-flagged">
        <div class="summary-num">{{ result.summary.flagged }}</div>
        <div class="summary-label">Below Threshold</div>
      </div>
      <div class="summary-card summary-ok">
        <div class="summary-num">{{ result.summary.ok }}</div>
        <div class="summary-label">OK</div>
      </div>
    </div>

    <!-- Flagged table -->
    <div v-if="result && result.flagged.length > 0" class="section">
      <h2 class="section-title">
        <i class="pi pi-exclamation-triangle" style="color: var(--accent)" />
        Below Threshold ({{ result.flagged.length }})
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
        striped-rows
        size="small"
      >
        <Column selection-mode="multiple" style="width: 3rem" />
        <Column field="title" header="Title" sortable>
          <template #body="{ data }">
            <div class="title-cell">
              <span>{{ data.title }}</span>
              <span class="movie-year">{{ data.year }}</span>
            </div>
          </template>
        </Column>
        <Column field="sectionTitle" header="Library" sortable />
        <Column field="videoResolution" header="Resolution" sortable>
          <template #body="{ data }">
            <Tag
              :value="data.videoResolution || 'Unknown'"
              :severity="resolutionSeverity(data.videoResolution)"
            />
          </template>
        </Column>
        <Column field="videoCodec" header="Codec" sortable />
        <Column field="audioChannels" header="Audio" sortable>
          <template #body="{ data }">
            {{ formatAudio(data.audioChannels, data.audioCodec) }}
          </template>
        </Column>
        <Column field="threshold" header="Threshold" />
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
                :href="radarrLink(data.radarrSlug)"
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
      <p>All movies meet their library's quality threshold.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner style="width: 48px; height: 48px" />
      <p>Fetching movie quality data from Plex…</p>
    </div>

    <!-- Idle -->
    <div v-if="!result && !loading" class="idle-state">
      <i class="pi pi-video" />
      <p>Run a check to see which movies are below their library quality threshold.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useMovieQualityStore } from '../stores/movieQuality'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

const store = useMovieQualityStore()
const toast = useToast()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const plexBaseUrl = computed(() => store.result?.summary?.plexUrl || '')
const plexMachineId = computed(() => store.result?.summary?.plexMachineId || '')
const radarrBaseUrl = computed(() => store.result?.summary?.radarrUrl || '')

const selectedMovies = ref([])
const redownloading = ref(false)

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

async function redownload() {
  const ids = selectedMovies.value.map((m) => m.radarrId).filter(Boolean)
  if (ids.length === 0) {
    toast.add({ severity: 'warn', summary: 'No Radarr ID', detail: 'Selected movies have no Radarr ID. Run the Movie Duration Check first to populate IDs.', life: 5000 })
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
      detail: `${data.queued} search(es) queued, ${data.deleted} file(s) deleted.`,
      life: 6000,
    })
    selectedMovies.value = []
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Redownload failed', detail: err.message, life: 6000 })
  } finally {
    redownloading.value = false
  }
}
</script>

