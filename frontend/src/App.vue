<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'
import Toast from 'primevue/toast'

const route = useRoute()

const currentTitle = computed(() => route.meta.title || 'Plex Issue Finder')
</script>

<template>
  <div class="app-shell">
    <NavBar />
    <Toast position="top-right" />
    <div class="app-frame">
      <header class="app-topbar">
        <h1 class="app-topbar-title">{{ currentTitle }}</h1>
      </header>
      <main class="app-main">
        <router-view />
      </main>
    </div>
  </div>
</template>
