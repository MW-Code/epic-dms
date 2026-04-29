<template>
  <q-card class="column full-height">
    <q-card-section class="row items-center justify-between q-pb-xs">
      <div class="text-subtitle1">Dokument Vorschau</div>
      <div v-if="document" class="text-caption text-grey-7">
        {{ document.originalFileName }}
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section class="col q-pa-none">
      <div class="fit flex flex-center bg-grey-9">
        <template v-if="loadingFile">
          <q-spinner size="40px" />
        </template>

        <template v-else-if="viewerUrl && document">
          <object
            v-if="isPdf"
            :data="viewerUrl"
            type="application/pdf"
            style="width: 100%; height: 100%"
          >
            <p class="q-pa-md">
              PDF kann nicht angezeigt werden.
              <a :href="viewerUrl" target="_blank">Download</a>
            </p>
          </object>

          <img v-else-if="isImage" :src="viewerUrl" style="max-width: 100%; max-height: 100%" />

          <div v-else class="column items-center q-gutter-sm">
            <div class="text-body2">Dateityp: {{ document.mimeType }}</div>
            <q-btn
              :href="viewerUrl"
              target="_blank"
              color="primary"
              label="Download"
              icon="download"
            />
          </div>
        </template>

        <template v-else>
          <div class="text-grey-5 text-center q-pa-md">
            Wähle links ein Dokument aus,<br />
            oder lade ein neues hoch.
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
