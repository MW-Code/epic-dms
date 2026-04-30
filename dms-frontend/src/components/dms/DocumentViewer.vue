<template>
  <q-card class="epic-card column full-height">
    <q-card-section class="row items-center q-py-sm q-px-md">
      <q-icon name="mdi-file-eye-outline" class="text-primary q-mr-sm" size="20px" />
      <div class="text-subtitle1 text-weight-medium">Vorschau</div>
      <q-space />
      <div v-if="document" class="text-caption text-grey-5 ellipsis" style="max-width: 50%">
        {{ document.originalFileName }}
      </div>
    </q-card-section>

    <q-separator dark />

    <q-card-section class="col q-pa-none">
      <div class="viewer-stage">
        <template v-if="loadingFile">
          <q-spinner color="primary" size="48px" />
        </template>

        <template v-else-if="viewerUrl && document">
          <object
            v-if="isPdf"
            :data="viewerUrl"
            type="application/pdf"
            class="viewer-object"
          >
            <p class="q-pa-md text-grey-5">
              Dein Browser kann das PDF nicht inline anzeigen.
              <a :href="viewerUrl" target="_blank" class="text-primary">Hier herunterladen</a>
            </p>
          </object>

          <img v-else-if="isImage" :src="viewerUrl" class="viewer-image" />

          <div v-else class="column items-center q-gutter-md">
            <q-icon name="mdi-file-question-outline" size="64px" class="text-grey-6" />
            <div class="text-body2 text-grey-4">Dateityp: {{ document.mimeType }}</div>
            <q-btn
              :href="viewerUrl"
              target="_blank"
              unelevated
              rounded
              no-caps
              color="primary"
              label="Datei öffnen"
              icon="download"
            />
          </div>
        </template>

        <template v-else>
          <div class="empty-state column items-center text-center">
            <q-icon name="mdi-file-document-multiple-outline" size="72px" class="text-grey-7 q-mb-md" />
            <div class="text-h6 text-grey-4 q-mb-xs">Kein Dokument ausgewählt</div>
            <div class="text-body2 text-grey-6">
              Wähle links ein Dokument aus<br />
              oder lade ein neues hoch.
            </div>
          </div>
        </template>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { computed, defineProps } from 'vue'

const props = defineProps({
  document: { type: Object, default: null },
  viewerUrl: { type: String, default: null },
  loadingFile: { type: Boolean, default: false },
})

const isPdf = computed(() => props.document?.mimeType === 'application/pdf')
const isImage = computed(() => props.document?.mimeType?.startsWith('image/'))
</script>

<style scoped>
.viewer-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0b0b10;
  border-radius: 0 0 12px 12px;
  overflow: hidden;
}

/* PDF nimmt komplette Stage ein, kein Border vom <object> */
.viewer-object {
  width: 100%;
  height: 100%;
  border: 0;
  background: #0b0b10;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.empty-state {
  padding: 32px;
  user-select: none;
}
</style>
