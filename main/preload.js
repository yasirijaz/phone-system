const { contextBridge, ipcRenderer } = require("electron");

const electronSendChannels = [
  'incoming-sms',
  'incoming-call',
  'accept-call',
  'accept-call-hold',
  'accept-call-end-current',
  'accept-call-merge',
  'reject-call',
  'check-for-updates',
  'successfully-accepted-call',
  'successfully-rejected-call',
  'dismiss-incoming-overlay',
  'show-call-progress',
  'hide-call-progress',
  'focus-main-window',
  'end-call-from-progress',
];

const electronReceiveChannels = [
  'call-accepted',
  'accept-call-hold',
  'accept-call-end-current',
  'accept-call-merge',
  'call-rejected',
  'call-progress-update',
  'incoming-call-update',
  'end-call-from-progress',
];

const apiSendChannels = ['check-for-updates', 'restart-to-update'];
const apiReceiveChannels = ['updatelog', 'update-ready', 'app-info'];

contextBridge.exposeInMainWorld("electronAPI", {
    on: (channel, callback) => {
        if (!electronReceiveChannels.includes(channel)) {
            return () => {};
        }
        const newCallback = (_, ...args) => callback(...args);
        ipcRenderer.on(channel, newCallback);
        return () => {
            ipcRenderer.removeListener(channel, newCallback);
        };
    },
    send: (channel, args) => {
        if (electronSendChannels.includes(channel)) {
            ipcRenderer.send(channel, args);
        }
    }
});

contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      if (apiSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      if (apiReceiveChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    remove:  (channel) => {
      if (apiReceiveChannels.includes(channel) || electronReceiveChannels.includes(channel)) {
        ipcRenderer.removeAllListeners(channel);
      }
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
