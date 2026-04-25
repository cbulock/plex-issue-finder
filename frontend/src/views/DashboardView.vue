<template>
  <div class="dashboard app-page">
    <div class="page-header">
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
  padding-top: var(--space-8);
}

.category-section + .category-section {
  margin-top: var(--space-8);
}

.category-header {
  margin-bottom: var(--space-4);
}

.category-header h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xl);
}

.category-header p {
  margin: 0;
  color: var(--fg-muted);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
  gap: var(--space-4);
}

.feature-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  text-decoration: none;
  color: var(--fg);
  box-shadow: var(--shadow-sm);
  transition:
    border-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    transform var(--duration-fast) var(--ease-out);
  cursor: pointer;
}

.feature-card:hover {
  border-color: color-mix(in srgb, var(--accent) 44%, var(--border));
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.feature-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--accent) 38%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-icon i {
  font-size: 1.1rem;
  color: var(--accent);
}

.feature-body {
  flex: 1;
  min-width: 0;
}

.feature-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.feature-body h3 {
  margin: 0;
  font-size: var(--text-md);
}

.feature-scope {
  flex-shrink: 0;
  min-height: 20px;
  padding: 0 var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-subtle);
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.feature-body p {
  margin: 0;
  color: var(--fg-muted);
}

.feature-arrow {
  color: var(--fg-subtle);
  font-size: var(--text-sm);
  padding-top: 2px;
}

@media (max-width: 640px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }

  .feature-topline {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
