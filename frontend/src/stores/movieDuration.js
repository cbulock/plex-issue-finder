import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'
import { apiGet } from '../api/client'

const STORAGE_KEY = 'plex-movie-duration-results'

function hasCompleteSummary(result) {
  return result?.summary && result.summary.minDiffMinutes != null && result.summary.leewayPercent != null
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { result: null, lastRun: null }
    const parsed = JSON.parse(raw)
    const persistedResult = parsed.result && hasCompleteSummary(parsed.result)
      ? markRaw(parsed.result)
      : null

    if (parsed.result && !persistedResult) {
      localStorage.removeItem(STORAGE_KEY)
    }

    return {
      result: persistedResult,
      lastRun: parsed.lastRun ? new Date(parsed.lastRun) : null,
    }
  } catch {
    return { result: null, lastRun: null }
  }
}

function saveToStorage(result, lastRun) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ result, lastRun }))
  } catch (e) {
    console.warn('[MovieDuration] Could not persist results to localStorage:', e.message)
  }
}

export const useMovieDurationStore = defineStore('movieDuration', () => {
  const persisted = loadFromStorage()
  const result = ref(persisted.result)
  const lastRun = ref(persisted.lastRun)
  const loading = ref(false)
  const error = ref(null)

  async function runCheck(force = false) {
    loading.value = true
    error.value = null
    try {
      const data = await apiGet(`/api/movies/check${force ? '?force=true' : ''}`)
      // markRaw prevents Vue from making the large result arrays deeply reactive,
      // which would cause PrimeVue DataTable's internal sorting to trigger infinite update loops.
      result.value = markRaw(data)
      lastRun.value = new Date()
      saveToStorage(data, lastRun.value)
    } catch (e) {
      error.value = e.message
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

  return { result, loading, error, lastRun, runCheck, clearResults }
})
