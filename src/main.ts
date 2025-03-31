import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate' // Import the plugin
// Import xterm CSS
import 'xterm/css/xterm.css'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

// Use the persistence plugin
pinia.use(piniaPluginPersistedstate)

app.use(pinia) // Use pinia AFTER the plugin is added
app.mount('#app')