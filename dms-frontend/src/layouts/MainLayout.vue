<template>
  <q-layout view="lHh Lpr lFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title> Epic DMS </q-toolbar-title>
        <q-space />
        <q-input
          v-if="authStore.isAuthenticated"
          dark
          dense
          rounded=""
          standout
          v-model="search"
          input-class="text-right"
          class="q-ml-md fit"
          style="max-width: 49vw"
        >
          <template v-slot:append>
            <q-icon v-if="search === ''" name="search" />
            <q-icon v-else name="clear" class="cursor-pointer" @click="search = ''" />
          </template>
        </q-input>
        <q-btn
          v-if="authStore.isAuthenticated"
          flat
          dark
          rounded
          class="q-mx-sm text-white bg-accent"
          icon="mdi-note-plus-outline"
          aria-label="Menu"
          @click="uiStore.openUploadDialog()"
          label="Dokument hochladen"
        />
        <q-btn
          v-if="authStore.isAuthenticated"
          flat
          dark
          rounded
          class="q-mx-sm text-primary bg-white"
          icon="logout"
          aria-label="Menu"
          @click="authStore.logout()"
          label="Abmelden"
        />
        <q-btn flat round class="q-mx-sm" icon="settings" />
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
</script>
