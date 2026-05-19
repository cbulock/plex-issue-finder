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
        <CindorButton type="button" :disabled="loading" @click="store.runCheck(false)">
          <span class="button-content">
            <AppIcon :name="loading ? 'loader-pinwheel' : 'pi-play'" :size="16" />
            <span>{{ loading ? 'Running…' : 'Run Check' }}</span>
          </span>
        </CindorButton>
        <CindorButton
          type="button"
          variant="ghost"
          :disabled="loading"
          title="Clears the Radarr runtime cache and re-fetches all runtimes"
          @click="store.runCheck(true)"
        >
          <span class="button-content">
            <AppIcon name="pi-refresh" :size="16" />
            <span>Force Refresh Cache</span>
          </span>
        </CindorButton>
      </div>
    </div>

    <CindorAlert v-if="error" tone="danger" class="page-alert">
      {{ error }}
    </CindorAlert>

    <div v-if="result" class="summary-row">
      <CindorStatCard label="Total Movies" :value="String(result.summary.total)" tone="neutral" />
      <CindorStatCard label="Flagged" :value="String(result.summary.flagged)" tone="negative" />
      <CindorStatCard label="OK" :value="String(result.summary.ok)" tone="positive" />
      <CindorStatCard label="No Radarr Match" :value="String(result.summary.noMatch)" tone="neutral" />
      <CindorStatCard label="Tolerance" :value="`${result.summary.leewayPercent}%`" tone="neutral" />
      <CindorStatCard label="Min Diff" :value="`${result.summary.minDiffMinutes}m`" tone="neutral" />
    </div>

    <div v-if="result && result.flagged.length > 0" class="section">
      <h2 class="section-title">
        <AppIcon name="pi-exclamation-triangle" :size="18" />
        Flagged Movies ({{ result.flagged.length }})
      </h2>
      <div v-if="selectedMovies.length > 0" class="bulk-toolbar">
        <span class="bulk-count">{{ selectedMovies.length }} selected</span>
        <CindorButton type="button" variant="ghost" :disabled="redownloading" @click="redownload">
          <span class="button-content">
            <AppIcon :name="redownloading ? 'loader-pinwheel' : 'pi-refresh'" :size="16" />
            <span>{{ redownloading ? 'Queueing…' : 'Redownload' }}</span>
          </span>
        </CindorButton>
        <CindorButton type="button" variant="ghost" @click="selectedMovies = []">
          <span class="button-content">
            <AppIcon name="pi-times" :size="16" />
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
        :selected-rows="selectedMovies"
        @update:selected-rows="selectedMovies = $event"
      >
        <template #cell-title="{ row }">
          <div class="title-cell">
            <span class="movie-title">{{ row.title }}</span>
            <span class="movie-year">{{ row.year }}</span>
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
            ><AppIcon name="pi-play-circle" :size="16" /></AppExternalLink>
            <AppExternalLink
              v-if="row.radarrSlug && radarrBaseUrl"
              :href="`${radarrBaseUrl}/movie/${row.radarrSlug}`"
              class="icon-link radarr-link"
              title="Open in Radarr"
              aria-label="Open in Radarr"
            ><AppIcon name="pi-video" :size="16" /></AppExternalLink>
          </div>
        </template>
      </AppDataTable>
    </div>

    <div v-if="result && result.flagged.length === 0 && !loading" class="empty-state">
      <AppIcon name="pi-check-circle" :size="42" />
      <p>No movies flagged! Differences stayed within the larger of {{ result.summary.leewayPercent }}% or {{ result.summary.minDiffMinutes }} minutes.</p>
    </div>

    <div v-if="result && result.noMatch.length > 0" class="section">
      <h2 class="section-title">
        <AppIcon name="pi-question-circle" :size="18" />
        No Radarr Match ({{ result.noMatch.length }})
      </h2>
      <AppDataTable
        :columns="noMatchColumns"
        :rows="result.noMatch"
        row-key="plexRatingKey"
        :rows-per-page="10"
        empty-message="No unmatched movies."
      >
        <template #cell-title="{ row }">
          <div class="title-cell">
            <span class="movie-title">{{ row.title }}</span>
            <span class="movie-year">{{ row.year }}</span>
          </div>
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
            ><AppIcon name="pi-play-circle" :size="16" /></AppExternalLink>
          </div>
        </template>
      </AppDataTable>
    </div>

    <div v-if="!result && !loading" class="idle-state">
      <AppIcon name="pi-clock" :size="42" />
      <p>Click <strong>Run Check</strong> to scan your Plex library for movies with unexpected durations.</p>
    </div>

    <div v-if="loading" class="loading-state">
      <CindorSpinner />
      <p>Fetching movie data from Plex and Radarr...</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useMovieDurationStore } from '../stores/movieDuration'
import { useAppToast } from '../composables/useAppToast'
import { CindorAlert, CindorButton, CindorSpinner, CindorStatCard } from 'cindor-ui-vue'
import AppDataTable from '../components/AppDataTable.vue'
import AppExternalLink from '../components/AppExternalLink.vue'
import AppIcon from '../components/AppIcon.vue'
import AppTag from '../components/AppTag.vue'

const store = useMovieDurationStore()
const toast = useAppToast()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

// Pre-compute link bases outside row slots to avoid reactive reads during DataTable render
const plexBaseUrl = computed(() => store.result?.summary?.plexUrl || '')
const plexMachineId = computed(() => store.result?.summary?.plexMachineId || '')
const radarrBaseUrl = computed(() => store.result?.summary?.radarrUrl || '')

const selectedMovies = ref([])
const redownloading = ref(false)

const flaggedColumns = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'plexDurationMin', label: 'Plex Duration', sortable: true },
  { key: 'expectedDurationMin', label: 'Expected', sortable: true },
  { key: 'diffPercent', label: 'Difference', sortable: true },
  { key: 'links', label: 'Links', width: '7rem' },
]

const noMatchColumns = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'plexDurationMin', label: 'Plex Duration', sortable: true },
  { key: 'reason', label: 'Reason' },
  { key: 'links', label: 'Links', width: '5rem' },
]

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
