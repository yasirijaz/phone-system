const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    on: (channel, callback) => {
        ipcRenderer.on(channel, callback);
    },
    send: (channel, args) => {
        ipcRenderer.send(channel, args);
    }
});

contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // whitelist channels
      let validChannels = ['navigate'];
      if (validChannels.includes(channel)) {
      }
      ipcRenderer.send(channel, data);
    },
    receive: (channel, func) => {
      let validChannels = ['request-data-from-renderer','log','updatelog'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    remove:  (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
);