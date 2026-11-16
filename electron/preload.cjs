const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("palaceAI", {
  status: () => ipcRenderer.invoke("ai:status"),
  models: () => ipcRenderer.invoke("ai:models"),
  open: (name) => ipcRenderer.invoke("ai:open", name),
  save: (settings) => ipcRenderer.invoke("ai:save", settings),
  remove: () => ipcRenderer.invoke("ai:remove"),
  test: () => ipcRenderer.invoke("ai:test"),
  estimate: (pages) => ipcRenderer.invoke("ai:estimate", pages),
  analyze: (request) => ipcRenderer.invoke("ai:analyze", request),
  cancel: () => ipcRenderer.invoke("ai:cancel"),
  onProgress: (callback) => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on("ai:progress", listener);
    return () => ipcRenderer.removeListener("ai:progress", listener);
  },
});
