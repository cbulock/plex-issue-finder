<script setup>
import AppIcon from './AppIcon.vue'

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/', icon: 'home', label: 'Dashboard' },
      { to: '/settings', icon: 'settings', label: 'Settings' },
    ],
  },
  {
    label: 'Diagnostics',
    items: [
      { to: '/movies/duration', icon: 'clock', label: 'Movie duration' },
      { to: '/movies/quality', icon: 'video', label: 'Video quality' },
      { to: '/coverage', icon: 'search', label: 'Unmanaged movies' },
      { to: '/sonarr/duration', icon: 'clock', label: 'Episode duration' },
      { to: '/sonarr/monitoring', icon: 'list', label: 'Unmonitored episodes' },
    ],
  },
]
</script>

<template>
  <aside class="app-nav">
    <router-link to="/" class="app-nav__brand">
      <span class="app-nav__mark">PI</span>
      <strong class="app-nav__brand-title">Plex Issue Finder</strong>
    </router-link>

    <div class="app-nav__groups">
      <section v-for="group in navGroups" :key="group.label" class="app-nav__group">
        <h2 class="app-nav__label">{{ group.label }}</h2>
        <nav class="app-nav__items">
          <router-link
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="app-nav__item"
            exact-active-class="app-nav__item--active"
          >
            <AppIcon :name="item.icon" :size="18" />
            <span class="app-nav__item-label">{{ item.label }}</span>
          </router-link>
        </nav>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.app-nav {
  width: 248px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--bg-subtle);
  border-right: 1px solid var(--border);
}

.app-nav__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 56px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--border);
  color: var(--fg);
}

.app-nav__brand:hover {
  border-bottom-color: var(--border);
}

.app-nav__mark {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-mark);
  color: #fff;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.app-nav__brand-title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
}

.app-nav__groups {
  flex: 1;
  overflow: auto;
  padding: var(--space-3) var(--space-2);
}

.app-nav__group + .app-nav__group {
  margin-top: var(--space-4);
}

.app-nav__label {
  margin: 0 0 var(--space-2);
  padding: 0 var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  color: var(--fg-subtle);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.app-nav__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.app-nav__item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 42px;
  padding: var(--space-2) var(--space-3);
  border-left: 2px solid transparent;
  border-radius: var(--radius-md);
  color: var(--fg-muted);
  transition:
    background var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.app-nav__item:hover {
  background: var(--bg-muted);
  color: var(--fg);
}

.app-nav__item:hover i {
  color: var(--accent);
}

.app-nav__item :deep(cindor-icon) {
  color: var(--fg-subtle);
}

.app-nav__item--active {
  background: var(--bg-muted);
  border-left-color: var(--accent);
  color: var(--fg);
}

.app-nav__item--active :deep(cindor-icon) {
  color: var(--accent);
}

.app-nav__item-label {
  font-size: var(--text-base);
  line-height: var(--leading-snug);
}

@media (max-width: 960px) {
  .app-nav {
    width: 100%;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .app-nav__groups {
    overflow: visible;
    padding-bottom: var(--space-2);
  }
}
</style>
