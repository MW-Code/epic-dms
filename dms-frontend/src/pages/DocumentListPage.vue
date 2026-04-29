<template>
  <q-page class="q-pa-sm bg-grey-10 fit" style="height: calc(100vh - 50px) !important">
    <div class="row no-wrap fit">
      <!-- Sidebar mit Suchfeld und Dokumentliste -->
      <div class="col-3 full-height q-pa-sm">
        <DocumentSidebar
          :search="search"
          :documents="documents"
          :folders="folders"
          :selected-folder-id="selectedFolderId"
          :selected-id="selectedId"
          :loading-list="loadingList"
          @update:search="(val) => (search = val)"
          @update:selectedFolderId="(val) => (selectedFolderId = val)"
          @refresh="refreshLists"
          @select-document="selectDocument"
          @open-upload="uiStore.openUploadDialog()"
        />
      </div>

      <!-- Mittlere Spalte zeigt die Datei/Vorschau -->
      <div class="col full-height q-pa-sm">
        <DocumentViewer
          :document="selectedDocument"
          :viewer-url="viewerUrl"
          :loading-file="loadingFile"
        />
      </div>

      <!-- Rechte Spalte mit Metadaten und Notizfeld -->
      <div class="col-3 full-height q-pa-sm">
        <DocumentDetails
          :document="selectedDocument"
          :new-note-text="newNoteText"
          :adding-note="addingNote"
          :downloading="downloading"
          :uploading="uploading"
          @update:new-note-text="(val) => (newNoteText = val)"
          @save-note="addNote"
          @delete-document="handleDeleteDocument"
          @download-document="handleDownloadDocument"
          @upload-document="handleUploadDocument"
          @edit-document="handleEditDocument"
          @print-document="handlePrintDocument"
        />
      </div>
    </div>

    <!-- Verstecktes File-Input für Check-in einer neuen Version -->
    <input
      ref="checkinInput"
      type="file"
      accept="application/pdf"
      style="display: none"
      @change="onCheckinFileSelected"
    />

    <UploadDialog @uploaded="refreshLists" />

    <DocumentEditDialog
      v-model="editDialogOpen"
      :document="selectedDocument"
      @saved="onDocumentSaved"
    />
  </q-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar, debounce } from 'quasar'
import { api } from 'src/boot/axios'

import DocumentSidebar from 'components/dms/DocumentSidebar.vue'
import DocumentViewer from 'components/dms/DocumentViewer.vue'
import DocumentDetails from 'components/dms/DocumentDetails.vue'
import DocumentEditDialog from 'components/dms/DocumentEditDialog.vue'
import UploadDialog from 'components/dms/UploadDialog.vue'

import { useUiStore } from 'src/stores/ui'
import { useDocumentStore } from 'src/stores/documents'

const $q = useQuasar()
const uiStore = useUiStore()
const docStore = useDocumentStore()

// Lokaler UI-State
const search = ref('')
const newNoteText = ref('')
const editDialogOpen = ref(false)
const checkinInput = ref(null)
const addingNote = ref(false)
const folders = ref([])
const selectedFolderId = ref(null)

// Ableitungen aus dem Store
const documents = computed(() => docStore.documents)
const selectedDocument = computed(() => docStore.selectedDocument)
const selectedId = computed(() => docStore.selectedId)
const loadingList = computed(() => docStore.loadingList)
const loadingFile = computed(() => docStore.loadingFile)
const downloading = computed(() => docStore.downloading)
const uploading = computed(() => docStore.uploading)
const viewerUrl = computed(() => docStore.viewerUrl)

// Liste laden (optional mit Suchstring)
async function loadDocuments() {
  await docStore.fetchList(search.value, selectedFolderId.value)
  newNoteText.value = docStore.selectedDocument?.notesText || ''
}

async function loadFolders() {
  try {
    const res = await api.get('/documents/folders')
    const apiItems = res.data.items || []

    // Fallback: Folders aus der aktuellen Dokumentliste ergänzen
    const docFolders = (docStore.documents || [])
      .map((d) => d.folder)
      .filter((f) => typeof f === 'string' && f.trim().length > 0)

    const allNames = [...apiItems, ...docFolders].map((n) => String(n).trim())
    const uniqueNames = allNames.filter((val, idx, arr) => val && arr.indexOf(val) === idx)

    const base = [{ label: 'Alle Ordner', value: null }]
    folders.value = base.concat(uniqueNames.map((name) => ({ label: name, value: name })))

    // Wenn aktueller Ordner nicht mehr existiert, auf "Alle" zurücksetzen
    const hasCurrent = folders.value.some((opt) => opt.value === selectedFolderId.value)
    if (!hasCurrent) {
      selectedFolderId.value = null
    }
  } catch (err) {
    console.error('Folder-Load Fehler (ListPage):', err)
  }
}

async function refreshLists() {
  await Promise.all([loadDocuments(), loadFolders()])
}

const debouncedReload = debounce(() => {
  loadDocuments()
}, 300)

// Dokument aus Sidebar auswählen
async function selectDocument(doc) {
  await docStore.select(doc)
  newNoteText.value = docStore.selectedDocument?.notesText || ''
}

// Edit-Dialog öffnen
function handleEditDocument() {
  if (!selectedDocument.value) return
  editDialogOpen.value = true
}

// Rückmeldung vom Edit-Dialog
async function onDocumentSaved(updatedDoc) {
  docStore.applyUpdatedDoc(updatedDoc)
  await loadFolders()
}

// Löschen
async function handleDeleteDocument() {
  if (!selectedDocument.value) return

  $q.dialog({
    title: 'Dokument löschen',
    message: `Dokument "${selectedDocument.value.title}" wirklich löschen?`,
    cancel: true,
    persistent: true,
  }).onOk(async () => {
    try {
      await docStore.deleteSelected()
      $q.notify({ type: 'positive', message: 'Dokument gelöscht' })
      newNoteText.value = ''
    } catch (err) {
      console.error(err)
      $q.notify({
        type: 'negative',
        message: err?.response?.data?.error || 'Löschen fehlgeschlagen',
      })
    }
  })
}

let printIframe = null
// Download
async function handleDownloadDocument() {
  try {
    await docStore.downloadSelected()
  } catch (err) {
    console.error(err)
    $q.notify({ type: 'negative', message: 'Download fehlgeschlagen' })
  }
}
// Drucken im aktuellen Tab über ein verstecktes iframe
async function handlePrintDocument() {
  if (!selectedDocument.value) return

  try {
    // Sicherstellen, dass die Datei geladen ist
    if (!docStore.fileUrl && docStore.selectedId) {
      await docStore.loadFile(docStore.selectedId)
    }

    const url = viewerUrl.value || docStore.fileUrl
    if (!url) {
      $q.notify({
        type: 'warning',
        message: 'Keine Datei zum Drucken geladen',
      })
      return
    }

    // Hidden iframe im aktuellen Tab erzeugen

    if (printIframe != null) {
      printIframe.remove()
    }

    printIframe = document.createElement('iframe')
    printIframe.style.position = 'fixed'
    printIframe.style.right = '0'
    printIframe.style.bottom = '0'
    printIframe.style.width = '0'
    printIframe.style.height = '0'
    printIframe.style.border = '0'
    printIframe.src = url

    printIframe.onload = () => {
      try {
        if (printIframe.contentWindow) {
          printIframe.contentWindow.focus()
          printIframe.contentWindow.print()
        } else {
          // Fallback
          window.focus()
          window.print()
        }
      } catch (e) {
        console.error('Print iframe error:', e)
        window.focus()
        window.print()
      }
      // KEIN close/remove hier – das war das Problem
      // wenn du später aufräumen willst, kannst du es manuell machen:
      // setTimeout(() => iframe.remove(), 30000)
    }

    document.body.appendChild(printIframe)
  } catch (err) {
    console.error(err)
    $q.notify({
      type: 'negative',
      message: 'Drucken fehlgeschlagen',
    })
  }
}

// Checkin (Version-Update)
function handleUploadDocument() {
  if (!selectedDocument.value) return
  checkinInput.value?.click()
}

async function onCheckinFileSelected(event) {
  const files = event.target.files
  if (!files?.length) return

  try {
    await docStore.checkinSelected(files[0])
    $q.notify({ type: 'positive', message: 'Dokument-Version aktualisiert' })
    newNoteText.value = docStore.selectedDocument?.notesText || ''
  } catch (err) {
    console.error(err)
    $q.notify({
      type: 'negative',
      message: err?.response?.data?.error || 'Update fehlgeschlagen',
    })
  } finally {
    event.target.value = ''
  }
}

// Notizen speichern
async function addNote() {
  if (!selectedDocument.value) return

  addingNote.value = true
  try {
    await docStore.saveNotes(newNoteText.value || '')
    $q.notify({ type: 'positive', message: 'Notizen gespeichert' })
  } catch (err) {
    console.error(err)
    $q.notify({
      type: 'negative',
      message: 'Notizen konnten nicht gespeichert werden',
    })
  } finally {
    addingNote.value = false
  }
}

// Lifecycle
onMounted(async () => {
  await refreshLists()
})

// Suche aus Topbar / UI-Store
watch(
  () => uiStore.searchQuery,
  (val) => {
    search.value = val || ''
    debouncedReload()
  },
  { immediate: true },
)

watch(
  () => selectedFolderId.value,
  () => {
    loadDocuments()
  },
)
</script>

<style scoped>
.full-height {
  height: 100%;
}
</style>
