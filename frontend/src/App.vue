<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { CindorProvider, CindorToastRegion } from 'cindor-ui-vue'
import NavBar from './components/NavBar.vue'

const route = useRoute()

const currentTitle = computed(() => route.meta.title || 'Plex Issue Finder')
</script>

<template>
  <CindorProvider theme="dark">
    <div class="app-shell">
      <NavBar />
      <CindorToastRegion placement="top-end" />
      <div class="app-frame">
        <header class="app-topbar">
          <h1 class="app-topbar-title">{{ currentTitle }}</h1>
        </header>
        <main class="app-main">
          <router-view />
        </main>
      </div>
    </div>
  </CindorProvider>
</template>
