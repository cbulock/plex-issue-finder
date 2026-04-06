<script setup>
import NavBar from './components/NavBar.vue'
import Toast from 'primevue/toast'
</script>

<template>
  <div class="app-layout">
    <NavBar />
    <Toast position="top-right" />
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

