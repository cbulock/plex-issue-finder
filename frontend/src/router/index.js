import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'

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

export default router
