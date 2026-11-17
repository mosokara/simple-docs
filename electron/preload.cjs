const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("simpleDocs", {
  listLibraryItems: (options) => ipcRenderer.invoke("library:list", options),
  openLibraryItem: (id) => ipcRenderer.invoke("library:open", id),
  saveLibraryItem: (input) => ipcRenderer.invoke("library:save", input),
  deleteLibraryItem: (id) => ipcRenderer.invoke("library:delete", id),
  setLibraryFavorite: (id, favorite) => ipcRenderer.invoke("library:favorite", id, favorite),
  listFolders: () => ipcRenderer.invoke("library:folders:list"),
  createFolder: (name, parentId) => ipcRenderer.invoke("library:folders:create", name, parentId),
  renameFolder: (id, name) => ipcRenderer.invoke("library:folders:rename", id, name),
  deleteFolder: (id) => ipcRenderer.invoke("library:folders:delete", id),
  openExternalUrl: (url) => ipcRenderer.invoke("shell:openExternal", url),
});
