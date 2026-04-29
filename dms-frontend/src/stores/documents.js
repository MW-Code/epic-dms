// Verwaltet Dokumentliste, aktuelle Auswahl und Datei-Downloads
import { defineStore } from 'pinia'
import { api } from 'src/boot/axios'

export const useDocumentStore = defineStore('documents', {
  state: () => ({
    items: [], // Dokumentliste für Sidebar und Übersichten
    loadingList: false,

    selectedId: null,
    selected: null, // Detail-Daten des selektierten Dokuments

    fileUrl: null, // Blob-URL für Viewer/Download
    loadingFile: false,

    downloading: false,
    uploading: false,
    addingNote: false,
  }),

  getters: {
    documents(state) {
      return state.items
    },
    selectedDocument(state) {
      return state.selected
    },
    isPdf(state) {
      return state.selected?.mimeType === 'application/pdf'
    },
    viewerUrl(state) {
      if (!state.fileUrl) return null
      return state.isPdf
        ? state.fileUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'
        : state.fileUrl
    },
  },

  actions: {
    async fetchList(query, folder) {
      this.loadingList = true
      try {
        const params = {}
        if (query && query.trim()) {
          params.q = query.trim()
        }
        if (folder && folder.trim()) {
          params.folder = folder.trim()
        }

        const res = await api.get('/documents', { params })
        this.items = res.data.items || []

        if (!this.selectedId && this.items.length) {
          await this.select(this.items[0]._id)
        }
      } finally {
        this.loadingList = false
      }
    },

    async loadDetails(id) {
      if (!id) return
      const res = await api.get(`/documents/${id}`)
      this.selected = res.data
    },

    async loadFile(id) {
      if (!id) return

      if (this.fileUrl) {
        URL.revokeObjectURL(this.fileUrl)
        this.fileUrl = null
      }

      this.loadingFile = true
      try {
        const res = await api.get(`/documents/${id}/file`, {
          responseType: 'blob',
        })
        this.fileUrl = URL.createObjectURL(res.data)
      } finally {
        this.loadingFile = false
      }
    },

    async select(docOrId) {
      const id = typeof docOrId === 'string' ? docOrId : docOrId?._id
      if (!id || id === this.selectedId) return

      this.selectedId = id
      await Promise.all([this.loadDetails(id), this.loadFile(id)])
    },

    async deleteSelected() {
      if (!this.selectedId || !this.selected) return
      await api.delete(`/documents/${this.selectedId}`)

      // Entferne selektiertes Dokument aus der Liste und räume lokale States auf
      this.items = this.items.filter((d) => d._id !== this.selectedId)
      this.selectedId = null
      this.selected = null

      if (this.fileUrl) {
        URL.revokeObjectURL(this.fileUrl)
        this.fileUrl = null
      }
    },

    async downloadSelected() {
      if (!this.selectedId || !this.selected) return

      this.downloading = true
      try {
        const res = await api.get(`/documents/${this.selectedId}/file`, {
          responseType: 'blob',
        })

        const url = URL.createObjectURL(res.data)
        const a = document.createElement('a')
        a.href = url
        a.download = this.selected.originalFileName || `${this.selected.title || 'document'}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } finally {
        this.downloading = false
      }
    },

    async checkinSelected(file) {
      if (!this.selected) return
      this.uploading = true
      try {
        const formData = new FormData()
        formData.append('file', file)

        await api.post(`/documents/${this.selected._id}/checkin`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        // Nach dem neuen Upload alles aktualisieren
        await this.loadDetails(this.selected._id)
        await this.fetchList()
        await this.loadFile(this.selected._id)
      } finally {
        this.uploading = false
      }
    },

    async saveNotes(text) {
      if (!this.selected) return
      this.addingNote = true
      try {
        const res = await api.post(`/documents/${this.selected._id}/notes`, {
          text: text || '',
        })

        // Backend liefert aktuell notesText (ggf. auf gesamte Doc-Struktur anpassbar)
        this.selected = {
          ...this.selected,
          ...res.data,
        }
      } finally {
        this.addingNote = false
      }
    },

    applyUpdatedDoc(updatedDoc) {
      if (!updatedDoc?._id) return

      this.selected = updatedDoc

      const idx = this.items.findIndex((d) => d._id === updatedDoc._id)
      if (idx !== -1) {
        this.items[idx] = {
          ...this.items[idx],
          title: updatedDoc.title,
          labels: updatedDoc.labels,
          folder: updatedDoc.folder,
        }
      }
    },
  },
})
