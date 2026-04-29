import { defineBoot } from '#q-app/wrappers'
import axios from 'axios'
import { useAuthStore } from 'src/stores/auth'

// baseURL stammt aus Env. Dev faellt auf das lokale Backend zurueck,
// Production-Build kann hinter nginx auf "/api" zeigen.
const api = axios.create({
  baseURL: process.env.API_URL || 'http://localhost:3000/api',
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
