<template>
  <div class="dashboard">
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Select a tool to diagnose and fix your Plex library.</p>
    </div>

    <div class="feature-grid">
      <router-link
        v-for="feature in features"
        :key="feature.route"
        :to="feature.route"
        class="feature-card"
      >
        <div class="feature-icon">
          <i :class="`pi ${feature.icon}`" />
        </div>
        <div class="feature-body">
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </div>
        <i class="pi pi-arrow-right feature-arrow" />
      </router-link>
    </div>
  </div>
</template>

<script setup>
const features = [
  {
    route: '/movies/duration',
    icon: 'pi-clock',
    title: 'Movie Duration Check',
    description:
      'Compare actual movie durations in Plex against expected runtimes from Radarr. Flag movies that appear to be incomplete downloads.',
  },
  {
    route: '/movies/quality',
    icon: 'pi-video',
    title: 'Video Quality Check',
    description:
      'Flag movies below your library\'s minimum resolution threshold. Configure per-library quality floors in Settings.',
  },
  {
    route: '/coverage',
    icon: 'pi-search',
    title: 'Unmanaged Movies',
    description:
      'Find movies in Plex that have no matching entry in Radarr. These movies won\'t receive quality upgrades or monitoring.',
  },
  {
    route: '/sonarr/monitoring',
    icon: 'pi-list',
    title: 'Unmonitored Episodes',
    description:
      'Find shows in Sonarr with unmonitored seasons or episodes. Enable monitoring directly from the results.',
  },
  {
    route: '/sonarr/duration',
    icon: 'pi-clock',
    title: 'Episode Duration Check',
    description:
      'Compare actual TV episode durations in Plex against expected runtimes from Sonarr. Flag episodes that appear to be incomplete downloads.',
  },
]
</script>

<style scoped>
.dashboard {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0 0 0.4rem;
  font-size: 1.8rem;
}

.page-header p {
  color: #b0b8c8;
  margin: 0;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--p-surface-700, #2a2a3e);
  background: var(--p-surface-800, #16213e);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.feature-card:hover {
  border-color: var(--p-primary-400, #e5a00d);
  box-shadow: 0 4px 16px rgba(229, 160, 13, 0.15);
}

.feature-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: rgba(229, 160, 13, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-icon i {
  font-size: 1.4rem;
  color: var(--p-primary-400, #e5a00d);
}

.feature-body {
  flex: 1;
}

.feature-body h3 {
  margin: 0 0 0.3rem;
  font-size: 1rem;
}

.feature-body p {
  margin: 0;
  font-size: 0.9rem;
  color: #b0b8c8;
  line-height: 1.5;
}

.feature-arrow {
  color: var(--p-text-muted-color, #888);
  font-size: 0.9rem;
}
</style>
