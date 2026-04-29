<template>
  <q-page class="flex flex-center bg-grey-10">
    <div class="full-width row justify-center q-px-md">
      <q-card class="q-pa-lg shadow-8" style="width: 420px; max-width: 100%">
        <q-card-section class="text-center q-pb-none">
          <div class="text-h5 text-primary q-mb-xs">DMS Login</div>
          <div class="text-caption text-grey-6">Melde dich bei deinem Dokumenten-Safe an</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit.prevent="onSubmit" class="q-gutter-md">
            <q-input
              v-model="email"
              label="E-Mail"
              type="email"
              autofocus
              dense
              outlined
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
              dense
              outlined
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

            <div class="row items-center justify-between q-mt-xs">
              <q-checkbox v-model="remember" label="Angemeldet bleiben" dense :disable="loading" />
              <q-btn flat dense label="Account erstellen" color="primary" @click="goRegister" />
            </div>

            <q-btn
              label="Login"
              type="submit"
              color="primary"
              class="full-width q-mt-sm"
              :loading="loading"
            />
          </q-form>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'

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
    // optional: remember kannst du später für Cookie/Refresh-Logic nutzen
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
