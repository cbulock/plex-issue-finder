import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import 'emberline-design-system/emberline.css'
import 'primeicons/primeicons.css'
import './style.css'
import App from './App.vue'
import router from './router'

document.documentElement.setAttribute('data-theme', 'dark')

const EmberlinePrimeTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },
    colorScheme: {
      dark: {
        surface: {
          0: '#ffffff',
          50: '#f8f5ef',
          100: '#e9e6de',
          200: '#dcd8cc',
          300: '#b8b3a2',
          400: '#878273',
          500: '#5e5a4e',
          600: '#42403a',
          700: '#2c2a26',
          800: '#1d1c19',
          900: '#161512',
          950: '#0f0e0c',
        },
      },
    },
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: EmberlinePrimeTheme,
    options: {
      darkModeSelector: '[data-theme="dark"]',
    },
  },
})
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.mount('#app')
