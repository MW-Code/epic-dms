<template>
  <q-dialog v-model="open">
    <q-card class="epic-dialog" style="min-width: 460px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-md">
        <q-icon name="mdi-cloud-upload-outline" class="text-primary q-mr-sm" size="24px" />
        <div class="text-h6 text-weight-medium">Dokument hochladen</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="cancel" />
      </q-card-section>

      <q-separator dark />

      <q-card-section class="q-gutter-md q-pt-lg">
        <q-input
          v-model="displayName"
          label="Angezeigter Titel (optional)"
          outlined
          dense
          dark
          hint="Standard: Dateiname ohne .pdf"
        />

        <div>
          <div class="text-caption text-grey-5 q-mb-xs">PDF-Datei</div>

          <!-- Hidden Native-Input wird vom Drop-Zone-Klick getriggert -->
          <input
            ref="fileInput"
            type="file"
            accept="application/pdf"
            class="hidden-input"
            @change="onInputChange"
          />

          <!-- Drag&Drop-Zone: Klick oeffnet Dateidialog, Drop befuellt das File -->
          <div
            class="drop-zone"
            :class="{
              'drop-zone--active': isDragging,
              'drop-zone--filled': !!selectedFile,
            }"
            @click="fileInput?.click()"
            @dragenter.prevent="onDragEnter"
            @dragover.prevent="onDragOver"
            @dragleave.prevent="onDragLeave"
            @drop.prevent="onDrop"
          >
            <template v-if="selectedFile">
              <q-icon name="mdi-file-check-outline" size="42px" class="text-positive" />
              <div class="drop-zone__filename">{{ selectedFile.name }}</div>
              <div class="drop-zone__hint">{{ formatBytes(selectedFile.size) }} · klicken zum Tauschen</div>
              <q-btn
                flat
                dense
                round
                size="sm"
                icon="mdi-close"
                class="drop-zone__clear"
                @click.stop="clearFile"
              >
                <q-tooltip>Auswahl entfernen</q-tooltip>
              </q-btn>
            </template>
            <template v-else>
              <q-icon
                :name="isDragging ? 'mdi-tray-arrow-down' : 'mdi-cloud-upload-outline'"
                size="42px"
                class="drop-zone__icon"
              />
              <div class="drop-zone__title">
                {{ isDragging ? 'Hier loslassen' : 'PDF hier ablegen oder klicken' }}
              </div>
              <div class="drop-zone__hint">nur .pdf · max. 25 MB</div>
            </template>
          </div>
        </div>

        <q-select
          v-model="selectedLabels"
          :options="labelOptions"
          label="Labels"
          multiple
          use-input
          use-chips
          stack-label
          outlined
          dense
          dark
          input-debounce="0"
          hint="Bestehende Labels wählen oder neue eintippen & Enter drücken"
          new-value-mode="add-unique"
          popup-content-class="epic-menu"
          @new-value="createValue"
          @filter="filterFn"
        />

        <q-select
          v-model="selectedFolder"
          :options="folderOptions"
          label="Ordner (optional)"
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
          @new-value="createFolderValue"
        />
      </q-card-section>

      <q-separator dark />

      <q-card-actions align="right" class="q-pa-md">
        <q-btn flat no-caps label="Abbrechen" color="grey-5" @click="cancel" />
        <q-btn
          unelevated
          rounded
          no-caps
          color="primary"
          label="Hochladen"
          icon="mdi-upload"
          :loading="uploading"
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

// Dialog zum Hochladen eines PDFs inkl. optionalem Titel und Labels
const emit = defineEmits(['uploaded'])

const uiStore = useUiStore()
const open = computed({
  get: () => uiStore.uploadDialogOpen,
  set: (val) => (uiStore.uploadDialogOpen = val),
})

const $q = useQuasar()
const fileInput = ref(null)
const uploading = ref(false)
const displayName = ref('')

// Aktuell gewaehlte Datei (entweder via Klick-Picker oder per Drop gesetzt)
const selectedFile = ref(null)
const isDragging = ref(false)
// Counter, weil dragenter/leave auch fuer Kindelemente feuert -
// nur wenn alle Levels verlassen sind, ist die Zone wirklich verlassen.
let dragDepth = 0

const MAX_BYTES = 25 * 1024 * 1024

function isPdf(file) {
  if (!file) return false
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function setFile(file) {
  if (!file) return
  if (!isPdf(file)) {
    $q.notify({ type: 'warning', message: 'Nur PDF-Dateien sind erlaubt' })
    return
  }
  if (file.size > MAX_BYTES) {
    $q.notify({ type: 'warning', message: 'Datei zu gross (max. 25 MB)' })
    return
  }
  selectedFile.value = file
}

function onInputChange(e) {
  const file = e.target?.files?.[0]
  if (file) setFile(file)
}

function onDragEnter() {
  dragDepth += 1
  isDragging.value = true
}
function onDragOver() {
  // prevent reicht via .prevent-Modifier; wir muessen aber sicherstellen,
  // dass isDragging waehrend des Drags wahr bleibt.
  isDragging.value = true
}
function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) isDragging.value = false
}
function onDrop(e) {
  dragDepth = 0
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) setFile(file)
}

function clearFile() {
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
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

// Label-Auswahlzustände
const selectedLabels = ref([]) // aktuelle Auswahl des Users
const allLabels = ref([]) // vollständige Liste aller Label-Namen
const labelOptions = ref([]) // gefilterte Optionen fürs Dropdown
const folderOptions = ref([])
const selectedFolder = ref(null)

// Labels von der API laden und auf Strings normalisieren
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
    folderOptions.value = items.map((name) => ({
      label: name,
      value: name,
    }))
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

onMounted(() => {
  loadLabels()
  loadFolders()
})

function resetForm() {
  displayName.value = ''
  selectedLabels.value = []
  selectedFolder.value = null
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function cancel() {
  resetForm()
  uiStore.closeUploadDialog()
}

// Fügt neue Labels hinzu oder nutzt vorhandene Schreibweisen
function createValue(val, done) {
  const v = String(val || '').trim()
  if (!v) {
    done()
    return
  }

  const existingLabel = allLabels.value.find((lbl) => lbl.toLowerCase() === v.toLowerCase())

  if (!existingLabel) {
    // 1. Array-Referenz komplett neu setzen, um Reaktivität zu gewährleisten
    allLabels.value = [...allLabels.value, v]

    // Die aktuell gefilterte Optionsliste auf die neue Master-Liste setzen
    labelOptions.value = allLabels.value

    // Quasar sagen: füge den Wert dem Model hinzu.
    done(v, 'add-unique')
  } else {
    // Wenn das Label existiert, fügen wir den bestehenden Wert hinzu.
    // DIES IST WICHTIG: Wenn der Wert bereits existiert, muss der case-korrekte (aus der Master-Liste) Wert verwendet werden.
    done(existingLabel, 'add-unique')
  }
}
/**
 * Filter-Funktion für Autocomplete
 */
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

async function upload() {
  if (!selectedFile.value) {
    $q.notify({ type: 'warning', message: 'Bitte eine PDF-Datei wählen' })
    return
  }

  const file = selectedFile.value
  const formData = new FormData()
  formData.append('file', file)

  if (displayName.value.trim()) {
    formData.append('titleOverride', displayName.value.trim())
  }

  if (selectedLabels.value.length) {
    formData.append('labels', JSON.stringify(selectedLabels.value))
  }

  if (selectedFolder.value) {
    formData.append('folder', selectedFolder.value)
  }

  uploading.value = true
  try {
    await api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    $q.notify({ type: 'positive', message: 'Upload erfolgreich' })
    uiStore.closeUploadDialog()
    emit('uploaded')
    resetForm()
    loadLabels() // neue Labels in Vorschlagsliste ziehen
  } catch (err) {
    console.error(err)
    $q.notify({
      type: 'negative',
      message: err?.response?.data?.error || 'Upload fehlgeschlagen',
    })
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
  padding: 28px 20px;
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
.drop-zone--filled {
  border-style: solid;
  border-color: rgba(16, 185, 129, 0.55);
  background: rgba(16, 185, 129, 0.06);
}
.drop-zone--filled:hover {
  border-color: rgba(16, 185, 129, 0.8);
  background: rgba(16, 185, 129, 0.1);
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
.drop-zone__filename {
  font-size: 14px;
  font-weight: 500;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drop-zone__clear {
  position: absolute;
  top: 6px;
  right: 6px;
  color: var(--epic-text-muted);
}
.drop-zone__clear:hover {
  color: var(--q-negative);
}
</style>
