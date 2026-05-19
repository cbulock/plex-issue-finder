import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'cindor-ui-core/styles.css'
import './style.css'
import App from './App.vue'
import router from './router'

document.documentElement.setAttribute('data-theme', 'dark')

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
