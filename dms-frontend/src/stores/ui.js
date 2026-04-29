import { defineStore, acceptHMRUpdate } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    uploadDialogOpen: false,
    searchQuery: '',
  }),
  getters: {},
  actions: {
    openUploadDialog() {
      this.uploadDialogOpen = true
    },
    closeUploadDialog() {
      this.uploadDialogOpen = false
    },
    setSearchQuery(val) {
      this.searchQuery = val || ''
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUiStore, import.meta.hot))
}
