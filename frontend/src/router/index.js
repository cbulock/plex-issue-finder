import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/movies/duration',
      name: 'movie-duration',
      component: () => import('../views/MovieDurationView.vue'),
    },
    {
      path: '/movies/quality',
      name: 'movie-quality',
      component: () => import('../views/MovieQualityView.vue'),
    },
    {
      path: '/coverage',
      name: 'coverage',
      component: () => import('../views/CoverageView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
  ],
})

export default router
