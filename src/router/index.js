import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../views/Home.vue'
import ServerStatus from '../views/ServerStatus.vue'
import LocalServer from '../views/LocalServer.vue'
import DeviceManagement from '../views/DeviceManagement.vue'
import GameList from '../views/GameList.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/server-status',
    name: 'ServerStatus',
    component: ServerStatus
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
    path: '/game-list',
    name: 'GameList',
    component: GameList
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router