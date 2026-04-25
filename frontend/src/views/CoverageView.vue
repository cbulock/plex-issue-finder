<template>
  <div class="coverage-view app-page app-page--wide">
    <div class="page-header">
      <div>
        <p>
          Movies in Plex that have no matching entry in Radarr — they won't receive quality upgrades or monitoring.
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
        <div class="summary-num">{{ result.summary.unmanaged }}</div>
        <div class="summary-label">Unmanaged</div>
      </div>
      <div class="summary-card summary-ok">
        <div class="summary-num">{{ result.summary.total - result.summary.unmanaged }}</div>
        <div class="summary-label">In Radarr</div>
      </div>
    </div>

    <!-- Unmanaged table -->
    <div v-if="result && result.unmanaged.length > 0" class="section">
      <h2 class="section-title">
        <i class="pi pi-exclamation-circle" style="color: var(--accent)" />
        Unmanaged Movies ({{ result.unmanaged.length }})
      </h2>
      <DataTable
        :value="result.unmanaged"
        :paginator="result.unmanaged.length > 25"
        :rows="25"
        striped-rows
        size="small"
      >
        <Column field="title" header="Title" sortable>
          <template #body="{ data }">
            <div class="title-cell">
              <span>{{ data.title }}</span>
              <span class="movie-year">{{ data.year }}</span>
            </div>
          </template>
        </Column>
        <Column field="sectionTitle" header="Library" sortable />
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

    <div v-if="result && result.unmanaged.length === 0 && !loading" class="empty-state">
      <i class="pi pi-check-circle" />
      <p>All movies in Plex are managed by Radarr.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <ProgressSpinner style="width: 48px; height: 48px" />
      <p>Comparing Plex library against Radarr…</p>
    </div>

    <!-- Idle -->
    <div v-if="!result && !loading" class="idle-state">
      <i class="pi pi-search" />
      <p>Run a check to find movies in Plex that aren't tracked by Radarr.</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCoverageStore } from '../stores/coverage'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

const store = useCoverageStore()

const result = computed(() => store.result)
const loading = computed(() => store.loading)
const error = computed(() => store.error)

const plexBaseUrl = computed(() => store.result?.summary?.plexUrl || '')
const plexMachineId = computed(() => store.result?.summary?.plexMachineId || '')

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

