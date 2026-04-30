<template>
  <!-- Vollhöhe damit der Scrollbereich im Kartenkörper Platz bekommt -->
  <div class="sidebar-root column q-gutter-sm">
    <!-- Dokumentliste nimmt die verfügbare Resthöhe ein -->
    <q-card class="sidebar-card column col">
      <!-- Header mit Refresh -->
      <q-card-section class="q-pb-none">
        <div class="row items-center justify-between">
          <div :hidden="true" class="text-subtitle1">{{ currentFolderLabel }}</div>
          <div class="row" style="width: 100%;">
            <q-select
              v-model="selectedFolderModel"
              borderless
              :options="folders"
              clearable
              emit-value
              map-options
              class="text-subtitle1 col q-py-ms"
            >
              <template #append>
                <q-btn
                  dense
                  round
                  flat
                  icon="refresh"
                  :loading="loadingList"
                  @click.stop="emit('refresh')"
                />
              </template>
            </q-select>
          </div>
        </div>
      </q-card-section>

      <!-- Liste im Scrollbereich, Header bleibt oben stehen -->
      <q-card-section class="col column q-pt-sm" style="padding-bottom: 0">
        <q-scroll-area class="col">
          <q-list padding>
            <template v-if="documents.length">
              <q-item
                v-for="doc in documents"
                :key="doc._id"
                clickable
                :active="doc._id === selectedId"
                active-class="doc-item-active"
                class="doc-item q-my-xs"
                @click="emit('select-document', doc)"
              >
                <q-item-section>
                  <q-item-label class="text-body2 ellipsis">
                    {{ doc.title }}
                  </q-item-label>
                  <q-item-label
                    caption
                    class="ellipsis"
                    :class="{ 'text-white': doc._id === selectedId }"
                  >
                    {{ formatDateTime(doc.uploadedAt) }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div v-if="doc.ocr?.status" class="ocr-icon-wrap">
                    <q-spinner
                      v-if="doc.ocr.status === 'processing'"
                      color="info"
                      size="20px"
                    />
                    <q-icon
                      v-else
                      :name="ocrStatusIcon(doc.ocr.status)"
                      :color="ocrStatusColor(doc.ocr.status)"
                      size="20px"
                    />
                    <q-tooltip anchor="center left" self="center right" :delay="300">
                      {{ ocrStatusLabel(doc.ocr.status) }}
                    </q-tooltip>
                  </div>
                </q-item-section>
              </q-item>
            </template>

            <template v-else>
              <q-item>
                <q-item-section>
                  <q-item-label caption> Noch keine Dokumente gefunden. </q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-list>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, defineEmits } from 'vue'

// Props nur im Template genutzt
const props = defineProps({
  search: { type: String, default: '' },
  documents: { type: Array, default: () => [] },
  folders: { type: Array, default: () => [] },
  selectedFolderId: { type: String, default: null },
  selectedId: { type: String, default: null },
  loadingList: { type: Boolean, default: false },
})

const emit = defineEmits([
  'update:search',
  'update:selectedFolderId',
  'refresh',
  'select-document',
  'open-upload',
])

const selectedFolderModel = computed({
  get: () => props.selectedFolderId || null,
  set: (val) => emit('update:selectedFolderId', val || null),
})

const currentFolderLabel = computed(() =>
  selectedFolderModel.value ? `Dokumente von ${selectedFolderModel.value}` : 'Alle Dokumente'
)

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function ocrStatusColor(status) {
  switch (status) {
    case 'done':
      return 'positive'
    case 'processing':
      return 'info'
    case 'error':
      return 'negative'
    default:
      return 'grey-6'
  }
}

function ocrStatusIcon(status) {
  switch (status) {
    case 'done':
      return 'mdi-text-search-variant'
    case 'error':
      return 'mdi-alert-circle-outline'
    case 'pending':
    default:
      return 'mdi-timer-sand'
  }
}

function ocrStatusLabel(status) {
  switch (status) {
    case 'done':
      return 'OCR erfolgreich - Volltext durchsuchbar'
    case 'processing':
      return 'OCR laeuft gerade'
    case 'error':
      return 'OCR fehlgeschlagen'
    case 'pending':
    default:
      return 'OCR in Warteschlange'
  }
}
</script>

<style scoped>
/* Volle Höhe, damit der Scrollbereich in der Karte greifen kann */
.sidebar-root {
  height: 100%;
}

/* Abgerundete Kartenoptik */
.sidebar-card {
  border-radius: 10px;
}

/* Abgerundete List Items */
.doc-item {
  border-radius: 8px;
}

/* Hervorhebung der aktiven Auswahl */
.doc-item-active {
  background: #121212; /* Quasar primary */
  color: white;
  border-radius: 8px;
}

/* OCR-Status-Icon zentrieren und Klickziel fuer Tooltip stabil halten */
.ocr-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}
</style>
