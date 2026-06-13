const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("swingScannerDesktop", {
  isDesktop: true,
  getUpdateState: () => ipcRenderer.invoke("updates:get-state"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  installUpdateFromFile: () => ipcRenderer.invoke("updates:install-from-file"),
  restartToUpdate: () => ipcRenderer.send("restart-to-install-update"),
  onUpdateState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("updates:state", handler);
    return () => ipcRenderer.removeListener("updates:state", handler);
  },
});
