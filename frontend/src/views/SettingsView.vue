<template>
  <div class="settings-view">
    <div class="page-header">
      <h1>Settings</h1>
      <p>Configure your Plex, Radarr, and Sonarr connection details.</p>
    </div>

    <form @submit.prevent="handleSave" class="settings-form">
      <Card class="settings-card">
        <template #title>
          <span><i class="pi pi-play-circle" style="margin-right: 8px" />Plex Media Server</span>
        </template>
        <template #content>
          <div class="field">
            <label for="plex_url">Server URL</label>
            <InputText
              id="plex_url"
              v-model="form.plex_url"
              placeholder="http://192.168.1.x:32400"
              class="w-full"
            />
            <small>Include protocol and port, e.g. http://192.168.1.50:32400</small>
          </div>
          <div class="field">
            <label for="plex_token">API Token</label>
            <Password
              id="plex_token"
              v-model="form.plex_token"
              :placeholder="store.settings.plex_token_set ? '(saved — enter to change)' : 'Your Plex token'"
              :feedback="false"
              toggle-mask
              class="w-full"
            />
            <small>
              Find your token at
              <a
                href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                target="_blank"
                rel="noopener"
              >
                support.plex.tv
              </a>
            </small>
          </div>
        </template>
      </Card>

      <Card class="settings-card">
        <template #title>
          <span><i class="pi pi-database" style="margin-right: 8px" />Radarr</span>
        </template>
        <template #content>
          <div class="field">
            <label for="radarr_url">Server URL</label>
            <InputText
              id="radarr_url"
              v-model="form.radarr_url"
              placeholder="http://192.168.1.x:7878"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="radarr_api_key">API Key</label>
            <Password
              id="radarr_api_key"
              v-model="form.radarr_api_key"
              :placeholder="store.settings.radarr_api_key_set ? '(saved — enter to change)' : 'Your Radarr API key'"
              :feedback="false"
              toggle-mask
              class="w-full"
            />
            <small>Found in Radarr → Settings → General → Security</small>
          </div>
        </template>
      </Card>

      <Card class="settings-card">
        <template #title>
          <span><i class="pi pi-list" style="margin-right: 8px" />Sonarr</span>
        </template>
        <template #content>
          <div class="field">
            <label for="sonarr_url">Server URL</label>
            <InputText
              id="sonarr_url"
              v-model="form.sonarr_url"
              placeholder="http://192.168.1.x:8989"
              class="w-full"
            />
          </div>
          <div class="field">
            <label for="sonarr_api_key">API Key</label>
            <Password
              id="sonarr_api_key"
              v-model="form.sonarr_api_key"
              :placeholder="store.settings.sonarr_api_key_set ? '(saved — enter to change)' : 'Your Sonarr API key'"
              :feedback="false"
              toggle-mask
              class="w-full"
            />
            <small>Found in Sonarr → Settings → General → Security</small>
          </div>
        </template>
      </Card>

      <Card class="settings-card">
        <template #title>
          <span><i class="pi pi-th-large" style="margin-right: 8px" />Plex Libraries</span>
        </template>
        <template #content>
          <p class="field-hint">Select which Plex libraries to scan. Leave all unchecked to scan every movie library.</p>
          <div class="library-load-row">
            <Button
              label="Load Libraries"
              icon="pi pi-sync"
              severity="secondary"
              outlined
              size="small"
              :loading="librariesLoading"
              @click="loadLibraries"
            />
            <span v-if="libraryError" class="library-error">{{ libraryError }}</span>
          </div>
          <div v-if="availableLibraries.length > 0" class="library-list">
            <div
              v-for="lib in availableLibraries"
              :key="lib.key"
              class="library-item"
            >
              <Checkbox
                :input-id="`lib-${lib.key}`"
                :value="lib.key"
                v-model="selectedLibraryIds"
              />
              <label :for="`lib-${lib.key}`" class="library-label">
                <span class="library-title">{{ lib.title }}</span>
                <span class="library-meta">{{ lib.type }} · {{ lib.count }} items</span>
              </label>
              <Select
                v-if="lib.type === 'movie'"
                v-model="qualityThresholds[lib.key]"
                :options="resolutionOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="threshold-select"
                placeholder="Min quality"
              />
            </div>
          </div>
          <p v-else-if="!librariesLoading" class="field-hint muted">
            Click "Load Libraries" to fetch available libraries from your Plex server.
          </p>
        </template>
      </Card>

      <Card class="settings-card">
        <template #title>
          <span><i class="pi pi-sliders-h" style="margin-right: 8px" />Duration Tolerance</span>
        </template>
        <template #content>
          <div class="field">
            <label for="leeway">Leeway (%)</label>
            <div class="leeway-row">
              <Slider
                v-model="leewayNum"
                :min="0"
                :max="20"
                :step="0.5"
                class="leeway-slider"
              />
              <InputNumber
                id="leeway"
                v-model="leewayNum"
                :min="0"
                :max="100"
                :max-fraction-digits="1"
                suffix="%"
                class="leeway-input"
              />
            </div>
            <small>
              Movies with a duration difference greater than {{ leewayNum }}% of the expected runtime will be flagged.
            </small>
          </div>
        </template>
      </Card>

      <div class="form-actions">
        <Button
          type="submit"
          label="Save Settings"
          icon="pi pi-check"
          :loading="store.loading"
        />
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useToast } from 'primevue/usetoast'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'

const store = useSettingsStore()
const toast = useToast()

const resolutionOptions = [
  { label: '480p', value: '480p' },
  { label: '720p', value: '720p' },
  { label: '1080p (default)', value: '1080p' },
  { label: '4K', value: '4k' },
]

const form = ref({
  plex_url: '',
  plex_token: '',
  radarr_url: '',
  radarr_api_key: '',
  sonarr_url: '',
  sonarr_api_key: '',
})

const leewayNum = ref(5)

// Library selection
const availableLibraries = ref([])
const selectedLibraryIds = ref([])  // array of string keys
const qualityThresholds = reactive({}) // sectionKey -> resolution string
const librariesLoading = ref(false)
const libraryError = ref('')

onMounted(async () => {
  await store.fetchSettings()
  form.value.plex_url = store.settings.plex_url || ''
  form.value.radarr_url = store.settings.radarr_url || ''
  form.value.sonarr_url = store.settings.sonarr_url || ''
  leewayNum.value = parseFloat(store.settings.leeway_percent) || 5

  // Restore saved library selection
  const savedIds = store.settings.plex_library_ids || ''
  selectedLibraryIds.value = savedIds ? savedIds.split(',').map((s) => s.trim()).filter(Boolean) : []

  // Restore saved quality thresholds
  try {
    const saved = JSON.parse(store.settings.quality_thresholds || '{}')
    Object.assign(qualityThresholds, saved)
  } catch { /* ignore */ }
})

async function loadLibraries() {
  librariesLoading.value = true
  libraryError.value = ''
  try {
    const res = await fetch('/api/plex/libraries')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to load libraries')
    availableLibraries.value = data
    // Default any new movie library to 1080p if not already set
    for (const lib of data) {
      if (lib.type === 'movie' && !qualityThresholds[lib.key]) {
        qualityThresholds[lib.key] = '1080p'
      }
    }
  } catch (err) {
    libraryError.value = err.message
  } finally {
    librariesLoading.value = false
  }
}

async function handleSave() {
  const payload = {
    plex_url: form.value.plex_url,
    radarr_url: form.value.radarr_url,
    sonarr_url: form.value.sonarr_url,
    leeway_percent: leewayNum.value,
    plex_library_ids: selectedLibraryIds.value.join(','),
    quality_thresholds: JSON.stringify(qualityThresholds),
  }
  if (form.value.plex_token) payload.plex_token = form.value.plex_token
  if (form.value.radarr_api_key) payload.radarr_api_key = form.value.radarr_api_key
  if (form.value.sonarr_api_key) payload.sonarr_api_key = form.value.sonarr_api_key

  try {
    await store.saveSettings(payload)
    form.value.plex_token = ''
    form.value.radarr_api_key = ''
    form.value.sonarr_api_key = ''
    toast.add({ severity: 'success', summary: 'Settings saved', life: 4000 })
  } catch {
    toast.add({ severity: 'error', summary: 'Save failed', detail: store.saveError, life: 6000 })
  }
}
</script>

<style scoped>
.settings-view {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
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

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.settings-card {
  width: 100%;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 1rem;
}

.field:last-child {
  margin-bottom: 0;
}

.field label {
  font-weight: 600;
  font-size: 0.9rem;
}

.field small {
  color: #b0b8c8;
  font-size: 0.85rem;
}

.field small a {
  color: var(--p-primary-400, #e5a00d);
}

.w-full {
  width: 100%;
}

.leeway-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.leeway-slider {
  flex: 1 1 auto;
  min-width: 0;
}

.leeway-input {
  width: 90px;
  flex: 0 0 90px;
}

.leeway-input :deep(.p-inputtext) {
  width: 100%;
}

@media (max-width: 640px) {
  .leeway-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .leeway-input {
    width: 100%;
    flex: 0 0 auto;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.field-hint {
  color: #b0b8c8;
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
}

.field-hint.muted {
  font-style: italic;
}

.library-load-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.library-error {
  color: #e57373;
  font-size: 0.85rem;
}

.library-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.library-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.threshold-select {
  margin-left: auto;
  width: 140px;
}

.library-label {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  gap: 2px;
}

.library-title {
  font-size: 0.9rem;
  font-weight: 600;
}

.library-meta {
  font-size: 0.78rem;
  color: #b0b8c8;
  text-transform: capitalize;
}
</style>
