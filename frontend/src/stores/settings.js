import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiGet, apiPost } from '../api/client'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({
    plex_url: '',
    plex_token: '',
    radarr_url: '',
    radarr_api_key: '',
    sonarr_url: '',
    sonarr_api_key: '',
    leeway_percent: '5',
    plex_library_ids: '',
    quality_thresholds: '{}',
    plex_token_set: false,
    radarr_api_key_set: false,
    sonarr_api_key_set: false,
  })
  const loading = ref(false)
  const saveError = ref(null)

  async function fetchSettings() {
    loading.value = true
    try {
      const data = await apiGet('/api/settings')
      settings.value = data
    } catch {
      // Silently fall back to defaults — fetch errors are non-fatal
    } finally {
      loading.value = false
    }
  }

  async function saveSettings(payload) {
    loading.value = true
    saveError.value = null
    try {
      await apiPost('/api/settings', payload)
      await fetchSettings()
    } catch (e) {
      saveError.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  return { settings, loading, saveError, fetchSettings, saveSettings }
})
