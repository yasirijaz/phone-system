const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    on: (channel, callback) => {
        const newCallback = (_, ...args) => callback(...args);
        ipcRenderer.on(channel, newCallback);
        return () => {
            ipcRenderer.removeListener(channel, newCallback);
        };
    },
    send: (channel, args) => {
        ipcRenderer.send(channel, args);
    }
});

contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // whitelist channels
      let validChannels = ['navigate','check-for-updates','restart-to-update'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      let validChannels = ['request-data-from-renderer','log','updatelog','update-ready','app-info'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    remove:  (channel) => {
      ipcRenderer.removeAllListeners(channel);
    },
    // helpers
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    onUpdateReady: (callback) => {
      const cb = (_evt, ...args) => callback(...args);
      ipcRenderer.on('update-ready', cb);
      return () => ipcRenderer.removeListener('update-ready', cb);
    },
    restartToUpdate: () => ipcRenderer.send('restart-to-update')
  }
);
