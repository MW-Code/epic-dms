<template>
  <div class="sidebar-root column q-gutter-sm">
    <q-card class="epic-card sidebar-card column col">
      <!-- Header: Ordnerfilter + Refresh -->
      <q-card-section class="q-pb-sm">
        <div class="row items-center no-wrap q-gutter-sm">
          <q-icon name="mdi-folder-multiple-outline" class="text-primary" size="20px" />
          <q-select
            v-model="selectedFolderModel"
            borderless
            dense
            dark
            :options="folders"
            clearable
            emit-value
            map-options
            class="col text-body2"
            popup-content-class="epic-menu"
          />
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="refresh"
            :loading="loadingList"
            @click="emit('refresh')"
          >
            <q-tooltip>Liste aktualisieren</q-tooltip>
          </q-btn>
        </div>
      </q-card-section>

      <q-separator dark />

      <!-- Liste -->
      <q-card-section class="col q-pa-none">
        <q-scroll-area class="col fit">
          <q-list padding class="q-px-sm">
            <template v-if="documents.length">
              <q-item
                v-for="doc in documents"
                :key="doc._id"
                clickable
                :active="doc._id === selectedId"
                active-class="doc-item-active"
                class="doc-item q-mb-xs"
                @click="emit('select-document', doc)"
              >
                <q-item-section>
                  <q-item-label class="doc-title ellipsis">
                    {{ doc.title }}
                  </q-item-label>
                  <q-item-label
                    caption
                    class="doc-meta ellipsis"
                  >
                    {{ formatRelative(doc.uploadedAt) }}
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
              <div class="empty-state column items-center q-py-xl text-center">
                <q-icon name="mdi-file-search-outline" size="56px" class="text-grey-7 q-mb-md" />
                <div class="text-grey-5 text-body2">Noch keine Dokumente</div>
                <div class="text-grey-7 text-caption q-mt-xs">
                  Lade über die Topbar dein erstes PDF hoch.
                </div>
              </div>
            </template>
          </q-list>
        </q-scroll-area>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup>
import { computed, defineEmits } from 'vue'
import { formatRelative } from 'src/utils/date'

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

function ocrStatusColor(status) {
  switch (status) {
    case 'done': return 'positive'
    case 'processing': return 'info'
    case 'error': return 'negative'
    default: return 'grey-6'
  }
}

function ocrStatusIcon(status) {
  switch (status) {
    case 'done': return 'mdi-text-search-variant'
    case 'error': return 'mdi-alert-circle-outline'
    case 'pending':
    default: return 'mdi-timer-sand'
  }
}

function ocrStatusLabel(status) {
  switch (status) {
    case 'done': return 'OCR erfolgreich - Volltext durchsuchbar'
    case 'processing': return 'OCR laeuft gerade'
    case 'error': return 'OCR fehlgeschlagen'
    case 'pending':
    default: return 'OCR in Warteschlange'
  }
}
</script>

<style scoped>
.sidebar-root {
  height: 100%;
}

.sidebar-card {
  overflow: hidden;
}

/* Listen-Item: dezent, klar, mit Hover */
.doc-item {
  border-radius: 8px;
  padding: 10px 12px;
  transition: background 0.15s ease;
}
.doc-item:hover {
  background: var(--epic-card-hover);
}

.doc-item-active {
  background: linear-gradient(90deg, rgba(124, 58, 237, 0.18), rgba(124, 58, 237, 0.06)) !important;
  border: 1px solid rgba(124, 58, 237, 0.4);
}
.doc-item-active .doc-title {
  color: #fff;
  font-weight: 500;
}
.doc-item-active .doc-meta {
  color: rgba(255, 255, 255, 0.7) !important;
}

.doc-title {
  font-size: 14px;
  color: var(--epic-text-primary);
}

.doc-meta {
  font-size: 12px;
  color: var(--epic-text-muted) !important;
  margin-top: 2px;
}

.ocr-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.empty-state {
  padding: 0 16px;
}
</style>
