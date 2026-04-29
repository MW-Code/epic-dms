<template>
  <q-card class="column full-height">
    <q-card-section class="q-pb-xs">
      <div class="row items-center text-subtitle1">
        Details
        <q-space />

        <q-btn
          class="q-mr-sm"
          color="accent"
          round
          flat
          size="md"
          icon="mdi-file-upload-outline"
          :disable="!document"
          @click="onUpload"
        />
        <q-btn
          class="q-mr-sm"
          color="secondary"
          round
          flat
          size="md"
          icon="mdi-file-download-outline"
          :disable="!document"
          @click="onDownload"
        />
        <q-btn
          class="q-mr-sm"
          color="primary"
          round
          flat
          size="md"
          icon="mdi-printer"
          :disable="!document"
          @click="onPrint"
        />
        <q-btn
          class="q-mr-sm"
          color="primary"
          round
          flat
          size="md"
          icon="edit"
          :disable="!document"
          @click="onEdit"
        />
        <q-btn
          color="negative"
          round
          flat
          size="md"
          icon="delete"
          :disable="!document"
          @click="onDelete"
        />
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section v-if="document" class="q-gutter-xs">
      <div class="text-body2">
        <span class="text-grey-6">Titel:</span><br />
        {{ document.title }}
      </div>

      <div class="text-body2 q-mt-xs">
        <span class="text-grey-6">Hochgeladen:</span><br />
        {{ formatDateTime(document.uploadedAt) }}
      </div>

      <div v-if="document.documentDate" class="text-body2 q-mt-xs">
        <span class="text-grey-6">Dokumentdatum:</span><br />
        {{ formatDate(document.documentDate) }}
      </div>

      <div v-if="document.fromParty" class="text-body2 q-mt-xs">
        <span class="text-grey-6">Absender:</span><br />
        {{ document.fromParty }}
      </div>

      <div v-if="document.toParty" class="text-body2 q-mt-xs">
        <span class="text-grey-6">Empfänger:</span><br />
        {{ document.toParty }}
      </div>

      <!-- Version -->
      <div v-if="document.version" class="text-body2 q-mt-xs">
        <span class="text-grey-6">Version:</span><br />
        v{{ document.version }}
      </div>

      <div v-if="document.history?.length" class="text-body2 q-mt-xs">
        <span class="text-grey-6">Vergangene Versionen:</span><br />
        v{{ document.history.map((h) => h.version).join(', ') }}
      </div>

      <div class="text-body2 q-mt-xs">
        <span class="text-grey-6">Labels:</span><br />
        <template v-if="document.labels?.length">
          <q-badge
            v-for="label in document.labels"
            :key="label"
            color="accent"
            class="q-mr-xs q-mb-xs"
            :label="label"
          />
        </template>
        <template v-else>
          <span class="text-grey-6">keine</span>
        </template>
      </div>
    </q-card-section>

    <q-card-section v-else>
      <div class="text-grey-6">Kein Dokument ausgewählt.</div>
    </q-card-section>

    <q-separator />

    <q-card-section class="q-pb-xs">
      <div class="row items-center text-subtitle1">
        Notizen
        <q-space />

        <q-btn
          class="q-mr-sm"
          color="primary"
          round
          flat
          size="md"
          icon="mdi-content-save"
          :disable="!document"
          @click="emit('save-note')"
        />
      </div>
    </q-card-section>

    <q-card-section class="col q-pt-xs column">
      <q-scroll-area class="col">
        <div>
          <q-input
            :model-value="newNoteText"
            type="textarea"
            borderless
            class="full-height q-pl-md"
            autogrow
            :disable="!document || addingNote"
            @update:model-value="(val) => emit('update:new-note-text', val)"
            style="border-left: 3px solid black"
          />
        </div>
      </q-scroll-area>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  document: { type: Object, default: null },
  newNoteText: { type: String, default: '' },
  addingNote: { type: Boolean, default: false },
  downloading: { type: Boolean, default: false },
  uploading: { type: Boolean, default: false },
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

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString()
}

function onDelete() {
  if (!props.document) return
  emit('delete-document')
}

function onDownload() {
  if (!props.document) return
  emit('download-document')
}

function onUpload() {
  if (!props.document) return
  emit('upload-document')
}

function onEdit() {
  if (!props.document) return
  emit('edit-document')
}

function onPrint() {
  if (!props.document) return
  emit('print-document')
}
</script>
