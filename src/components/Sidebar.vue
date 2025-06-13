<template>
  <div class="sidebar">
    <h2>导航</h2>
    <ul>
      <li>
        <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
          首页
        </router-link>
      </li>
      <li>
        <router-link to="/server-status" class="nav-link" :class="{ active: $route.path === '/server-status' }">
          服务端状态
        </router-link>
      </li>
      <li>
        <router-link to="/local-server" class="nav-link" :class="{ active: $route.path === '/local-server' }">
          本地启动服务端
        </router-link>
      </li>
      <li>
        <router-link to="/device-management" class="nav-link" :class="{ active: $route.path === '/device-management' }">
          设备管理
        </router-link>
      </li>
      <li>
        <router-link to="/games" class="nav-link" :class="{ active: $route.path === '/games' }">
          玩法列表
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script setup>
// 无需额外逻辑，Vue Router会自动处理导航
</script>

<style scoped>
.sidebar {
  width: 250px;
  background-color: #2c3e50;
  color: white;
  padding: 20px;
  box-sizing: border-box;
}

.sidebar h2 {
  margin-bottom: 20px;
  color: #ecf0f1;
}

.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar li {
  margin-bottom: 10px;
}

.nav-link {
  display: block;
  padding: 10px 15px;
  color: #bdc3c7;
  text-decoration: none;
  border-radius: 5px;
  transition: all 0.3s ease;
}

.nav-link:hover {
  background-color: #34495e;
  color: #ecf0f1;
}

.nav-link.active {
  background-color: #3498db;
  color: white;
}
</style>