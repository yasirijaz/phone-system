import { app, BrowserWindow, ipcMain, Menu, dialog, screen } from 'electron';

// const serve = 'electron-serve';
import serve from 'electron-serve';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';

// __dirname is not defined in ES modules; recreate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safely load CommonJS modules from ESM
const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');
let Mainwindow
let notificationWindow;
let pendingCallInfo = null;
let isdev = false;
let updateReady = false;
// Load environment variables early (supports dev via root .env)
// Try project root .env relative to this file; fall back to default resolution
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();


// Simple logger wrapper (avoid extra deps) and broadcast to renderer
function sendToRenderer(name,args) {
    console.log('[auto-updater]', args);
    try {
      const wins = BrowserWindow.getAllWindows();
      for (const w of wins) {
        w.webContents.send(name, args);
      }
    } catch (_) {
      // no-op if windows not ready
      console.log('hereee')
    }
}

ipcMain.on('check-for-updates', (event) => {
  autoUpdater.checkForUpdatesAndNotify();
  sendToRenderer('updatelog','Checking for updates...');
});

function setupAutoUpdater() {
  if (!app.isPackaged) {
    sendToRenderer('updatelog','Skipping auto-update in development');
    return;
  }


  // Event hooks for visibility
  autoUpdater.on('checking-for-update', () => sendToRenderer('updatelog','Checking for updates...'));
  autoUpdater.on('update-available', (info) => sendToRenderer('updatelog','Update available:'+ info +'&&'+ info.version));
  autoUpdater.on('update-not-available', () => sendToRenderer('updatelog','No updates available'));
  autoUpdater.on('error', (err) => sendToRenderer('updatelog','Updater error:'+ err));
  autoUpdater.on('download-progress', (p) => {
    const pct = (p && p.percent != null) ? p.percent.toFixed(1) : 'N/A';
    sendToRenderer('updatelog',`Download progress: ${pct}%`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    // Notify renderers so UI can show restart option
    sendToRenderer('update-ready', { version: info?.version });
    sendToRenderer('updatelog','Update downloaded');
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded.',
      detail: `Version ${info?.version || ''} is ready to install. Restart now to apply the update, or choose Later to continue and install on next restart.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    }).then(({ response }) => {
      if (response === 0) {
        sendToRenderer('updatelog','User chose to restart now; installing update...');
        // Install on next tick to avoid blocking the event loop
        setImmediate(() => autoUpdater.quitAndInstall());
      } else {
        sendToRenderer('updatelog','User chose to install later');
        // With autoInstallOnAppQuit=true, the update will install when the app quits
      }
    }).catch((e) => {
      sendToRenderer('updatelog','Failed to show update dialog: '+ e);
      // Fallback: do not auto-install if dialog fails; user can quit later
    });
  });

  // Start the update flow
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = Boolean(process.env.APP_ALLOW_PRERELEASE);

  // Use notify helper to show native notification (when supported)
  autoUpdater.checkForUpdatesAndNotify().catch((e) => sendToRenderer('updatelog','checkForUpdates failed:'+ e));
}

const appServe = app.isPackaged ? serve({
  directory: path.join(__dirname, "../out")
}) : null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (app.isPackaged) {
    win.loadURL("https://phone.windshieldhub.com");
  } else {
    win.loadURL("http://localhost:3001");
    // win.loadURL("http://127.0.0.1:3000");
    win.webContents.openDevTools();
    win.webContents.on("did-fail-load", (e, code, desc) => {
      win.webContents.reloadIgnoringCache();
    });
  }
  Mainwindow = win;
  // If a call is pending, show overlay only while minimized
  win.on('minimize', () => {
    console.log('minimuze',pendingCallInfo);
    if (pendingCallInfo) {
      // Recreate minimized overlay using the existing route
      destroyNotificationWindow();
      notificationWindow = new BrowserWindow({
        width: 300,
        height: 300,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
          preload: path.join(__dirname, "preload.js"),
          nodeIntegration: false,
          contextIsolation: true,
        }
      });
      const url = app.isPackaged
        ? `https://phone.windshieldhub.com/incoming-call-notification?from=${encodeURIComponent(pendingCallInfo.from || '')}&callerName=${encodeURIComponent(pendingCallInfo.callerName || '')}`
        : `http://localhost:3000/incoming-call-notification?from=${encodeURIComponent(pendingCallInfo.from || '')}&callerName=${encodeURIComponent(pendingCallInfo.callerName || '')}`;
      notificationWindow.loadURL(url);
    }
  });
  const hideOverlay = () => {
    destroyNotificationWindow();
  };
  win.on('restore', hideOverlay);
  win.on('show', hideOverlay);
  win.on('focus', hideOverlay);
}

function createAppMenu() {
  const template = [
    {
      label: 'About',
      submenu: [
        {
          label: 'Check Version',
          click: () => {
            const version = app.getVersion();
            dialog.showMessageBox({
              type: 'info',
              title: 'App Version',
              message: `Version: ${version}`,
              buttons: ['OK']
            });
          },
        },
        {
          label: 'Check for Updates',
          click: () => {
            try {
              // Trigger a manual update check
              autoUpdater.checkForUpdatesAndNotify();
              sendToRenderer('updatelog','Checking for updates...');
            } catch (e) {
              dialog.showErrorBox('Update Error', String(e));
            }
          },
        },
      ],
    },
  ];

  // In development, add a Debug menu with DevTools and Reload
  if (isdev) {
    template.push({
      label: 'Debug',
      submenu: [
        {
          label: 'Open DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.openDevTools({ mode: 'detach' });
          },
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.reloadIgnoringCache();
          },
        },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on("ready", () => {
    createWindow();
    createAppMenu();
    setupAutoUpdater();
    // optional: after a short delay, broadcast initial app info
    setTimeout(() => {
      sendToRenderer('app-info', { version: app.getVersion(), updateReady });
    }, 1000);
});




function destroyNotificationWindow() {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
  }
  notificationWindow = null;
}

ipcMain.on('incoming-sms', (event, sms) => {
  pendingCallInfo = callInfo || null;
  Mainwindow.show();
  Mainwindow.focus();
});

ipcMain.on('incoming-call', (event, callInfo) => {
  pendingCallInfo = callInfo || null;
  if (Mainwindow && Mainwindow.isMinimized()) {
    destroyNotificationWindow();
    notificationWindow = new BrowserWindow({
      width: 300,
      height: 300,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
      }
    });

    const url = app.isPackaged
      ? `https://phone.windshieldhub.com/incoming-call-notification?from=${encodeURIComponent(callInfo.from)}&callerName=${encodeURIComponent(callInfo.callerName)}`
      : `http://localhost:3000/incoming-call-notification?from=${encodeURIComponent(callInfo.from)}&callerName=${encodeURIComponent(callInfo.callerName)}`;

    notificationWindow.loadURL(url);
  } else {
    // main window is visible/focused; ensure overlay is not shown
    destroyNotificationWindow();
  }
});

ipcMain.on('accept-call', () => {
  destroyNotificationWindow();
  pendingCallInfo = null;
  if (Mainwindow) {
    Mainwindow.webContents.send('call-accepted');
  }
});

// Expose version and update status to renderer
ipcMain.handle('get-app-info', async () => {
  try {
    return { version: app.getVersion(), updateReady };
  } catch (_) {
    return { version: 'unknown', updateReady };
  }
});

// Allow renderer to trigger restart to install update
ipcMain.on('restart-to-update', () => {
  if (updateReady) {
    sendToRenderer('updatelog','Renderer requested restart to install update');
    setImmediate(() => autoUpdater.quitAndInstall());
  }
});

ipcMain.on('reject-call', () => {
  destroyNotificationWindow();
  pendingCallInfo = null;
  if (Mainwindow) {
    Mainwindow.webContents.send('call-rejected');
  }
});

ipcMain.on('successfully-accepted-call', () => {
  console.log('successfully',pendingCallInfo);
  Mainwindow.show();
  Mainwindow.focus();
  destroyNotificationWindow();
  pendingCallInfo = null;
});
ipcMain.on('successfully-rejected-call', () => {
  console.log('rejected',pendingCallInfo);
  destroyNotificationWindow();
  pendingCallInfo = null;
});

// Renderer can request overlay dismissal when reservation clears
ipcMain.on('dismiss-incoming-overlay', () => {
  destroyNotificationWindow();
  pendingCallInfo = null;
});
