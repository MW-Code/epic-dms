<template>
  <q-card class="epic-card column full-height">
    <!-- Header -->
    <q-card-section class="row items-center q-py-sm q-px-md no-wrap">
      <q-icon name="mdi-file-eye-outline" class="text-primary q-mr-sm" size="20px" />
      <div class="text-subtitle1 text-weight-medium">Vorschau</div>
      <q-space />
      <div v-if="document" class="text-caption text-grey-5 ellipsis" style="max-width: 40%">
        {{ document.originalFileName }}
      </div>
    </q-card-section>

    <q-separator dark />

    <!-- Toolbar (nur wenn PDF geladen) -->
    <div v-if="canShowToolbar" class="viewer-toolbar row items-center no-wrap q-gutter-sm q-px-md q-py-xs">
      <!-- Page Nav -->
      <q-btn dense flat round size="sm" icon="mdi-chevron-left"
        :disable="page <= 1" @click="prevPage">
        <q-tooltip>Vorherige Seite</q-tooltip>
      </q-btn>
      <div class="page-indicator text-body2">
        <q-input
          v-model.number="pageInput"
          type="number"
          dense dark borderless
          input-class="text-center page-input"
          :min="1" :max="pageCount"
          @keyup.enter="goToPageInput"
          @blur="goToPageInput"
        />
        <span class="text-grey-5">/ {{ pageCount }}</span>
      </div>
      <q-btn dense flat round size="sm" icon="mdi-chevron-right"
        :disable="page >= pageCount" @click="nextPage">
        <q-tooltip>Naechste Seite</q-tooltip>
      </q-btn>

      <q-separator dark vertical class="q-mx-sm" />

      <!-- Zoom -->
      <q-btn dense flat round size="sm" icon="mdi-magnify-minus-outline"
        :disable="scale <= MIN_SCALE" @click="zoomOut">
        <q-tooltip>Verkleinern</q-tooltip>
      </q-btn>
      <div class="zoom-indicator text-body2 text-grey-5">{{ Math.round(scale * 100) }}%</div>
      <q-btn dense flat round size="sm" icon="mdi-magnify-plus-outline"
        :disable="scale >= MAX_SCALE" @click="zoomIn">
        <q-tooltip>Vergroessern</q-tooltip>
      </q-btn>
      <q-btn dense flat round size="sm" icon="mdi-fit-to-page-outline" @click="fitWidth">
        <q-tooltip>An Breite anpassen</q-tooltip>
      </q-btn>

      <q-separator dark vertical class="q-mx-sm" />

      <!-- OCR-Text als Dialog, vor allem fuer gescannte PDFs ohne Text-Layer -->
      <q-btn
        dense flat round size="sm"
        icon="mdi-text-recognition"
        :disable="!hasOcrText"
        @click="ocrTextDialog = true"
      >
        <q-tooltip>{{ hasOcrText ? 'OCR-Text anzeigen / kopieren' : 'Kein OCR-Text vorhanden' }}</q-tooltip>
      </q-btn>

      <q-space />

      <!-- Find Counter (wenn Suchwort aktiv) -->
      <div v-if="findQuery" class="find-counter row items-center q-gutter-xs">
        <q-icon name="mdi-text-search" size="16px" class="text-secondary" />
        <span class="text-caption">
          <span v-if="matchCount > 0">{{ currentMatchIndex + 1 }} / {{ matchCount }}</span>
          <span v-else class="text-grey-6">keine Treffer</span>
          <span class="text-grey-5"> fuer "{{ findQuery }}"</span>
        </span>
        <q-btn dense flat round size="xs" icon="mdi-arrow-up"
          :disable="matchCount === 0" @click="prevMatch">
          <q-tooltip>Voriger Treffer</q-tooltip>
        </q-btn>
        <q-btn dense flat round size="xs" icon="mdi-arrow-down"
          :disable="matchCount === 0" @click="nextMatch">
          <q-tooltip>Naechster Treffer</q-tooltip>
        </q-btn>
      </div>
    </div>

    <q-separator v-if="canShowToolbar" dark />

    <!-- Content -->
    <q-card-section class="col q-pa-none">
      <div ref="stageRef" class="viewer-stage" @scroll="onScroll">
        <template v-if="loadingFile">
          <div class="centered"><q-spinner color="primary" size="48px" /></div>
        </template>

        <template v-else-if="viewerUrl && document && isPdf">
          <VuePdfEmbed
            ref="pdfRef"
            :source="viewerUrl"
            :width="pdfWidth"
            text-layer
            class="pdf-canvas"
            @loaded="onPdfLoaded"
            @rendered="onPdfRendered"
          />
        </template>

        <template v-else-if="viewerUrl && document && isImage">
          <img :src="viewerUrl" class="viewer-image" />
        </template>

        <template v-else-if="viewerUrl && document">
          <div class="centered column items-center q-gutter-md">
            <q-icon name="mdi-file-question-outline" size="64px" class="text-grey-6" />
            <div class="text-body2 text-grey-4">Dateityp: {{ document.mimeType }}</div>
            <q-btn :href="viewerUrl" target="_blank" unelevated rounded no-caps
              color="primary" label="Datei oeffnen" icon="download" />
          </div>
        </template>

        <template v-else>
          <div class="centered empty-state column items-center text-center">
            <q-icon name="mdi-file-document-multiple-outline" size="72px" class="text-grey-7 q-mb-md" />
            <div class="text-h6 text-grey-4 q-mb-xs">Kein Dokument ausgewaehlt</div>
            <div class="text-body2 text-grey-6">
              Waehle links ein Dokument aus<br />
              oder lade ein neues hoch.
            </div>
          </div>
        </template>
      </div>
    </q-card-section>

    <!-- OCR-Text-Dialog: zeigt den extrahierten Volltext (auch fuer Bild-PDFs
         ohne Text-Layer, wo man im Viewer nicht selektieren kann) -->
    <q-dialog v-model="ocrTextDialog">
      <q-card class="epic-dialog ocr-dialog">
        <q-card-section class="row items-center q-pb-md">
          <q-icon name="mdi-text-recognition" class="text-primary q-mr-sm" size="24px" />
          <div class="text-h6 text-weight-medium">OCR-Volltext</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-separator dark />

        <q-card-section class="q-pa-none">
          <q-input
            :model-value="document?.ocr?.text || ''"
            type="textarea"
            readonly dark borderless
            class="ocr-textarea"
            input-class="ocr-textarea__input"
          />
        </q-card-section>

        <q-separator dark />

        <q-card-actions align="right" class="q-pa-md">
          <div class="text-caption text-grey-6 q-mr-md">
            {{ (document?.ocr?.text || '').length }} Zeichen
          </div>
          <q-btn flat no-caps label="Schliessen" color="grey-5" v-close-popup />
          <q-btn
            unelevated rounded no-caps
            color="primary"
            label="In Zwischenablage"
            icon="mdi-content-copy"
            @click="copyOcrText"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-card>
</template>

<script setup>
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue'
import { useQuasar } from 'quasar'
import VuePdfEmbed from 'vue-pdf-embed'
import 'vue-pdf-embed/dist/styles/textLayer.css'
import 'vue-pdf-embed/dist/styles/annotationLayer.css'
import { useUiStore } from 'src/stores/ui'

const props = defineProps({
  document: { type: Object, default: null },
  viewerUrl: { type: String, default: null },
  loadingFile: { type: Boolean, default: false },
})

const uiStore = useUiStore()
const $q = useQuasar()

// OCR-Dialog
const ocrTextDialog = ref(false)
const hasOcrText = computed(() => (props.document?.ocr?.text || '').trim().length > 0)

async function copyOcrText() {
  const text = props.document?.ocr?.text || ''
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    $q.notify({ type: 'positive', message: 'OCR-Text kopiert' })
  } catch (err) {
    console.error('Clipboard-Fehler:', err)
    $q.notify({ type: 'negative', message: 'Kopieren fehlgeschlagen' })
  }
}

const stageRef = ref(null)
const pdfRef = ref(null)
const pageCount = ref(0)
const page = ref(1)
const pageInput = ref(1)

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const scale = ref(1.0)
const baseWidth = 800 // Pixel-Width bei scale=1
const pdfWidth = computed(() => Math.round(baseWidth * scale.value))

const isPdf = computed(() => props.document?.mimeType === 'application/pdf')
const isImage = computed(() => props.document?.mimeType?.startsWith('image/'))
const canShowToolbar = computed(() => isPdf.value && !!props.viewerUrl && pageCount.value > 0)

// --- Find ---
const findQuery = computed(() => uiStore.searchQuery?.trim() || '')
const matches = ref([]) // Array<{ pageEl: HTMLElement, spans: HTMLSpanElement[] }>
const matchCount = computed(() => matches.value.length)
const currentMatchIndex = ref(0)

// PDF.js liefert pages mit Class .vue-pdf-embed__page
function getPageElements() {
  if (!stageRef.value) return []
  return Array.from(stageRef.value.querySelectorAll('.vue-pdf-embed__page'))
}

function clearHighlights() {
  matches.value = []
  if (!stageRef.value) return
  stageRef.value.querySelectorAll('.epic-find-mark').forEach((el) => {
    // Mark wieder durch reinen Textknoten ersetzen
    const parent = el.parentNode
    if (!parent) return
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
    parent.normalize()
  })
}

// Markiert alle Vorkommen von `term` im Text-Layer.
function applyHighlights() {
  clearHighlights()
  const term = findQuery.value
  if (!term) return

  const pageEls = getPageElements()
  const found = []

  for (const pageEl of pageEls) {
    const textLayer = pageEl.querySelector('.textLayer') || pageEl
    const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT)
    const nodes = []
    let n
    while ((n = walker.nextNode())) nodes.push(n)

    const re = new RegExp(escapeRegExp(term), 'gi')
    for (const node of nodes) {
      const text = node.nodeValue
      if (!text || !re.test(text)) continue
      re.lastIndex = 0

      const frag = document.createDocumentFragment()
      let lastIdx = 0
      let m
      while ((m = re.exec(text)) !== null) {
        if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)))
        const mark = document.createElement('mark')
        mark.className = 'epic-find-mark'
        mark.textContent = m[0]
        frag.appendChild(mark)
        found.push({ el: mark, pageEl })
        lastIdx = m.index + m[0].length
      }
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)))
      node.parentNode.replaceChild(frag, node)
    }
  }

  matches.value = found
  currentMatchIndex.value = 0
  if (found.length) scrollToMatch(0)
}

function scrollToMatch(idx) {
  matches.value.forEach((m) => m.el.classList.remove('epic-find-mark--current'))
  const target = matches.value[idx]
  if (!target) return
  target.el.classList.add('epic-find-mark--current')
  target.el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function nextMatch() {
  if (!matchCount.value) return
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matchCount.value
  scrollToMatch(currentMatchIndex.value)
}

function prevMatch() {
  if (!matchCount.value) return
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchCount.value) % matchCount.value
  scrollToMatch(currentMatchIndex.value)
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// --- PDF Lifecycle ---
function onPdfLoaded(pdf) {
  pageCount.value = pdf.numPages
  page.value = 1
  pageInput.value = 1
}

function onPdfRendered() {
  // Nach komplettem Render Highlights anwenden
  nextTick(applyHighlights)
}

watch(() => findQuery.value, () => {
  if (canShowToolbar.value) nextTick(applyHighlights)
})

watch(() => props.viewerUrl, () => {
  pageCount.value = 0
  page.value = 1
  pageInput.value = 1
  scale.value = 1.0
  matches.value = []
  ocrTextDialog.value = false
})

// --- Toolbar Actions ---
function goToPage(p) {
  if (!canShowToolbar.value) return
  const target = Math.max(1, Math.min(pageCount.value, p))
  page.value = target
  pageInput.value = target
  const pageEls = getPageElements()
  const el = pageEls[target - 1]
  if (el && stageRef.value) {
    stageRef.value.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
  }
}
function prevPage() { goToPage(page.value - 1) }
function nextPage() { goToPage(page.value + 1) }
function goToPageInput() { goToPage(parseInt(pageInput.value, 10) || 1) }

function zoomIn() { scale.value = Math.min(MAX_SCALE, +(scale.value + 0.1).toFixed(2)) }
function zoomOut() { scale.value = Math.max(MIN_SCALE, +(scale.value - 0.1).toFixed(2)) }
function fitWidth() {
  if (!stageRef.value) return
  const stageW = stageRef.value.clientWidth - 40
  scale.value = Math.max(MIN_SCALE, Math.min(MAX_SCALE, +(stageW / baseWidth).toFixed(2)))
}

// Erkennt aktuelle Seite anhand Scroll-Position
function onScroll() {
  if (!canShowToolbar.value) return
  const stage = stageRef.value
  if (!stage) return
  const pageEls = getPageElements()
  const scrollMid = stage.scrollTop + stage.clientHeight / 2
  for (let i = 0; i < pageEls.length; i++) {
    const el = pageEls[i]
    if (el.offsetTop <= scrollMid && el.offsetTop + el.offsetHeight > scrollMid) {
      if (page.value !== i + 1) {
        page.value = i + 1
        pageInput.value = i + 1
      }
      return
    }
  }
}

onBeforeUnmount(clearHighlights)
</script>

<style scoped>
.viewer-toolbar {
  background: rgba(255, 255, 255, 0.02);
}
.page-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}
.page-indicator :deep(.page-input) {
  width: 36px;
  font-size: 13px;
}
.zoom-indicator {
  min-width: 44px;
  text-align: center;
}

.viewer-stage {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #0b0b10;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(124, 58, 237, 0.6) transparent;
}
.viewer-stage::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.viewer-stage::-webkit-scrollbar-thumb {
  background: rgba(124, 58, 237, 0.5);
  border-radius: 4px;
}
.viewer-stage::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 58, 237, 0.8);
}

.pdf-canvas {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pdf-canvas :deep(.vue-pdf-embed__page) {
  position: relative;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  border-radius: 6px;
  overflow: hidden;
}

.viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.centered {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.empty-state { padding: 32px; user-select: none; }

/* OCR-Text-Dialog: groesserer, lesbarer Block fuer den Volltext */
.ocr-dialog {
  width: 720px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}
.ocr-dialog .ocr-textarea {
  background: rgba(255, 255, 255, 0.02);
}
.ocr-dialog :deep(.ocr-textarea__input) {
  min-height: 320px;
  max-height: 60vh;
  padding: 16px 18px;
  font-family: 'Roboto Mono', ui-monospace, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--epic-text-primary);
  white-space: pre-wrap;
}
</style>

<style>
/* Highlights muessen ungescoped sein, weil sie ins per-page-text-layer
   injiziert werden, das nicht zur Komponente gehoert. */
.epic-find-mark {
  background: rgba(255, 213, 79, 0.35);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}
.epic-find-mark--current {
  background: rgba(255, 152, 0, 0.45);
  outline: 1.5px solid rgba(255, 111, 0, 0.85);
  outline-offset: 1px;
}
</style>
