import { ref } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'

const CHUNK_RELOAD_KEY = 'plex-issue-finder:chunk-reload-target'
export const routeLoading = ref(false)

function isDynamicImportError(error) {
  const message = error instanceof Error ? error.message : String(error || '')
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: {
        title: 'Dashboard',
        section: 'Workspace',
      },
    },
    {
      path: '/movies/duration',
      name: 'movie-duration',
      component: () => import('../views/MovieDurationView.vue'),
      meta: {
        title: 'Movie Duration Check',
        section: 'Diagnostics',
      },
    },
    {
      path: '/movies/quality',
      name: 'movie-quality',
      component: () => import('../views/MovieQualityView.vue'),
      meta: {
        title: 'Video Quality Check',
        section: 'Diagnostics',
      },
    },
    {
      path: '/coverage',
      name: 'coverage',
      component: () => import('../views/CoverageView.vue'),
      meta: {
        title: 'Unmanaged Movies',
        section: 'Diagnostics',
      },
    },
    {
      path: '/sonarr/monitoring',
      name: 'sonarr-monitoring',
      component: () => import('../views/SonarrMonitoringView.vue'),
      meta: {
        title: 'Unmonitored Episodes',
        section: 'Diagnostics',
      },
    },
    {
      path: '/sonarr/duration',
      name: 'episode-duration',
      component: () => import('../views/EpisodeDurationView.vue'),
      meta: {
        title: 'Episode Duration Check',
        section: 'Diagnostics',
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: {
        title: 'Settings',
        section: 'Configuration',
      },
    },
  ],
})

router.beforeEach((to, from) => {
  routeLoading.value = to.fullPath !== from.fullPath
})

router.onError((error, to) => {
  routeLoading.value = false

  if (!isDynamicImportError(error)) {
    return
  }

  const reloadTarget = to?.fullPath || window.location.pathname || '/'
  const previousTarget = sessionStorage.getItem(CHUNK_RELOAD_KEY)

  if (previousTarget === reloadTarget) {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    return
  }

  sessionStorage.setItem(CHUNK_RELOAD_KEY, reloadTarget)
  window.location.assign(reloadTarget)
})

router.afterEach(() => {
  routeLoading.value = false
  sessionStorage.removeItem(CHUNK_RELOAD_KEY)
})

export default router
