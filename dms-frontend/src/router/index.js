import { defineRouter } from '#q-app/wrappers'
import {
  createRouter,
  createMemoryHistory,
  createWebHistory,
  createWebHashHistory,
} from 'vue-router'
import routes from './routes'
import { useAuthStore } from 'src/stores/auth'

export default defineRouter(function ({ store }) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE),
  })

  Router.beforeEach((to, from, next) => {
    const auth = useAuthStore(store)

    if (!auth.token) {
      auth.loadFromStorage()
    }

    const requiresAuth = to.matched.some((r) => r.meta && r.meta.requiresAuth)
    const isLoggedIn = auth.isAuthenticated

    if (requiresAuth && !isLoggedIn) {
      return next({ name: 'login' })
    }

    if ((to.name === 'login' || to.name === 'register') && isLoggedIn) {
      return next({ name: 'documents' })
    }

    next()
  })

  return Router
})
