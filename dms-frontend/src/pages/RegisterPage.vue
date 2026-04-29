<template>
  <q-page class="flex flex-center bg-grey-10">
    <div class="full-width row justify-center q-px-md">
      <q-card class="q-pa-lg shadow-8" style="width: 420px; max-width: 100%">
        <q-card-section class="text-center q-pb-none">
          <div class="text-h5 text-primary q-mb-xs">Account erstellen</div>
          <div class="text-caption text-grey-6">Lege deinen Zugang für das DMS an</div>
        </q-card-section>

        <q-card-section>
          <q-form @submit.prevent="onSubmit" class="q-gutter-md">
            <q-input
              v-model="displayName"
              label="Name"
              dense
              outlined
              :disable="loading"
              autocomplete="name"
            >
              <template #prepend>
                <q-icon name="person" />
              </template>
            </q-input>

            <q-input
              v-model="email"
              label="E-Mail"
              type="email"
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
              autocomplete="new-password"
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

            <q-input
              v-model="passwordConfirm"
              :type="showPassword ? 'text' : 'password'"
              label="Passwort wiederholen"
              dense
              outlined
              :disable="loading"
              :error="passwordsMismatch"
              error-message="Passwörter stimmen nicht überein"
            >
              <template #prepend>
                <q-icon name="lock" />
              </template>
            </q-input>

            <q-checkbox
              v-model="accept"
              dense
              :disable="loading"
              label="Ich bin mit der lokalen Speicherung meiner Dokumente einverstanden"
            />

            <q-btn
              label="Account anlegen"
              type="submit"
              color="primary"
              class="full-width q-mt-sm"
              :loading="loading"
            />

            <div class="row justify-center q-mt-sm">
              <q-btn
                flat
                dense
                color="primary"
                label="Ich habe schon einen Account"
                @click="goLogin"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'

const router = useRouter()
const $q = useQuasar()
const auth = useAuthStore()

const displayName = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const showPassword = ref(false)
const accept = ref(true)
const loading = ref(false)

const passwordsMismatch = computed(
  () =>
    password.value.length > 0 &&
    passwordConfirm.value.length > 0 &&
    password.value !== passwordConfirm.value,
)

const onSubmit = async () => {
  if (!displayName.value.trim() || !email.value.trim() || !password.value) {
    $q.notify({ type: 'warning', message: 'Name, E-Mail und Passwort ausfüllen' })
    return
  }

  if (password.value.length < 6) {
    $q.notify({ type: 'warning', message: 'Passwort sollte mindestens 6 Zeichen haben' })
    return
  }

  if (passwordsMismatch.value) {
    $q.notify({ type: 'warning', message: 'Passwörter stimmen nicht überein' })
    return
  }

  if (!accept.value) {
    $q.notify({ type: 'warning', message: 'Bitte die Speicherung bestätigen' })
    return
  }

  loading.value = true
  try {
    await auth.register(email.value.trim(), password.value, displayName.value.trim())
    router.push('/')
  } catch (err) {
    console.error(err)
    const msg = err?.response?.data?.error || 'Registrierung fehlgeschlagen'
    $q.notify({ type: 'negative', message: msg })
  } finally {
    loading.value = false
  }
}

const goLogin = () => {
  router.push('/login')
}
</script>
