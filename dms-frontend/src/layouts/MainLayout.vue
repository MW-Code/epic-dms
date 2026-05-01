<template>
  <q-layout view="lHh Lpr lFf" class="bg-dark-page">
    <q-header class="epic-header" elevated>
      <q-toolbar class="q-px-md">
        <!-- Wortmarke (Logo) -->
        <router-link to="/" class="epic-brand row items-center no-wrap">
          <img
            :src="logoUrl"
            alt="Epic DMS"
            class="epic-logo"
          />
        </router-link>

        <q-space />

        <!-- Suchfeld zentral -->
        <q-input
          v-if="authStore.isAuthenticated"
          v-model="search"
          dark
          dense
          borderless
          placeholder="Dokumente durchsuchen…"
          class="epic-search q-mx-md"
          style="max-width: 460px; flex: 1"
        >
          <template #prepend>
            <q-icon name="search" class="text-grey-5" />
          </template>
          <template #append>
            <q-icon
              v-if="search"
              name="clear"
              class="cursor-pointer text-grey-5"
              @click="search = ''"
            />
          </template>
        </q-input>

        <q-space />

        <!-- Upload-Button: dezenter outlined-Stil -->
        <q-btn
          v-if="authStore.isAuthenticated"
          outline
          rounded
          color="primary"
          icon="mdi-upload"
          label="Dokument hochladen"
          class="q-mr-sm epic-upload-btn"
          no-caps
          @click="uiStore.openUploadDialog()"
        />

        <!-- User-Menu: runder Button mit Initialen oder Personen-Icon -->
        <q-btn
          v-if="authStore.isAuthenticated"
          round
          unelevated
          size="md"
          class="q-ml-sm epic-avatar-btn"
          :label="userInitials || undefined"
          :icon="userInitials ? undefined : 'mdi-account'"
        >
          <q-menu anchor="bottom right" self="top right" class="epic-menu">
            <q-list style="min-width: 220px">
              <q-item>
                <q-item-section>
                  <q-item-label class="text-weight-medium">{{ userDisplayName }}</q-item-label>
                  <q-item-label caption>{{ userEmail }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup @click="authStore.logout()">
                <q-item-section avatar>
                  <q-icon name="logout" color="negative" />
                </q-item-section>
                <q-item-section class="text-negative">Abmelden</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { computed } from 'vue'

import { useUiStore } from 'src/stores/ui'
import { useAuthStore } from 'src/stores/auth'
import logoUrl from 'src/assets/logo-epic-dms.png'

const uiStore = useUiStore()
const authStore = useAuthStore()

const search = computed({
  get: () => uiStore.searchQuery,
  set: (val) => uiStore.setSearchQuery(val),
})

const userDisplayName = computed(() => {
  const u = authStore.user
  return u?.displayName || u?.email || 'Benutzer'
})
const userEmail = computed(() => authStore.user?.email || '')

// Erste Buchstaben aus displayName, sonst aus dem Local-Part der E-Mail.
// Liefert leeren String wenn nichts da, dann zeigt das Template ein Icon.
const userInitials = computed(() => {
  const u = authStore.user
  if (!u) return ''

  if (u.displayName?.trim()) {
    return u.displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('')
  }
  if (u.email) {
    return u.email.charAt(0).toUpperCase()
  }
  return ''
})
</script>

<style scoped>
.epic-header {
  background: rgba(15, 15, 20, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--epic-border);
}

.epic-brand {
  user-select: none;
  text-decoration: none;
  cursor: pointer;
}
.epic-logo {
  height: 32px;
  display: block;
}

.epic-search :deep(.q-field__control) {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--epic-border);
  border-radius: 999px;
  padding: 0 16px;
  height: 40px;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.epic-search :deep(.q-field__control:hover) {
  background: rgba(255, 255, 255, 0.08);
}
.epic-search :deep(.q-field--focused .q-field__control) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(124, 58, 237, 0.5);
}
.epic-search :deep(.q-field__native) {
  color: var(--epic-text-primary);
  padding-left: 8px;
}
.epic-search :deep(.q-field__native::placeholder) {
  color: var(--epic-text-muted);
}

.epic-upload-btn {
  font-weight: 500;
}

/* Avatar-Button: runder Lila-Button mit Initialen oder Icon.
   q-btn macht die Zentrierung intern selbst, daher minimal-CSS noetig. */
.epic-avatar-btn {
  width: 36px;
  height: 36px;
  min-height: 36px;
  background: var(--q-primary);
  color: white;
  font-weight: 600;
  font-size: 13px;
  border: 2px solid rgba(255, 255, 255, 0.12);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.epic-avatar-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}
</style>
