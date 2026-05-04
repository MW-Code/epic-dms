<template>
  <q-dialog v-model="open" persistent>
    <q-card class="epic-dialog" style="min-width: 460px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-md">
        <q-icon name="mdi-cloud-upload-outline" class="text-primary q-mr-sm" size="24px" />
        <div class="text-h6 text-weight-medium">Dokumente hochladen</div>
        <q-space />
        <q-btn flat round dense icon="close" :disable="uploading" @click="cancel" />
      </q-card-section>

      <q-separator dark />

      <q-card-section class="q-gutter-md q-pt-lg">
        <!-- Titel-Override - nur bei genau 1 Datei sinnvoll, sonst stillschweigend ignoriert. -->
        <q-input
          v-if="selectedFiles.length <= 1"
          v-model="displayName"
          label="Angezeigter Titel (optional)"
          outlined
          dense
          dark
          hint="Standard: Dateiname ohne .pdf"
          :disable="uploading"
        />

        <div>
          <div class="text-caption text-grey-5 q-mb-xs">PDF-Dateien (1–20)</div>

          <!-- Hidden Native-Input - via Klick auf die Drop-Zone getriggert.
               multiple=true erlaubt Mehrfach-Auswahl im Datei-Picker. -->
          <input
            ref="fileInput"
            type="file"
            accept="application/pdf"
            multiple
            class="hidden-input"
            @change="onInputChange"
          />

          <!-- Zweiter Input fuer den Ordner-Picker (webkitdirectory).
               Nutzt dieselbe File-API wie der Klick-Picker - dadurch
               zuverlaessig auch in Setups, in denen Drag&Drop bockt
               (Brave/Chromium auf KDE-Wayland mit Dolphin). -->
          <input
            ref="folderInput"
            type="file"
            webkitdirectory
            multiple
            class="hidden-input"
            @change="onFolderInputChange"
          />

          <div
            class="drop-zone"
            :class="{ 'drop-zone--active': isDragging }"
            @click="onDropZoneClick"
            @dragenter.prevent="onDragEnter"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
          >
            <q-icon
              :name="isDragging ? 'mdi-tray-arrow-down' : 'mdi-cloud-upload-outline'"
              size="42px"
              class="drop-zone__icon"
            />
            <div class="drop-zone__title">
              {{
                isDragging
                  ? 'Hier loslassen'
                  : 'PDFs oder Ordner hier ablegen oder klicken'
              }}
            </div>
            <div class="drop-zone__hint">
              nur .pdf · max. 25&nbsp;MB pro Datei · max. 20 Dateien
            </div>
          </div>

          <!-- Sekundaerer Picker: oeffnet den nativen Ordner-Auswahldialog.
               Wichtig wenn Drag&Drop in der jeweiligen Linux-DE-Combo nicht
               liefert. -->
          <div class="row q-mt-sm justify-end">
            <q-btn
              flat
              dense
              no-caps
              size="sm"
              color="primary"
              icon="mdi-folder-open-outline"
              label="Ganzen Ordner auswählen"
              :disable="uploading"
              @click="onFolderPickerClick"
            />
          </div>

          <!-- Dateiliste mit pro-Datei-Status. Erst sichtbar wenn was ausgewaehlt ist. -->
          <q-list v-if="selectedFiles.length" class="file-list q-mt-sm" separator dark>
            <q-item v-for="entry in selectedFiles" :key="entry.id" class="file-list__item">
              <q-item-section avatar>
                <q-icon :name="iconFor(entry)" :color="colorFor(entry)" size="22px">
                  <q-spinner-dots
                    v-if="entry.status === 'uploading'"
                    color="primary"
                    size="22px"
                  />
                </q-icon>
              </q-item-section>
              <q-item-section>
                <q-item-label class="file-list__name">{{ entry.file.name }}</q-item-label>
                <q-item-label caption>
                  <span>{{ formatBytes(entry.file.size) }}</span>
                  <span v-if="entry.status === 'error'" class="text-negative">
                    · {{ entry.error || 'Fehler' }}
                  </span>
                  <span v-else-if="entry.status === 'done'" class="text-positive">
                    · hochgeladen
                  </span>
                  <span v-else-if="entry.status === 'uploading'" class="text-primary">
                    · lädt…
                  </span>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  size="sm"
                  icon="mdi-close"
                  :disable="uploading"
                  @click="removeFile(entry.id)"
                >
                  <q-tooltip>Entfernen</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <q-select
          v-model="selectedLabels"
          :options="labelOptions"
          label="Labels (für alle Dateien)"
          multiple
          use-input
          use-chips
          stack-label
          outlined
          dense
          dark
          input-debounce="0"
          hint="Bestehende wählen oder neue eintippen & Enter"
          new-value-mode="add-unique"
          popup-content-class="epic-menu"
          :disable="uploading"
          @new-value="createValue"
          @filter="filterFn"
        />

        <q-select
          v-model="selectedFolder"
          :options="folderOptions"
          label="Ordner (optional, gilt für alle)"
          dense
          outlined
          dark
          clearable
          use-input
          hide-selected
          fill-input
          emit-value
          map-options
          new-value-mode="add-unique"
          popup-content-class="epic-menu"
          :disable="uploading"
          @new-value="createFolderValue"
        />
      </q-card-section>

      <q-separator dark />

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat no-caps label="Abbrechen" color="grey-5" :disable="uploading" @click="cancel" />
        <q-btn
          unelevated
          rounded
          no-caps
          color="primary"
          :label="uploadButtonLabel"
          icon="mdi-upload"
          :loading="uploading"
          :disable="!selectedFiles.length"
          @click="upload"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'src/boot/axios'
import { useUiStore } from 'src/stores/ui'

// Multi-Upload-Dialog. Geteilte Felder (Labels, Ordner) gelten fuer alle Dateien.
// titleOverride wird nur bei genau 1 Datei genutzt; sonst Dateiname-Fallback pro Datei.
const emit = defineEmits(['uploaded'])

const uiStore = useUiStore()
const open = computed({
  get: () => uiStore.uploadDialogOpen,
  set: (val) => (uiStore.uploadDialogOpen = val),
})

const $q = useQuasar()
const fileInput = ref(null)
const folderInput = ref(null)
const uploading = ref(false)
const displayName = ref('')

const MAX_BYTES = 25 * 1024 * 1024
const MAX_FILES = 20

// Dateiliste: jede Entry hat einen lokalen Counter-id, das File-Objekt
// und einen Upload-Status. status: 'pending' | 'uploading' | 'done' | 'error'.
const selectedFiles = ref([])
let nextEntryId = 1

const isDragging = ref(false)
// Counter, weil dragenter/leave fuer Kindelemente feuert.
let dragDepth = 0

// Label/Folder-State
const selectedLabels = ref([])
const allLabels = ref([])
const labelOptions = ref([])
const folderOptions = ref([])
const selectedFolder = ref(null)

const uploadButtonLabel = computed(() => {
  if (!selectedFiles.value.length) return 'Hochladen'
  if (selectedFiles.value.length === 1) return 'Hochladen'
  return `Hochladen (${selectedFiles.value.length})`
})

function isPdfFile(file) {
  if (!file) return false
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

// Fuegt eine Datei der Liste hinzu, mit Validierung. Gibt true bei Erfolg.
function addFile(file) {
  if (!file) return false
  if (!isPdfFile(file)) return false
  // 0-byte-Files: in Brave/Chromium auf KDE-Wayland kommt Drag&Drop von
  // Dolphin oft ohne Datei-Inhalte durch. Wir skippen, sonst geht ein leerer
  // Upload an den Server.
  if (file.size === 0) {
    $q.notify({
      type: 'warning',
      timeout: 6000,
      message: `${file.name}: leerer Inhalt — Drag&Drop hat nicht funktioniert. Bitte „Ganzen Ordner auswählen“ oder Klick-Picker nutzen.`,
    })
    return false
  }
  if (file.size > MAX_BYTES) {
    $q.notify({
      type: 'warning',
      message: `${file.name}: zu gross (max. 25 MB)`,
    })
    return false
  }
  if (selectedFiles.value.length >= MAX_FILES) {
    $q.notify({ type: 'warning', message: `Max. ${MAX_FILES} Dateien pro Upload` })
    return false
  }
  // Duplikate (Name+Groesse) ignorieren - vermeidet Doppel-Drop.
  const exists = selectedFiles.value.some(
    (e) => e.file.name === file.name && e.file.size === file.size,
  )
  if (exists) return false

  selectedFiles.value.push({
    id: nextEntryId++,
    file,
    status: 'pending',
    error: null,
  })
  return true
}

function addFiles(fileList) {
  let added = 0
  let skipped = 0
  for (const file of fileList) {
    if (selectedFiles.value.length >= MAX_FILES) {
      skipped += 1
      continue
    }
    if (!isPdfFile(file)) {
      skipped += 1
      continue
    }
    if (addFile(file)) added += 1
    else skipped += 1
  }
  if (skipped > 0) {
    $q.notify({
      type: 'info',
      message: `${added} Datei${added === 1 ? '' : 'en'} übernommen, ${skipped} übersprungen (kein PDF / Limit / Duplikat)`,
    })
  }
}

function removeFile(id) {
  selectedFiles.value = selectedFiles.value.filter((e) => e.id !== id)
}

function onDropZoneClick() {
  if (uploading.value) return
  fileInput.value?.click()
}

function onInputChange(e) {
  const files = Array.from(e.target?.files || [])
  if (files.length) addFiles(files)
  // Damit der gleiche Datei-Pick nochmal gehen wuerde, Input zuruecksetzen.
  if (fileInput.value) fileInput.value.value = ''
}

function onFolderPickerClick() {
  if (uploading.value) return
  folderInput.value?.click()
}

// Beim Ordner-Picker bekommen wir die komplette Inhaltsliste (rekursiv) als
// File-Array - Browser filtert webkitdirectory-Inputs ohne accept-Attribut
// nicht, deshalb filtern wir hier selbst auf .pdf.
function onFolderInputChange(e) {
  const files = Array.from(e.target?.files || [])
  if (files.length) addFiles(files)
  if (folderInput.value) folderInput.value.value = ''
}

function onDragEnter() {
  if (uploading.value) return
  dragDepth += 1
  isDragging.value = true
}
function onDragOver() {
  if (uploading.value) return
  isDragging.value = true
}
function onDragLeave() {
  if (uploading.value) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragging.value = false
}

async function onDrop(e) {
  if (uploading.value) return
  dragDepth = 0
  isDragging.value = false

  // dataTransfer wird nach dem Event-Tick stale - daher SYNCHRON alles greifen
  // was wir spaeter brauchen, bevor wir await machen.
  const items = e.dataTransfer?.items
  const directFiles = Array.from(e.dataTransfer?.files || [])

  let entries = []
  let hasFolder = false
  if (items && items.length && typeof items[0].webkitGetAsEntry === 'function') {
    entries = Array.from(items)
      .map((it) => it.webkitGetAsEntry?.())
      .filter(Boolean)
    hasFolder = entries.some((entry) => entry.isDirectory)
  }

  // Reine Datei-Drops: dataTransfer.files ist verlaesslicher und liefert
  // immer die korrekte File.size. webkitGetAsEntry().file() hat in manchen
  // Browsern ein Timing-Problem, das zu 0-byte File-Objekten fuehrt.
  if (!hasFolder) {
    if (directFiles.length) addFiles(directFiles)
    return
  }

  // Sobald ein Ordner dabei ist, brauchen wir die rekursive Entry-Traversal.
  const collected = []
  for (const entry of entries) {
    if (collected.length >= MAX_FILES) break
    await collectFromEntry(entry, collected)
  }
  if (collected.length) {
    addFiles(collected)
  } else {
    $q.notify({
      type: 'info',
      message: 'Im Ordner wurden keine PDF-Dateien gefunden',
    })
  }
}

// Rekursiv durch eine FileSystemEntry-Struktur laufen und alle Files einsammeln.
// Wird aktiv genutzt fuer Ordner-Drop. Limit beachten, sonst kann ein grosser
// Ordner den Browser kurz blockieren.
async function collectFromEntry(entry, sink) {
  if (sink.length >= MAX_FILES) return
  if (entry.isFile) {
    const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)))
    if (file) sink.push(file)
    return
  }
  if (entry.isDirectory) {
    const reader = entry.createReader()
    const all = await readAllDirectoryEntries(reader)
    for (const child of all) {
      await collectFromEntry(child, sink)
      if (sink.length >= MAX_FILES) return
    }
  }
}

// readEntries() liefert pro Aufruf max. ~100 Eintraege - solange wiederholen
// bis ein leerer Batch kommt.
async function readAllDirectoryEntries(reader) {
  const all = []
  while (true) {
    const batch = await new Promise((resolve) =>
      reader.readEntries(
        (entries) => resolve(entries),
        () => resolve([]),
      ),
    )
    if (!batch.length) break
    all.push(...batch)
  }
  return all
}

function iconFor(entry) {
  if (entry.status === 'done') return 'mdi-check-circle'
  if (entry.status === 'error') return 'mdi-alert-circle'
  if (entry.status === 'uploading') return ''
  return 'mdi-file-pdf-box'
}
function colorFor(entry) {
  if (entry.status === 'done') return 'positive'
  if (entry.status === 'error') return 'negative'
  return 'grey-5'
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

async function loadLabels() {
  try {
    const res = await api.get('/labels')
    const items = Array.isArray(res.data.items) ? res.data.items : []
    allLabels.value = items.map((item) =>
      typeof item === 'object' && item !== null && item.name ? item.name : String(item),
    )
    labelOptions.value = allLabels.value
  } catch (err) {
    console.error('Label-Load Fehler:', err)
  }
}

async function loadFolders() {
  try {
    const res = await api.get('/documents/folders')
    const items = res.data.items || []
    folderOptions.value = items.map((name) => ({ label: name, value: name }))
  } catch (err) {
    console.error('Folder-Load Fehler:', err)
  }
}

function createFolderValue(val, done) {
  const v = String(val || '').trim()
  if (!v) {
    done()
    return
  }
  const exists = folderOptions.value.some((opt) => opt.value === v)
  if (!exists) {
    folderOptions.value = [...folderOptions.value, { label: v, value: v }]
  }
  selectedFolder.value = v
  done(v, 'add-unique')
}

function createValue(val, done) {
  const v = String(val || '').trim()
  if (!v) {
    done()
    return
  }
  const existingLabel = allLabels.value.find((lbl) => lbl.toLowerCase() === v.toLowerCase())
  if (!existingLabel) {
    allLabels.value = [...allLabels.value, v]
    labelOptions.value = allLabels.value
    done(v, 'add-unique')
  } else {
    done(existingLabel, 'add-unique')
  }
}

function filterFn(val, update) {
  update(() => {
    const needle = String(val || '').toLowerCase()
    if (!needle) {
      labelOptions.value = allLabels.value
    } else {
      labelOptions.value = allLabels.value.filter((lbl) => lbl.toLowerCase().includes(needle))
    }
  })
}

onMounted(() => {
  loadLabels()
  loadFolders()
})

function resetForm() {
  displayName.value = ''
  selectedLabels.value = []
  selectedFolder.value = null
  selectedFiles.value = []
  if (fileInput.value) fileInput.value.value = ''
}

function cancel() {
  if (uploading.value) return
  resetForm()
  uiStore.closeUploadDialog()
}

// Sequentieller Upload: jedes File einzeln POSTen. So koennen wir pro
// Datei den Status pflegen und Fehler einzeln melden. Backend akzeptiert
// pro Request 1-20 Dateien, wir nutzen aktuell nur 1 pro Request fuer
// granulares Feedback.
async function upload() {
  if (!selectedFiles.value.length) return

  uploading.value = true
  let okCount = 0
  let failCount = 0

  try {
    for (const entry of selectedFiles.value) {
      // Bereits hochgeladene oder ueberspringen
      if (entry.status === 'done') {
        okCount += 1
        continue
      }

      entry.status = 'uploading'
      entry.error = null

      try {
        const formData = new FormData()
        formData.append('file', entry.file)

        // titleOverride nur bei genau 1 Datei sinnvoll
        if (selectedFiles.value.length === 1 && displayName.value.trim()) {
          formData.append('titleOverride', displayName.value.trim())
        }
        if (selectedLabels.value.length) {
          formData.append('labels', JSON.stringify(selectedLabels.value))
        }
        if (selectedFolder.value) {
          formData.append('folder', selectedFolder.value)
        }

        await api.post('/documents', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        entry.status = 'done'
        okCount += 1
      } catch (err) {
        console.error('Upload-Fehler', entry.file.name, err)
        entry.status = 'error'
        entry.error = err?.response?.data?.error || 'Upload fehlgeschlagen'
        failCount += 1
      }
    }

    // Summary-Notify
    if (failCount === 0) {
      $q.notify({
        type: 'positive',
        message:
          okCount === 1
            ? 'Upload erfolgreich'
            : `${okCount} Dateien hochgeladen`,
      })
      // Nur bei vollstaendigem Erfolg automatisch schliessen.
      uiStore.closeUploadDialog()
      emit('uploaded')
      resetForm()
      loadLabels()
    } else if (okCount === 0) {
      $q.notify({
        type: 'negative',
        message: 'Upload fehlgeschlagen',
      })
    } else {
      $q.notify({
        type: 'warning',
        message: `${okCount} hochgeladen, ${failCount} Fehler — siehe Liste`,
      })
      // Erfolgreiche aus der Liste nehmen, damit der User nur noch fehlerhafte sieht
      selectedFiles.value = selectedFiles.value.filter((e) => e.status !== 'done')
      emit('uploaded')
      loadLabels()
    }
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.drop-zone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px 20px;
  border-radius: 12px;
  border: 1.5px dashed rgba(124, 58, 237, 0.45);
  background: rgba(124, 58, 237, 0.04);
  color: var(--epic-text-primary);
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}
.drop-zone:hover {
  border-color: rgba(124, 58, 237, 0.7);
  background: rgba(124, 58, 237, 0.08);
}
.drop-zone--active {
  border-color: var(--q-primary);
  background: rgba(124, 58, 237, 0.16);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.22);
  transform: scale(1.01);
}

.drop-zone__icon {
  color: rgba(167, 139, 250, 0.85);
}
.drop-zone--active .drop-zone__icon {
  color: var(--q-primary);
}

.drop-zone__title {
  font-size: 14px;
  font-weight: 500;
}
.drop-zone__hint {
  font-size: 12px;
  color: var(--epic-text-muted);
}

.file-list {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--epic-border);
  border-radius: 10px;
  max-height: 220px;
  overflow-y: auto;
}
.file-list__item {
  padding-top: 6px;
  padding-bottom: 6px;
}
.file-list__name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
