<template>
  <q-card class="epic-card column full-height">
    <q-card-section class="q-pb-sm">
      <div class="row items-center">
        <q-icon name="mdi-information-outline" class="text-primary q-mr-sm" size="20px" />
        <div class="text-subtitle1 text-weight-medium">Details</div>
        <q-space />

        <q-btn
          class="q-ml-xs"
          color="accent"
          round
          flat
          size="sm"
          icon="mdi-file-upload-outline"
          :disable="!document"
          @click="onUpload"
        >
          <q-tooltip>Neue Version hochladen (Check-in)</q-tooltip>
        </q-btn>
        <q-btn
          class="q-ml-xs"
          color="secondary"
          round
          flat
          size="sm"
          icon="mdi-file-download-outline"
          :disable="!document"
          @click="onDownload"
        >
          <q-tooltip>Datei herunterladen</q-tooltip>
        </q-btn>
        <q-btn
          class="q-ml-xs"
          color="primary"
          round
          flat
          size="sm"
          icon="mdi-printer"
          :disable="!document"
          @click="onPrint"
        >
          <q-tooltip>Drucken</q-tooltip>
        </q-btn>
        <q-btn
          class="q-ml-xs"
          color="primary"
          round
          flat
          size="sm"
          icon="edit"
          :disable="!document"
          @click="onEdit"
        >
          <q-tooltip>Titel, Labels und Ordner bearbeiten</q-tooltip>
        </q-btn>
        <q-btn
          class="q-ml-xs"
          color="negative"
          round
          flat
          size="sm"
          icon="delete"
          :disable="!document"
          @click="onDelete"
        >
          <q-tooltip>Dokument loeschen</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>

    <q-separator dark />

    <!-- OCR-Status-Banner -->
    <q-card-section v-if="document?.ocr?.status" class="q-pb-none">
      <div :class="['ocr-banner', ocrBannerClass]">
        <div class="row items-center no-wrap q-gutter-md">
          <q-spinner
            v-if="document.ocr.status === 'processing'"
            color="info"
            size="22px"
          />
          <q-icon
            v-else
            :name="ocrStatusIcon"
            :color="ocrStatusColor"
            size="22px"
          />
          <div>
            <div class="text-body2 text-weight-medium">{{ ocrStatusTitle }}</div>
            <div class="text-caption text-grey-5 q-mt-xs">{{ ocrStatusHint }}</div>
          </div>
        </div>
      </div>
    </q-card-section>

    <!-- Metadaten als Definition-List -->
    <q-card-section v-if="document" class="q-py-md">
      <div class="meta-list">
        <div class="meta-row">
          <q-icon name="mdi-format-title" class="meta-icon" />
          <div class="meta-content">
            <div class="meta-label">Titel</div>
            <div class="meta-value">{{ document.title }}</div>
          </div>
        </div>

        <div class="meta-row">
          <q-icon name="mdi-clock-outline" class="meta-icon" />
          <div class="meta-content">
            <div class="meta-label">Hochgeladen</div>
            <div class="meta-value">{{ formatDateTime(document.uploadedAt) }}</div>
          </div>
        </div>

        <div v-if="document.documentDate" class="meta-row">
          <q-icon name="mdi-calendar-outline" class="meta-icon" />
          <div class="meta-content">
            <div class="meta-label">Dokumentdatum</div>
            <div class="meta-value">{{ formatDate(document.documentDate) }}</div>
          </div>
        </div>

        <div v-if="document.fromParty" class="meta-row">
          <q-icon name="mdi-account-arrow-right-outline" class="meta-icon" />
          <div class="meta-content">
            <div class="meta-label">Absender</div>
            <div class="meta-value">{{ document.fromParty }}</div>
          </div>
        </div>

        <div v-if="document.toParty" class="meta-row">
          <q-icon name="mdi-account-arrow-left-outline" class="meta-icon" />
          <div class="meta-content">
            <div class="meta-label">Empfänger</div>
            <div class="meta-value">{{ document.toParty }}</div>
          </div>
        </div>

        <div v-if="document.version" class="meta-row">
          <q-icon name="mdi-history" class="meta-icon" />
          <div class="meta-content">
            <div class="meta-label">Version</div>
            <div class="meta-value">
              v{{ document.version }}
              <span v-if="document.history?.length" class="text-grey-6 q-ml-xs">
                (vorherige: v{{ document.history.map((h) => h.version).join(', v') }})
              </span>
            </div>
          </div>
        </div>

        <div v-if="document.folder" class="meta-row">
          <q-icon name="mdi-folder-outline" class="meta-icon" />
          <div class="meta-content">
            <div class="meta-label">Ordner</div>
            <div class="meta-value">{{ document.folder }}</div>
          </div>
        </div>

        <div class="meta-row">
          <q-icon name="mdi-tag-multiple-outline" class="meta-icon" />
          <div class="meta-content">
            <div class="meta-label">Labels</div>
            <div class="meta-value">
              <template v-if="document.labels?.length">
                <q-chip
                  v-for="label in document.labels"
                  :key="label"
                  size="sm"
                  color="primary"
                  text-color="white"
                  :label="label"
                  class="q-mr-xs q-mb-xs"
                />
              </template>
              <span v-else class="text-grey-6 text-caption">keine</span>
            </div>
          </div>
        </div>
      </div>
    </q-card-section>

    <q-card-section v-else class="text-grey-6 text-center q-py-xl">
      <q-icon name="mdi-file-document-outline" size="48px" class="q-mb-sm block" />
      <div class="text-body2">Kein Dokument ausgewählt</div>
    </q-card-section>

    <q-separator dark />

    <!-- Notizen -->
    <q-card-section class="q-pb-sm">
      <div class="row items-center">
        <q-icon name="mdi-note-text-outline" class="text-primary q-mr-sm" size="20px" />
        <div class="text-subtitle1 text-weight-medium">Notizen</div>
        <q-space />
        <q-btn
          color="primary"
          round
          flat
          size="sm"
          icon="mdi-content-save"
          :disable="!document"
          @click="emit('save-note')"
        >
          <q-tooltip>Notizen speichern</q-tooltip>
        </q-btn>
      </div>
    </q-card-section>

    <q-card-section class="col q-pt-none">
      <q-input
        :model-value="newNoteText"
        type="textarea"
        outlined
        dark
        dense
        autogrow
        :disable="!document || addingNote"
        placeholder="Notiz zu diesem Dokument..."
        class="notes-input"
        @update:model-value="(val) => emit('update:new-note-text', val)"
      />
    </q-card-section>
  </q-card>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue'
import { formatDate, formatDateTime } from 'src/utils/date'

const props = defineProps({
  document: { type: Object, default: null },
  newNoteText: { type: String, default: '' },
  addingNote: { type: Boolean, default: false },
  downloading: { type: Boolean, default: false },
  uploading: { type: Boolean, default: false },
})

const ocrStatusIcon = computed(() => {
  switch (props.document?.ocr?.status) {
    case 'done': return 'mdi-text-search-variant'
    case 'error': return 'mdi-alert-circle-outline'
    case 'pending':
    default: return 'mdi-timer-sand'
  }
})

const ocrStatusColor = computed(() => {
  switch (props.document?.ocr?.status) {
    case 'done': return 'positive'
    case 'processing': return 'info'
    case 'error': return 'negative'
    default: return 'grey-6'
  }
})

const ocrStatusTitle = computed(() => {
  switch (props.document?.ocr?.status) {
    case 'done': return 'OCR erfolgreich'
    case 'processing': return 'OCR laeuft'
    case 'error': return 'OCR fehlgeschlagen'
    case 'pending':
    default: return 'OCR in Warteschlange'
  }
})

const ocrStatusHint = computed(() => {
  switch (props.document?.ocr?.status) {
    case 'done': return 'Volltext ist durchsuchbar'
    case 'processing': return 'Texterkennung wird gerade ausgeführt'
    case 'error': return props.document?.ocr?.errorMessage || 'OCR konnte nicht abgeschlossen werden'
    case 'pending':
    default: return 'Wird gleich vom Worker abgearbeitet'
  }
})

const ocrBannerClass = computed(() => {
  switch (props.document?.ocr?.status) {
    case 'done': return 'banner-done'
    case 'processing': return 'banner-processing'
    case 'error': return 'banner-error'
    case 'pending':
    default: return 'banner-pending'
  }
})

const emit = defineEmits([
  'update:new-note-text',
  'save-note',
  'delete-document',
  'download-document',
  'upload-document',
  'edit-document',
  'print-document',
])

function onDelete() { if (props.document) emit('delete-document') }
function onDownload() { if (props.document) emit('download-document') }
function onUpload() { if (props.document) emit('upload-document') }
function onEdit() { if (props.document) emit('edit-document') }
function onPrint() { if (props.document) emit('print-document') }
</script>

<style scoped>
.ocr-banner {
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid;
}
.banner-done {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.35);
}
.banner-processing {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.35);
}
.banner-error {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.35);
}
.banner-pending {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--epic-border-strong);
}

.meta-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.meta-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.meta-icon {
  font-size: 18px;
  color: var(--q-primary);
  margin-top: 2px;
  flex-shrink: 0;
}

.meta-content {
  flex: 1;
  min-width: 0;
}

.meta-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--epic-text-muted);
  margin-bottom: 2px;
}

.meta-value {
  font-size: 13px;
  color: var(--epic-text-primary);
  word-break: break-word;
}

.notes-input :deep(.q-field__control) {
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
}
</style>
