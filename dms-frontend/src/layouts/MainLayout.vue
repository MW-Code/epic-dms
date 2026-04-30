<template>
  <q-layout view="lHh Lpr lFf" class="bg-dark-page">
    <q-header class="epic-header" elevated>
      <q-toolbar class="q-px-md">
        <!-- Wortmarke mit Icon -->
        <div class="row items-center no-wrap epic-brand">
          <q-icon name="mdi-shield-lock-outline" size="24px" class="text-primary q-mr-sm" />
          <div class="epic-wordmark text-h6">Epic DMS</div>
        </div>

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

        <!-- User-Menu: Avatar mit Dropdown statt direktem Logout -->
        <q-btn
          v-if="authStore.isAuthenticated"
          flat
          round
          class="q-ml-sm"
        >
          <q-avatar size="32px" color="primary" text-color="white" class="epic-avatar">
            <span v-if="userInitials">{{ userInitials }}</span>
            <q-icon v-else name="mdi-account" size="20px" />
          </q-avatar>
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

.epic-avatar {
  font-weight: 600;
  font-size: 12px;
  border: 2px solid rgba(255, 255, 255, 0.12);
  transition: border-color 0.15s ease;
}
.epic-avatar:hover {
  border-color: var(--q-primary);
}
</style>
