import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import ServerStatus from '../views/ServerStatus.vue'
import LocalServer from '../views/LocalServer.vue'
import DeviceManagement from '../views/DeviceManagement.vue'
import GameList from '../views/GameList.vue'
import GameplayConfig from '../views/GameplayConfig.vue'
import GameplayRunning from '../views/GameplayRunning.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/server-status',
    name: 'ServerStatus',
    component: () => import('../views/ServerStatus.vue')
  },
  {
    path: '/logs',
    name: 'LogViewer',
    component: () => import('../views/LogViewer.vue')
  },
  {
    path: '/local-server',
    name: 'LocalServer',
    component: LocalServer
  },
  {
    path: '/device-management',
    name: 'DeviceManagement',
    component: DeviceManagement
  },
  {
    path: '/games',
    name: 'GameList',
    component: GameList
  },
  {
     path: '/gameplay-config',
     name: 'GameplayConfig',
     component: GameplayConfig
   },
   {
     path: '/gameplay-running',
     name: 'GameplayRunning',
     component: GameplayRunning
   }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router