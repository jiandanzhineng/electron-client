import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import './styles/main.css'
import { useAiStore } from './stores/aiStore'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus)
app.mount('#app')

// 将aiStore注册到全局window对象，以便后端服务可以访问
const aiStore = useAiStore()
window.aiStore = aiStore

// 初始化aiStore
aiStore.init()