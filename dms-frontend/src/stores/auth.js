import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'

// REVIEW(claude): Token in localStorage = anfällig gegen XSS. Für ein Portfolio-Projekt
// vertretbar, sollte aber im README als bekannte Limitation stehen. Sauberer:
// httpOnly+SameSite=Strict-Cookie vom Backend, dann braucht das Frontend den Token gar nicht.
// Außerdem: 7-Tage-JWT ohne Refresh -> Logout-Mechanismus serverseitig nicht möglich.
export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('dms_token') || '',
  }),

  getters: {
    isAuthenticated(state) {
      return !!state.token
    },
  },

  actions: {
    loadFromStorage() {
      const token = localStorage.getItem('dms_token')
      const userRaw = localStorage.getItem('dms_user')

      if (token) {
        this.token = token
      } else {
        this.token = ''
      }

      if (userRaw) {
        try {
          this.user = JSON.parse(userRaw)
        } catch (e) {
          console.warn('Konnte dms_user nicht parsen, resette:', e)
          this.user = null
          localStorage.removeItem('dms_user')
        }
      } else {
        this.user = null
      }
    },

    setToken(token) {
      this.token = token || ''
      if (token) {
        localStorage.setItem('dms_token', token)
      } else {
        localStorage.removeItem('dms_token')
      }
    },

    setUser(user) {
      this.user = user
      if (user) {
        localStorage.setItem('dms_user', JSON.stringify(user))
      } else {
        localStorage.removeItem('dms_user')
      }
    },

    async register(email, password, displayName) {
      const res = await api.post('/auth/register', {
        email,
        password,
        displayName,
      })

      this.setToken(res.data.token)
      this.setUser(res.data.user)
    },

    async login(email, password) {
      const res = await api.post('/auth/login', { email, password })

      this.setToken(res.data.token)
      this.setUser(res.data.user)
    },

    logout() {
      this.setToken('')
      this.setUser(null)
      this.router.push({ name: 'login' })
    },
  },
})
