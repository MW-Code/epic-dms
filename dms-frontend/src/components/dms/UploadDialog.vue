<template>
  <q-dialog v-model="open">
    <q-card style="min-width: 420px; max-width: 90vw">
      <q-card-section class="q-gutter-md">
        <div class="text-h5">Dokument hochladen</div>

        <q-input
          v-model="displayName"
          label="Angezeigter Titel (optional)"
          outlined
          dense
          hint="Standard: Dateiname ohne .pdf"
        />

        <div>
          <div class="text-caption text-grey-7 q-mb-xs">Datei (PDF)</div>
          <input ref="fileInput" type="file" accept="application/pdf" />
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
          input-debounce="0"
          hint="Bestehende Labels wählen oder neue eintippen & Enter drücken"
          new-value-mode="add-unique"
          @new-value="createValue"
          @filter="filterFn"
        />

        <q-select
          v-model="selectedFolder"
          :options="folderOptions"
          label="Ordner (optional)"
          dense
          outlined
          clearable
          use-input
          hide-selected
          fill-input
          emit-value
          map-options
          new-value-mode="add-unique"
          @new-value="createFolderValue"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Abbrechen" @click="cancel" />
        <q-btn
          flat
          color="primary"
          label="Hochladen"
          icon="upload"
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
  if (!fileInput.value || !fileInput.value.files?.length) {
    $q.notify({ type: 'warning', message: 'Bitte eine PDF-Datei wählen' })
    return
  }

  console.log('selectedLabels vor Upload:', selectedLabels.value)

  const file = fileInput.value.files[0]
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
