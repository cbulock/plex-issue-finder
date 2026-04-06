<template>
  <div class="navbar">
    <div class="navbar-brand">
      <router-link to="/" class="brand-link">
        <i class="pi pi-server" style="margin-right: 8px" />
        Plex Issue Finder
      </router-link>
    </div>
    <nav class="navbar-nav">
      <router-link to="/" class="nav-link" active-class="nav-link-active" exact>
        <i class="pi pi-home" /> Dashboard
      </router-link>
      <router-link to="/settings" class="nav-link" active-class="nav-link-active">
        <i class="pi pi-cog" /> Settings
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  height: 56px;
  background: var(--p-surface-900, #1a1a2e);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.brand-link {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--p-primary-400, #e5a00d);
  text-decoration: none;
  display: flex;
  align-items: center;
}

.navbar-nav {
  display: flex;
  gap: 1rem;
}

.nav-link {
  color: #ccc;
  text-decoration: none;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.92rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.nav-link-active {
  background: rgba(229, 160, 13, 0.15);
  color: var(--p-primary-400, #e5a00d);
}
</style>
