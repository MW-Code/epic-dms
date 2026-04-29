import { defineBoot } from '#q-app/wrappers'
import axios from 'axios'
import { useAuthStore } from 'src/stores/auth'

// REVIEW(claude): baseURL hartcodiert. Für Build/Deploy muss das aus dem Env kommen,
// sonst zeigt der Production-Build immer auf localhost. Quasar/Vite:
//   const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })
// und in quasar.config.js -> build.env: { VITE_API_URL: process.env.VITE_API_URL }
// In Production hinter nginx-Proxy reicht "/api".
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
})

export default defineBoot(({ router }) => {
  const auth = useAuthStore()

  // Jeden Request um den JWT erweitern, falls vorhanden
  api.interceptors.request.use((config) => {
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`
    }
    return config
  })

  // Bei 401 automatisch abmelden und zurück zum Login leiten
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status

      if (status === 401) {
        auth.logout()

        // Nur umleiten, wenn wir nicht sowieso schon auf login stehen
        if (router.currentRoute.value.name !== 'login') {
          router.push({ name: 'login' })
        }
      }

      return Promise.reject(error)
    },
  )
})

export { api }
