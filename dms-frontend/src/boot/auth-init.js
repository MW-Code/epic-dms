import { defineBoot } from '#q-app/wrappers'
import { useAuthStore } from 'src/stores/auth'

export default defineBoot(() => {
  const auth = useAuthStore()
  auth.loadFromStorage()
})
