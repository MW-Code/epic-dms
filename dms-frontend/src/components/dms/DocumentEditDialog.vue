<template>
  <q-dialog v-model="open">
    <q-card class="epic-dialog" style="min-width: 460px; max-width: 90vw">
      <q-card-section class="row items-center q-pb-md">
        <q-icon name="mdi-pencil-outline" class="text-primary q-mr-sm" size="24px" />
        <div class="text-h6 text-weight-medium">Dokument bearbeiten</div>
        <q-space />
        <q-btn flat round dense icon="close" @click="cancel" />
      </q-card-section>

      <q-separator dark />

      <q-card-section class="q-gutter-md q-pt-lg">
        <q-input
          v-model="title"
          label="Titel"
          outlined
          dense
          dark
          :disable="!document"
        />

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
          :disable="!document"
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
          :disable="!document"
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
          label="Speichern"
          icon="mdi-content-save"
          :loading="saving"
          :disable="!document"
          @click="save"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar } from 'quasar'
import { api } from 'src/boot/axios'

// Dialog zum Bearbeiten von Titel und Labels eines Dokuments
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  document: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const $q = useQuasar()

const open = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const title = ref('')
const selectedLabels = ref([]) // Aktuelle Auswahl des Users
const allLabels = ref([]) // Masterliste aller vorhandenen Label-Namen
const labelOptions = ref([]) // Gefilterte Liste fürs Dropdown
const folderOptions = ref([])
const selectedFolder = ref(null)
const saving = ref(false)

// Labels aus dem Backend holen
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

async function loadFolders(currentFolder = null) {
  try {
    const res = await api.get('/documents/folders')
    const items = res.data.items || []
    const opts = items.map((name) => ({
      label: name,
      value: name,
    }))

    // Aktuellen Ordner sicherstellen, auch wenn die API (noch) keinen liefert
    if (currentFolder && !opts.some((o) => o.value === currentFolder)) {
      opts.push({ label: currentFolder, value: currentFolder })
    }

    folderOptions.value = opts
  } catch (err) {
    console.error('Folder-Load Fehler (EditDialog):', err)
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
  loadFolders(props.document?.folder || null)
})

// Dokumentwechsel in lokale Felder spiegeln
watch(
  () => props.document,
  (doc) => {
    if (!doc) {
      title.value = ''
      selectedLabels.value = []
      selectedFolder.value = null
      return
    }

    title.value = doc.title || ''
    selectedLabels.value = Array.isArray(doc.labels) ? [...doc.labels] : []
    selectedFolder.value = doc.folder || null
    // Ordnerliste aktualisieren, damit vorhandene Ordner angezeigt werden
    loadFolders(selectedFolder.value)
  },
  { immediate: true },
)

// Label-Helfer
function createValue(val, done) {
  const v = String(val || '').trim()
  if (!v) {
    done()
    return
  }

  const existing = allLabels.value.find((lbl) => lbl.toLowerCase() === v.toLowerCase())

  if (!existing) {
    allLabels.value = [...allLabels.value, v]
    labelOptions.value = allLabels.value
    done(v, 'add-unique')
  } else {
    done(existing, 'add-unique')
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

// Actions
function cancel() {
  open.value = false
}

async function save() {
  if (!props.document) return

  const payload = {
    title: title.value.trim(),
    labels: selectedLabels.value,
    folder: selectedFolder.value || null,
  }

  if (!payload.title) {
    $q.notify({ type: 'warning', message: 'Titel darf nicht leer sein' })
    return
  }

  saving.value = true
  try {
    const res = await api.patch(`/documents/${props.document._id}`, payload)

    $q.notify({ type: 'positive', message: 'Dokument gespeichert' })

    emit('saved', res.data)
    open.value = false
  } catch (err) {
    console.error(err)
    $q.notify({
      type: 'negative',
      message: err?.response?.data?.error || 'Speichern fehlgeschlagen',
    })
  } finally {
    saving.value = false
  }
}
</script>
