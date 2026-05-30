<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppIcon from './AppIcon.vue'

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { to: '/', icon: 'pi-home', label: 'Dashboard' },
      { to: '/settings', icon: 'pi-cog', label: 'Settings' },
    ],
  },
  {
    label: 'Diagnostics',
    items: [
      { to: '/movies/duration', icon: 'pi-clock', label: 'Movie duration' },
      { to: '/movies/quality', icon: 'pi-video', label: 'Video quality' },
      { to: '/coverage', icon: 'pi-search', label: 'Unmanaged movies' },
      { to: '/sonarr/duration', icon: 'pi-clock', label: 'Episode duration' },
      { to: '/sonarr/monitoring', icon: 'pi-list', label: 'Unmonitored episodes' },
    ],
  },
]

const route = useRoute()
const mobileMenuOpen = ref(false)

const allItems = computed(() => navGroups.flatMap((group) => group.items))

watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false
  },
)
</script>

<template>
  <div class="app-nav-shell">
    <header class="app-nav-mobile-bar">
      <router-link to="/" class="app-nav__brand">
        <span class="app-nav__mark">PI</span>
        <strong class="app-nav__brand-title">Plex Issue Finder</strong>
      </router-link>

      <button
        type="button"
        class="app-nav-mobile-toggle"
        :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
        aria-controls="app-mobile-nav-drawer"
        aria-label="Open navigation menu"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <AppIcon :name="mobileMenuOpen ? 'pi-times' : 'pi-bars'" :size="18" />
      </button>
    </header>

    <button
      v-if="mobileMenuOpen"
      type="button"
      class="app-nav__backdrop"
      aria-label="Close navigation menu"
      @click="mobileMenuOpen = false"
    />

    <aside
      id="app-mobile-nav-drawer"
      class="app-nav"
      :class="{ 'app-nav--mobile-open': mobileMenuOpen }"
    >
      <router-link to="/" class="app-nav__brand app-nav__brand--desktop">
        <span class="app-nav__mark">PI</span>
        <strong class="app-nav__brand-title">Plex Issue Finder</strong>
      </router-link>

      <nav class="app-nav-mobile-tabs" aria-label="Primary navigation">
        <router-link
          v-for="item in allItems"
          :key="item.to"
          :to="item.to"
          class="app-nav-mobile-tab"
          exact-active-class="app-nav-mobile-tab--active"
        >
          <AppIcon :name="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </router-link>
      </nav>

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
  </div>
</template>

<style scoped>
.app-nav-shell {
  display: contents;
}

.app-nav {
  width: 248px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background: var(--bg-subtle);
  border-right: 1px solid var(--border);
  position: relative;
  z-index: 20;
}

.app-nav-mobile-bar,
.app-nav-mobile-tabs,
.app-nav__backdrop {
  display: none;
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

.app-nav__brand--desktop {
  display: flex;
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
  .app-nav-mobile-bar {
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0 var(--space-4);
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--bg-subtle) 94%, transparent);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 30;
  }

  .app-nav__brand--desktop {
    display: none;
  }

  .app-nav-mobile-toggle {
    width: 40px;
    height: 40px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--surface);
    color: var(--fg);
    box-shadow: var(--shadow-sm);
  }

  .app-nav__backdrop {
    display: block;
    position: fixed;
    inset: 64px 0 0;
    background: color-mix(in srgb, var(--bg) 66%, transparent);
    border: 0;
    padding: 0;
    z-index: 18;
  }

  .app-nav {
    width: min(320px, calc(100vw - 24px));
    max-width: 100%;
    height: calc(100vh - 76px);
    position: fixed;
    top: 72px;
    left: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    transform: translateY(-8px) scale(0.98);
    opacity: 0;
    pointer-events: none;
    transition:
      transform var(--duration-fast) var(--ease-out),
      opacity var(--duration-fast) var(--ease-out);
    overflow: hidden;
  }

  .app-nav--mobile-open {
    transform: translateY(0) scale(1);
    opacity: 1;
    pointer-events: auto;
  }

  .app-nav-mobile-tabs {
    display: flex;
    gap: var(--space-2);
    overflow-x: auto;
    padding: var(--space-3) var(--space-3) 0;
    border-bottom: 1px solid var(--border);
    background: color-mix(in srgb, var(--surface) 90%, transparent);
  }

  .app-nav-mobile-tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 36px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border);
    border-radius: 999px;
    white-space: nowrap;
    color: var(--fg-muted);
    background: var(--surface);
  }

  .app-nav-mobile-tab--active {
    color: var(--fg);
    border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  }

  .app-nav__groups {
    overflow: auto;
    padding-bottom: var(--space-4);
  }
}
</style>
