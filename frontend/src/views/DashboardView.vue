<template>
  <div class="dashboard app-page">
    <div class="page-header">
      <div>
        <p>Check setup health, review the latest saved scan snapshots, and jump back into the diagnostics that need attention.</p>
      </div>
      <div class="header-actions">
        <router-link to="/settings" class="dashboard-link-card dashboard-link-card--compact">
          <AppIcon name="settings" :size="16" />
          <span>Open Settings</span>
        </router-link>
      </div>
    </div>

    <section class="dashboard-section">
      <div class="dashboard-section__header">
        <div>
          <h2>Setup Status</h2>
          <p>Quick check that Plex, Radarr, and Sonarr are configured well enough to run the diagnostic tools.</p>
        </div>
        <AppTag :value="`${configuredServiceCount}/3 connected`" :severity="configuredServiceCount === 3 ? 'success' : 'warn'" />
      </div>

      <div class="setup-grid">
        <article
          v-for="service in serviceStatus"
          :key="service.name"
          class="setup-card"
        >
          <div class="setup-card__topline">
            <div class="setup-card__title">
              <AppIcon :name="service.icon" :size="18" />
              <h3>{{ service.name }}</h3>
            </div>
            <AppTag :value="service.connected ? 'Ready' : 'Needs setup'" :severity="service.connected ? 'success' : 'warn'" />
          </div>
          <p>{{ service.description }}</p>
        </article>
      </div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section__header">
        <div>
          <h2>Recent Scan Snapshots</h2>
          <p>These cards reflect the most recent saved results from this browser session, so you can see where things stood last time you ran a check.</p>
        </div>
      </div>

      <div class="snapshot-grid">
        <router-link
          v-for="snapshot in snapshots"
          :key="snapshot.route"
          :to="snapshot.route"
          class="dashboard-link-card"
        >
          <div class="snapshot-card__topline">
            <div class="snapshot-card__title">
              <div class="snapshot-card__icon">
                <AppIcon :name="snapshot.icon" :size="18" />
              </div>
              <div>
                <h3>{{ snapshot.title }}</h3>
                <p>{{ snapshot.description }}</p>
              </div>
            </div>
            <AppIcon class="snapshot-card__arrow" name="arrow-right" :size="16" />
          </div>

          <div class="snapshot-card__meta">
            <AppTag :value="snapshot.statusLabel" :severity="snapshot.statusSeverity" />
            <span class="snapshot-card__time">{{ snapshot.lastRunLabel }}</span>
          </div>

          <div class="snapshot-card__stats">
            <div
              v-for="stat in snapshot.stats"
              :key="stat.label"
              class="snapshot-stat"
            >
              <span class="snapshot-stat__label">{{ stat.label }}</span>
              <strong class="snapshot-stat__value">{{ stat.value }}</strong>
            </div>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import AppTag from '../components/AppTag.vue'
import { useCoverageStore } from '../stores/coverage'
import { useEpisodeDurationStore } from '../stores/episodeDuration'
import { useMovieDurationStore } from '../stores/movieDuration'
import { useMovieQualityStore } from '../stores/movieQuality'
import { useSettingsStore } from '../stores/settings'
import { useSonarrMonitoringStore } from '../stores/sonarrMonitoring'

const settingsStore = useSettingsStore()
const movieDurationStore = useMovieDurationStore()
const movieQualityStore = useMovieQualityStore()
const coverageStore = useCoverageStore()
const episodeDurationStore = useEpisodeDurationStore()
const sonarrMonitoringStore = useSonarrMonitoringStore()

onMounted(() => {
  if (!settingsStore.settings.plex_url && !settingsStore.settings.radarr_url && !settingsStore.settings.sonarr_url) {
    settingsStore.fetchSettings()
  }
})

const serviceStatus = computed(() => [
  {
    name: 'Plex',
    icon: 'circle-play',
    connected: Boolean(settingsStore.settings.plex_url && settingsStore.settings.plex_token_set),
    description: settingsStore.settings.plex_url
      ? 'Server URL saved. Token is ready for library and runtime scans.'
      : 'Add your Plex server URL and token to unlock library-aware checks.',
  },
  {
    name: 'Radarr',
    icon: 'database',
    connected: Boolean(settingsStore.settings.radarr_url && settingsStore.settings.radarr_api_key_set),
    description: settingsStore.settings.radarr_url
      ? 'Server URL saved. Radarr-backed movie checks can use existing credentials.'
      : 'Add Radarr to enable movie duration, quality, and unmanaged movie checks.',
  },
  {
    name: 'Sonarr',
    icon: 'list',
    connected: Boolean(settingsStore.settings.sonarr_url && settingsStore.settings.sonarr_api_key_set),
    description: settingsStore.settings.sonarr_url
      ? 'Server URL saved. Sonarr-backed TV checks can use existing credentials.'
      : 'Add Sonarr to enable episode duration and monitoring diagnostics.',
  },
])

const configuredServiceCount = computed(() => serviceStatus.value.filter((service) => service.connected).length)

function formatLastRun(lastRun) {
  if (!lastRun) return 'No saved run yet'
  return `Saved ${lastRun.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${lastRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function snapshotStatus(hasResult, issueCount) {
  if (!hasResult) {
    return { label: 'Not run yet', severity: 'warn' }
  }

  if (issueCount > 0) {
    return { label: `${issueCount} issue${issueCount === 1 ? '' : 's'} found`, severity: 'warn' }
  }

  return { label: 'Last run was clean', severity: 'success' }
}

const snapshots = computed(() => {
  const movieDurationIssues = movieDurationStore.result?.summary?.flagged ?? 0
  const movieQualityIssues = movieQualityStore.result?.summary?.flagged ?? 0
  const unmanagedMovies = coverageStore.result?.summary?.unmanaged ?? 0
  const episodeDurationIssues = episodeDurationStore.result?.summary?.flagged ?? 0
  const unmonitoredSeries = sonarrMonitoringStore.result?.summary?.seriesWithIssues ?? 0

  const items = [
    {
      route: '/movies/duration',
      icon: 'clock',
      title: 'Movie Duration Check',
      description: 'Saved movie runtime comparison against Radarr expectations.',
      lastRun: movieDurationStore.lastRun,
      hasResult: Boolean(movieDurationStore.result),
      issueCount: movieDurationIssues,
      stats: [
        { label: 'Flagged', value: String(movieDurationIssues) },
        { label: 'No Match', value: String(movieDurationStore.result?.summary?.noMatch ?? 0) },
      ],
    },
    {
      route: '/movies/quality',
      icon: 'video',
      title: 'Video Quality Check',
      description: 'Saved movie quality snapshot against your configured thresholds.',
      lastRun: movieQualityStore.lastRun,
      hasResult: Boolean(movieQualityStore.result),
      issueCount: movieQualityIssues,
      stats: [
        { label: 'Below Threshold', value: String(movieQualityIssues) },
        { label: 'Above Threshold', value: String(movieQualityStore.result?.summary?.overThreshold ?? 0) },
      ],
    },
    {
      route: '/coverage',
      icon: 'search',
      title: 'Unmanaged Movies',
      description: 'Saved snapshot of Plex movies that are missing from Radarr.',
      lastRun: coverageStore.lastRun,
      hasResult: Boolean(coverageStore.result),
      issueCount: unmanagedMovies,
      stats: [
        { label: 'Unmanaged', value: String(unmanagedMovies) },
        { label: 'Total Movies', value: String(coverageStore.result?.summary?.total ?? 0) },
      ],
    },
    {
      route: '/sonarr/duration',
      icon: 'clock',
      title: 'Episode Duration Check',
      description: 'Saved episode runtime comparison against Sonarr expectations.',
      lastRun: episodeDurationStore.lastRun,
      hasResult: Boolean(episodeDurationStore.result),
      issueCount: episodeDurationIssues,
      stats: [
        { label: 'Flagged', value: String(episodeDurationIssues) },
        { label: 'No Runtime', value: String(episodeDurationStore.result?.summary?.noMatch ?? 0) },
      ],
    },
    {
      route: '/sonarr/monitoring',
      icon: 'list',
      title: 'Unmonitored Episodes',
      description: 'Saved monitoring snapshot for Sonarr series, seasons, and episodes.',
      lastRun: sonarrMonitoringStore.lastRun,
      hasResult: Boolean(sonarrMonitoringStore.result),
      issueCount: unmonitoredSeries,
      stats: [
        { label: 'Series With Issues', value: String(unmonitoredSeries) },
        { label: 'Unmonitored Episodes', value: String(sonarrMonitoringStore.result?.summary?.totalUnmonitoredEpisodes ?? 0) },
      ],
    },
  ]

  return items.map((item) => {
    const status = snapshotStatus(item.hasResult, item.issueCount)
    return {
      ...item,
      lastRunLabel: formatLastRun(item.lastRun),
      statusLabel: status.label,
      statusSeverity: status.severity,
    }
  })
})
</script>

<style scoped>
.dashboard {
  padding-top: var(--space-8);
}

.dashboard-section + .dashboard-section {
  margin-top: var(--space-8);
}

.dashboard-section__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.dashboard-section__header h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xl);
}

.dashboard-section__header p {
  margin: 0;
  max-width: 72ch;
  color: var(--fg-muted);
}

.setup-grid,
.snapshot-grid {
  display: grid;
  gap: var(--space-4);
}

.setup-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.snapshot-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.setup-card,
.dashboard-link-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow: var(--shadow-sm);
}

.setup-card {
  padding: var(--space-4);
}

.setup-card__topline,
.snapshot-card__topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.setup-card__title,
.snapshot-card__title {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}

.setup-card__title h3,
.snapshot-card__title h3 {
  margin: 0 0 var(--space-1);
  font-size: var(--text-md);
}

.setup-card p,
.snapshot-card__title p {
  margin: 0;
  color: var(--fg-muted);
}

.dashboard-link-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  color: var(--fg);
  text-decoration: none;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
}

.dashboard-link-card:hover {
  border-color: color-mix(in srgb, var(--accent) 44%, var(--border));
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.dashboard-link-card--compact {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}

.snapshot-card__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.snapshot-card__icon :deep(cindor-icon),
.setup-card__title :deep(cindor-icon) {
  color: var(--accent);
}

.snapshot-card__arrow {
  color: var(--fg-subtle);
  padding-top: 2px;
  flex-shrink: 0;
}

.snapshot-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.snapshot-card__time {
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.snapshot-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.snapshot-stat {
  padding-top: var(--space-3);
  border-top: 1px solid var(--border);
}

.snapshot-stat__label {
  display: block;
  margin-bottom: var(--space-1);
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.snapshot-stat__value {
  font-size: var(--text-lg);
}

@media (max-width: 640px) {
  .snapshot-card__stats {
    grid-template-columns: 1fr;
  }
}
</style>
