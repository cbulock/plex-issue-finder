<template>
  <div class="settings-view app-page">
    <div class="page-header">
      <p>Configure your Plex, Radarr, and Sonarr connection details.</p>
    </div>

    <CindorForm class="settings-form" :submitting="store.loading" @submit="handleSave">
      <CindorCard class="settings-card">
        <section class="settings-card-section">
          <h2 class="settings-card-title"><AppIcon name="circle-play" :size="18" />Plex Media Server</h2>
          <CindorFormField
            class="field"
            label="Server URL"
          >
            <CindorUrlInput
              id="plex_url"
              v-model="form.plex_url"
              placeholder="http://192.168.1.x:32400"
              class="w-full"
            />
            <CindorHelperText>Include protocol and port, e.g. http://192.168.1.50:32400</CindorHelperText>
          </CindorFormField>
          <CindorFormField
            class="field"
            label="API Token"
          >
            <CindorPasswordInput
              id="plex_token"
              v-model="form.plex_token"
              :placeholder="store.settings.plex_token_set ? '(saved - enter to change)' : 'Your Plex token'"
              class="w-full"
            />
            <CindorHelperText>
              Find your token at
              <AppExternalLink
                href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
              >
                support.plex.tv
              </AppExternalLink>
            </CindorHelperText>
          </CindorFormField>
        </section>
      </CindorCard>

      <CindorCard class="settings-card">
        <section class="settings-card-section">
          <h2 class="settings-card-title"><AppIcon name="database" :size="18" />Radarr</h2>
          <CindorFormField
            class="field"
            label="Server URL"
          >
            <CindorUrlInput
              id="radarr_url"
              v-model="form.radarr_url"
              placeholder="http://192.168.1.x:7878"
              class="w-full"
            />
          </CindorFormField>
          <CindorFormField
            class="field"
            label="API Key"
          >
            <CindorPasswordInput
              id="radarr_api_key"
              v-model="form.radarr_api_key"
              :placeholder="store.settings.radarr_api_key_set ? '(saved - enter to change)' : 'Your Radarr API key'"
              class="w-full"
            />
            <CindorHelperText>Found in Radarr -> Settings -> General -> Security</CindorHelperText>
          </CindorFormField>
        </section>
      </CindorCard>

      <CindorCard class="settings-card">
        <section class="settings-card-section">
          <h2 class="settings-card-title"><AppIcon name="list" :size="18" />Sonarr</h2>
          <CindorFormField
            class="field"
            label="Server URL"
          >
            <CindorUrlInput
              id="sonarr_url"
              v-model="form.sonarr_url"
              placeholder="http://192.168.1.x:8989"
              class="w-full"
            />
          </CindorFormField>
          <CindorFormField
            class="field"
            label="API Key"
          >
            <CindorPasswordInput
              id="sonarr_api_key"
              v-model="form.sonarr_api_key"
              :placeholder="store.settings.sonarr_api_key_set ? '(saved - enter to change)' : 'Your Sonarr API key'"
              class="w-full"
            />
            <CindorHelperText>Found in Sonarr -> Settings -> General -> Security</CindorHelperText>
          </CindorFormField>
        </section>
      </CindorCard>

      <CindorCard class="settings-card">
        <section class="settings-card-section">
          <h2 class="settings-card-title"><AppIcon name="layout-grid" :size="18" />Plex Libraries</h2>
          <p class="field-hint">Select which Plex libraries to scan. Leave all unchecked to scan every movie library.</p>
          <div class="library-load-row">
            <CindorButton
              type="button"
              variant="ghost"
              :disabled="librariesLoading"
              @click="loadLibraries"
            >
              <span class="button-content">
                <AppIcon :name="librariesLoading ? 'loader-pinwheel' : 'refresh-cw'" :size="16" />
                <span>{{ librariesLoading ? 'Loading libraries…' : 'Load Libraries' }}</span>
              </span>
            </CindorButton>
          </div>
          <CindorAlert v-if="libraryError" tone="danger" class="library-alert">
            {{ libraryError }}
          </CindorAlert>
          <div v-if="availableLibraries.length > 0" class="library-list">
            <div
              v-for="lib in availableLibraries"
              :key="lib.key"
              class="library-item"
            >
              <CindorCheckbox
                :id="`lib-${lib.key}`"
                :model-value="selectedLibraryIds.includes(lib.key)"
                @update:model-value="setLibrarySelected(lib.key, $event)"
              />
              <div class="library-label">
                <span class="library-title">{{ lib.title }}</span>
                <span class="library-meta">{{ lib.type }} · {{ lib.count }} items</span>
              </div>
              <CindorSelect
                v-if="lib.type === 'movie'"
                v-model="qualityThresholds[lib.key]"
                class="threshold-select"
              >
                <CindorOption
                  v-for="option in resolutionOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </CindorSelect>
            </div>
          </div>
          <p v-else-if="!librariesLoading" class="field-hint muted">
            Click "Load Libraries" to fetch available libraries from your Plex server.
          </p>
        </section>
      </CindorCard>

      <CindorCard class="settings-card">
        <section class="settings-card-section">
          <h2 class="settings-card-title"><AppIcon name="sliders-horizontal" :size="18" />Duration Tolerance</h2>
          <CindorFormField
            class="field"
            label="Leeway (%)"
          >
            <div class="leeway-row">
              <CindorRange
                v-model="leewayNum"
                :min="0"
                :max="20"
                :step="0.5"
                class="leeway-slider"
              />
              <CindorNumberInput
                id="leeway"
                v-model="leewayInput"
                min="0"
                max="100"
                step="0.5"
                class="leeway-input"
              />
            </div>
            <CindorHelperText>
              Duration checks flag items only when the difference exceeds the percentage threshold and the minimum minute difference.
            </CindorHelperText>
          </CindorFormField>
          <div class="min-diff-grid">
            <CindorFormField
              class="field"
              label="Movie minimum difference (minutes)"
            >
              <CindorNumberInput
                id="movie-min-diff"
                v-model="movieMinDiffInput"
                min="0"
                step="0.5"
                class="w-full"
              />
              <CindorHelperText>
                Default: 5 min. Movie checks use the larger of {{ leewayNum }}% or {{ movieMinDiffNum }} minutes.
              </CindorHelperText>
            </CindorFormField>
            <CindorFormField
              class="field"
              label="Episode minimum difference (minutes)"
            >
              <CindorNumberInput
                id="episode-min-diff"
                v-model="episodeMinDiffInput"
                min="0"
                step="0.5"
                class="w-full"
              />
              <CindorHelperText>
                Default: 3 min. Episode checks use the larger of {{ leewayNum }}% or {{ episodeMinDiffNum }} minutes.
              </CindorHelperText>
            </CindorFormField>
          </div>
        </section>
      </CindorCard>

      <div class="form-actions">
        <CindorButton type="submit" :disabled="store.loading">
          <span class="button-content">
            <AppIcon :name="store.loading ? 'loader-pinwheel' : 'check'" :size="16" />
            <span>{{ store.loading ? 'Saving…' : 'Save Settings' }}</span>
          </span>
        </CindorButton>
      </div>
    </CindorForm>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  CindorAlert,
  CindorButton,
  CindorCard,
  CindorCheckbox,
  CindorForm,
  CindorFormField,
  CindorHelperText,
  CindorNumberInput,
  CindorOption,
  CindorPasswordInput,
  CindorRange,
  CindorSelect,
  CindorUrlInput,
} from 'cindor-ui-vue'
import { apiPost } from '../api/client'
import AppExternalLink from '../components/AppExternalLink.vue'
import AppIcon from '../components/AppIcon.vue'
import { useAppToast } from '../composables/useAppToast'
import { useSettingsStore } from '../stores/settings'

const store = useSettingsStore()
const toast = useAppToast()

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
const movieMinDiffNum = ref(5)
const episodeMinDiffNum = ref(3)

const leewayInput = computed({
  get: () => String(leewayNum.value ?? ''),
  set: (value) => {
    const parsed = Number.parseFloat(value)
    leewayNum.value = Number.isFinite(parsed) ? parsed : 0
  },
})

const movieMinDiffInput = computed({
  get: () => String(movieMinDiffNum.value ?? ''),
  set: (value) => {
    const parsed = Number.parseFloat(value)
    movieMinDiffNum.value = Number.isFinite(parsed) ? parsed : 0
  },
})

const episodeMinDiffInput = computed({
  get: () => String(episodeMinDiffNum.value ?? ''),
  set: (value) => {
    const parsed = Number.parseFloat(value)
    episodeMinDiffNum.value = Number.isFinite(parsed) ? parsed : 0
  },
})

const availableLibraries = ref([])
const selectedLibraryIds = ref([])
const qualityThresholds = reactive({})
const librariesLoading = ref(false)
const libraryError = ref('')

onMounted(async () => {
  await store.fetchSettings()
  form.value.plex_url = store.settings.plex_url || ''
  form.value.radarr_url = store.settings.radarr_url || ''
  form.value.sonarr_url = store.settings.sonarr_url || ''
  leewayNum.value = parseFloat(store.settings.leeway_percent) || 5
  movieMinDiffNum.value = parseFloat(store.settings.movie_min_diff_min) || 5
  episodeMinDiffNum.value = parseFloat(store.settings.episode_min_diff_min) || 3

  const savedIds = store.settings.plex_library_ids || ''
  selectedLibraryIds.value = savedIds ? savedIds.split(',').map((s) => s.trim()).filter(Boolean) : []

  try {
    const saved = JSON.parse(store.settings.quality_thresholds || '{}')
    Object.assign(qualityThresholds, saved)
  } catch {
    // Ignore invalid persisted thresholds and keep defaults.
  }
})

async function loadLibraries() {
  librariesLoading.value = true
  libraryError.value = ''
  try {
    const body = {}
    if (form.value.plex_url) body.plex_url = form.value.plex_url
    if (form.value.plex_token) body.plex_token = form.value.plex_token
    const data = await apiPost('/api/plex/libraries', body)
    availableLibraries.value = data
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

function setLibrarySelected(key, checked) {
  if (checked) {
    if (!selectedLibraryIds.value.includes(key)) {
      selectedLibraryIds.value = [...selectedLibraryIds.value, key]
    }
    return
  }

  selectedLibraryIds.value = selectedLibraryIds.value.filter((id) => id !== key)
}

async function handleSave(event) {
  event?.preventDefault?.()

  const payload = {
    plex_url: form.value.plex_url,
    radarr_url: form.value.radarr_url,
    sonarr_url: form.value.sonarr_url,
    leeway_percent: leewayNum.value,
    movie_min_diff_min: movieMinDiffNum.value,
    episode_min_diff_min: episodeMinDiffNum.value,
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
    toast.add({ severity: 'error', summary: 'Save failed', detail: store.saveError || 'Unable to save settings.', life: 6000 })
  }
}
</script>

<style scoped>
.settings-view {
  max-width: 720px;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.settings-card {
  width: 100%;
}

.settings-card-section {
  padding: var(--space-4);
}

.settings-card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-4);
  font-size: var(--text-md);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.field:last-child {
  margin-bottom: 0;
}

.w-full {
  width: 100%;
}

.leeway-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
}

.leeway-slider {
  flex: 1 1 auto;
  min-width: 0;
}

.leeway-input {
  width: 96px;
  flex: 0 0 96px;
}

.min-diff-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
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

  .min-diff-grid {
    grid-template-columns: 1fr;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.field-hint {
  color: var(--fg-muted);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-3);
}

.field-hint.muted {
  font-style: italic;
}

.library-load-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.library-alert {
  margin-bottom: var(--space-3);
}

.library-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.library-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-subtle);
  flex-wrap: wrap;
}

.threshold-select {
  margin-left: auto;
  width: 140px;
}

.library-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.library-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.library-meta {
  font-size: var(--text-xs);
  color: var(--fg-subtle);
  font-family: var(--font-mono);
  text-transform: capitalize;
  letter-spacing: 0.04em;
}
</style>
