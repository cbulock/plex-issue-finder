<template>
  <div class="dashboard">
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>Select a tool to diagnose and fix your Plex library.</p>
    </div>

    <section
      v-for="category in categories"
      :key="category.title"
      class="category-section"
    >
      <div class="category-header">
        <div>
          <h2>{{ category.title }}</h2>
          <p>{{ category.description }}</p>
        </div>
      </div>

      <div class="feature-grid">
        <router-link
          v-for="feature in category.features"
          :key="feature.route"
          :to="feature.route"
          class="feature-card"
        >
          <div class="feature-icon">
            <i :class="`pi ${feature.icon}`" />
          </div>
          <div class="feature-body">
            <div class="feature-topline">
              <h3>{{ feature.title }}</h3>
              <span class="feature-scope">{{ feature.scope }}</span>
            </div>
            <p>{{ feature.description }}</p>
          </div>
          <i class="pi pi-arrow-right feature-arrow" />
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup>
const categories = [
  {
    title: 'Duration Checks',
    description:
      'Compare Plex runtimes against Radarr and Sonarr expectations to catch incomplete or mismatched files.',
    features: [
      {
        route: '/movies/duration',
        icon: 'pi-clock',
        title: 'Movie Duration Check',
        scope: 'Movies',
        description:
          'Compare actual movie durations in Plex against expected runtimes from Radarr. Flag movies that appear to be incomplete downloads.',
      },
      {
        route: '/sonarr/duration',
        icon: 'pi-clock',
        title: 'Episode Duration Check',
        scope: 'TV',
        description:
          'Compare actual TV episode durations in Plex against expected runtimes from Sonarr. Flag episodes that appear to be incomplete downloads.',
      },
    ],
  },
  {
    title: 'Movie Library Checks',
    description:
      'Review movie quality and coverage issues that affect upgrades, monitoring, and overall library health.',
    features: [
      {
        route: '/movies/quality',
        icon: 'pi-video',
        title: 'Video Quality Check',
        scope: 'Movies',
        description:
          'Flag movies below your library\'s minimum resolution threshold. Configure per-library quality floors in Settings.',
      },
      {
        route: '/coverage',
        icon: 'pi-search',
        title: 'Unmanaged Movies',
        scope: 'Movies',
        description:
          'Find movies in Plex that have no matching entry in Radarr. These movies won\'t receive quality upgrades or monitoring.',
      },
    ],
  },
  {
    title: 'TV Monitoring',
    description:
      'Find Sonarr monitoring gaps and repair them directly from the results.',
    features: [
      {
        route: '/sonarr/monitoring',
        icon: 'pi-list',
        title: 'Unmonitored Episodes',
        scope: 'TV',
        description:
          'Find shows in Sonarr with unmonitored seasons or episodes. Enable monitoring directly from the results.',
      },
    ],
  },
]
</script>

<style scoped>
.dashboard {
  max-width: 1040px;
  margin: 0 auto;
  padding: 2rem 1.5rem 2.5rem;
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

.category-section + .category-section {
  margin-top: 2rem;
}

.category-header {
  margin-bottom: 1rem;
}

.category-header h2 {
  margin: 0 0 0.35rem;
  font-size: 1.15rem;
}

.category-header p {
  margin: 0;
  color: #b0b8c8;
  font-size: 0.92rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.feature-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1rem;
  border-radius: 12px;
  border: 1px solid var(--p-surface-700, #2a2a3e);
  background: var(--p-surface-800, #16213e);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  cursor: pointer;
}

.feature-card:hover {
  border-color: var(--p-primary-400, #e5a00d);
  box-shadow: 0 6px 18px rgba(229, 160, 13, 0.14);
  transform: translateY(-1px);
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
  min-width: 0;
}

.feature-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.35rem;
}

.feature-body h3 {
  margin: 0;
  font-size: 1rem;
}

.feature-scope {
  flex-shrink: 0;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(229, 160, 13, 0.12);
  color: var(--p-primary-400, #e5a00d);
  font-size: 0.76rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
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

@media (max-width: 640px) {
  .dashboard {
    padding: 1.5rem 1rem 2rem;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .feature-topline {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
