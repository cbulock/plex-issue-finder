import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'

const STORAGE_KEY = 'plex-sonarr-monitoring-results'

export const useSonarrMonitoringStore = defineStore('sonarrMonitoring', () => {
  const result = ref(null)
  const lastRun = ref(null)
  const loading = ref(false)
  const error = ref(null)

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const { result: r, lastRun: lr } = JSON.parse(raw)
      if (r) result.value = markRaw(r)
      if (lr) lastRun.value = new Date(lr)
    } catch { /* ignore */ }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ result: result.value, lastRun: lastRun.value }))
    } catch { /* ignore */ }
  }

  async function runCheck() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/sonarr/check')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Check failed')
      result.value = markRaw(data)
      lastRun.value = new Date()
      saveToStorage()
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  function clearResults() {
    result.value = null
    error.value = null
    lastRun.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  loadFromStorage()

  return { result, lastRun, loading, error, runCheck, clearResults }
})
