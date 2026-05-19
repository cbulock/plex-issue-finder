<template>
  <div class="coverage-view app-page app-page--wide">
    <div class="page-header">
      <div>
        <p>
          Movies in Plex that have no matching entry in Radarr - they won't receive quality upgrades or monitoring.
          <span v-if="lastRunLabel" class="last-run">{{ lastRunLabel }}</span>
        </p>
      </div>
      <div class="header-actions">
        <CindorButton type="button" :disabled="loading" @click="store.runCheck()">
          <span class="button-content">
            <AppIcon :name="loading ? 'loader-pinwheel' : 'pi-play'" :size="16" />
            <span>{{ loading ? 'Running…' : 'Run Check' }}</span>
          </span>
        </CindorButton>
      </div>
    </div>

    <CindorAlert v-if="error" tone="danger" class="page-alert">
      {{ error }}
    </CindorAlert>

    <div v-if="result" class="summary-row">
      <CindorStatCard label="Total Movies" :value="String(result.summary.total)" tone="neutral" />
      <CindorStatCard label="Unmanaged" :value="String(result.summary.unmanaged)" tone="negative" />
      <CindorStatCard label="In Radarr" :value="String(result.summary.total - result.summary.unmanaged)" tone="positive" />
    </div>

    <div v-if="result && result.unmanaged.length > 0" class="section">
      <h2 class="section-title">
        <AppIcon name="pi-exclamation-circle" :size="18" />
        Unmanaged Movies ({{ result.unmanaged.length }})
      </h2>
      <AppDataTable
        :columns="tableColumns"
        :rows="result.unmanaged"
        empty-message="No unmanaged movies."
        row-key="plexRatingKey"
        :rows-per-page="25"
      >
        <template #cell-title="{ row }">
          <div class="title-cell">
            <span>{{ row.title }}</span>
            <span class="movie-year">{{ row.year }}</span>
          </div>
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

    <div v-if="result && result.unmanaged.length === 0 && !loading" class="empty-state">
      <AppIcon name="pi-check-circle" :size="42" />
      <p>All movies in Plex are managed by Radarr.</p>
    </div>

    <div v-if="loading" class="loading-state">
      <CindorSpinner />
      <p>Comparing Plex library against Radarr...</p>
    </div>

    <div v-if="!result && !loading" class="idle-state">
      <AppIcon name="pi-search" :size="42" />
      <p>Run a check to find movies in Plex that aren't tracked by Radarr.</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCoverageStore } from '../stores/coverage'
import { CindorAlert, CindorButton, CindorSpinner, CindorStatCard } from 'cindor-ui-vue'
import AppDataTable from '../components/AppDataTable.vue'
import AppExternalLink from '../components/AppExternalLink.vue'
import AppIcon from '../components/AppIcon.vue'

const store = useCoverageStore()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const plexBaseUrl = computed(() => store.result?.summary?.plexUrl || '')
const plexMachineId = computed(() => store.result?.summary?.plexMachineId || '')

const tableColumns = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'sectionTitle', label: 'Library', sortable: true },
  { key: 'reason', label: 'Reason' },
  { key: 'links', label: 'Links', width: '5rem' },
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

function plexLink(ratingKey) {
  const key = encodeURIComponent(`/library/metadata/${ratingKey}`)
  return `${plexBaseUrl.value}/web/index.html#!/server/${plexMachineId.value}/details?key=${key}`
}
</script>
