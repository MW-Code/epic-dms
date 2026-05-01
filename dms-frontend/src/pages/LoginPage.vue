<template>
  <q-page class="epic-auth-page flex flex-center" translate="no">
    <div class="full-width row justify-center q-px-md">
      <div class="column items-center" style="width: 420px; max-width: 100%">
        <!-- Branding-Block -->
        <img :src="logoUrl" alt="Epic DMS" class="epic-auth-logo q-mb-md" />
        <div class="text-center text-grey-5 q-mb-xl">
          Dein selbst gehosteter Dokumenten-Safe.<br />
          Privat, durchsuchbar, immer erreichbar.
        </div>

        <q-card class="epic-card full-width q-pa-md">
          <q-card-section class="q-pb-none">
            <div class="text-h6 q-mb-xs">Willkommen zurück</div>
            <div class="text-caption text-grey-6">Melde dich mit deinem Account an</div>
          </q-card-section>

          <q-card-section>
            <q-form @submit.prevent="onSubmit" class="q-gutter-md">
              <q-input
                v-model="email"
                label="E-Mail"
                type="email"
                autofocus
                outlined
                dense
                dark
                :disable="loading"
                autocomplete="email"
              >
                <template #prepend>
                  <q-icon name="mail" />
                </template>
              </q-input>

              <q-input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                label="Passwort"
                outlined
                dense
                dark
                :disable="loading"
                autocomplete="current-password"
              >
                <template #prepend>
                  <q-icon name="lock" />
                </template>
                <template #append>
                  <q-icon
                    :name="showPassword ? 'visibility_off' : 'visibility'"
                    class="cursor-pointer"
                    @click="showPassword = !showPassword"
                  />
                </template>
              </q-input>

              <div class="row items-center justify-between">
                <q-checkbox v-model="remember" label="Angemeldet bleiben" dense :disable="loading" />
                <q-btn flat dense no-caps label="Account erstellen" color="primary" @click="goRegister" />
              </div>

              <q-btn
                label="Login"
                type="submit"
                color="primary"
                unelevated
                rounded
                no-caps
                size="md"
                class="full-width q-mt-sm"
                :loading="loading"
              />
            </q-form>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import logoUrl from 'src/assets/logo-epic-dms.png'

const router = useRouter()
const $q = useQuasar()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const remember = ref(true)
const loading = ref(false)

const onSubmit = async () => {
  if (!email.value.trim() || !password.value) {
    $q.notify({ type: 'warning', message: 'E-Mail und Passwort eingeben' })
    return
  }

  loading.value = true
  try {
    await auth.login(email.value.trim(), password.value)
    router.push('/')
  } catch (err) {
    console.error(err)
    const msg = err?.response?.data?.error || 'Login fehlgeschlagen'
    $q.notify({ type: 'negative', message: msg })
  } finally {
    loading.value = false
  }
}

const goRegister = () => {
  router.push('/register')
}
</script>

<style scoped>
.epic-auth-page {
  background: var(--epic-bg);
  min-height: 100vh;
}
.epic-auth-logo {
  width: 320px;
  max-width: 80%;
  height: auto;
}
</style>
