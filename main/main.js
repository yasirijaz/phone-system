import { app, BrowserWindow, ipcMain, Menu, dialog, screen, Notification, shell, nativeImage, Tray } from 'electron';

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
let tray = null;
let currentBadgeCount = 0;
let callProgressWindow = null;
let callProgressStartedAt = null;
let callProgressInfo = { callerName: '', callerNumber: '' };
let callProgressOnHold = false;
let pendingCallInfo = null;
let isdev = false;
let updateReady = false;
let updateCheckTimer = null;
let isCheckingUpdates = false;
let lastCheckSource = null; // 'manual' | 'periodic' | 'startup' | null

const CUSTOM_PROTOCOL = 'windshieldhub-voice';

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL);
}

function extractDeepLinkFromArgv(argv = process.argv) {
  return argv.find((arg) => typeof arg === 'string' && arg.startsWith(`${CUSTOM_PROTOCOL}://`));
}

let pendingDeepLink = extractDeepLinkFromArgv();

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = extractDeepLinkFromArgv(argv);
    if (deepLink) {
      handleSlackOAuthDeepLink(deepLink);
    }
    if (Mainwindow && !Mainwindow.isDestroyed()) {
      if (Mainwindow.isMinimized()) {
        Mainwindow.restore();
      }
      Mainwindow.show();
      Mainwindow.focus();
    }
  });
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith(`${CUSTOM_PROTOCOL}://`)) {
    if (app.isReady()) {
      handleSlackOAuthDeepLink(url);
    } else {
      pendingDeepLink = url;
    }
  }
});

function handleSlackOAuthDeepLink(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'slack' || parsed.pathname !== '/oauth') {
      return;
    }

    const slack = parsed.searchParams.get('slack') || 'error';
    const message = parsed.searchParams.get('message') || undefined;
    const query = new URLSearchParams({ slack });
    if (message) {
      query.set('message', message);
    }

    if (!Mainwindow || Mainwindow.isDestroyed()) {
      return;
    }

    if (Mainwindow.isMinimized()) {
      Mainwindow.restore();
    }
    Mainwindow.show();
    Mainwindow.focus();

    const currentUrl = Mainwindow.webContents.getURL();
    const onProfile = currentUrl.includes('/profile');
    Mainwindow.webContents.send('slack-oauth-result', { slack, message });

    if (!onProfile) {
      Mainwindow.loadURL(`${getAppBaseUrl()}/profile?${query.toString()}`);
    }
  } catch (error) {
    sendToRenderer('updatelog', `Failed to handle Slack OAuth deep link: ${error}`);
  }
}

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

function updateBadgeCount(count, badgeDataUrl) {
  currentBadgeCount = count;

  if (Mainwindow && !Mainwindow.isDestroyed()) {
    if (count > 0 && badgeDataUrl) {
      try {
        const overlay = nativeImage.createFromDataURL(badgeDataUrl);
        if (!overlay.isEmpty()) {
          Mainwindow.setOverlayIcon(overlay, `${count} unread notification${count !== 1 ? 's' : ''}`);
        }
      } catch (_) {
        // Overlay rendering failed; clear stale overlay
        Mainwindow.setOverlayIcon(null, '');
      }
    } else {
      Mainwindow.setOverlayIcon(null, '');
    }
  }

  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(
      count > 0
        ? `Voice by WHUB — ${count} unread`
        : 'Voice by WHUB'
    );
  }
}

ipcMain.on('update-badge-count', (_event, payload) => {
  const count = typeof payload === 'number' ? payload : (payload?.count ?? 0);
  const dataUrl = typeof payload === 'object' ? payload?.dataUrl : undefined;
  updateBadgeCount(Math.max(0, count), dataUrl || null);
});

ipcMain.on('check-for-updates', (event) => {
  lastCheckSource = 'manual';
  sendToRenderer('updatelog','Checking for updates...');
  isCheckingUpdates = true;
  autoUpdater.checkForUpdatesAndNotify()
    .catch((e) => sendToRenderer('updatelog','Manual check error: '+ e))
    .finally(() => { isCheckingUpdates = false; });
});

function setupAutoUpdater() {
  if (!app.isPackaged) {
    sendToRenderer('updatelog','Skipping auto-update in development');
    return;
  }


  // Event hooks for visibility
  autoUpdater.on('checking-for-update', () => sendToRenderer('updatelog','Checking for updates...'));
  autoUpdater.on('update-available', (info) => sendToRenderer('updatelog','Update available:'+ info +'&&'+ info.version));
  autoUpdater.on('update-not-available', () => {
    if (lastCheckSource === 'manual') {
      sendToRenderer('updatelog','No updates available');
    }
  });
  autoUpdater.on('error', (err) => sendToRenderer('updatelog','Updater error:'+ err));
  autoUpdater.on('download-progress', (p) => {
    const pct = (p && p.percent != null) ? p.percent.toFixed(1) : 'N/A';
    sendToRenderer('updatelog',`Download progress: ${pct}%`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    if (updateCheckTimer) {
      clearInterval(updateCheckTimer);
      updateCheckTimer = null;
    }
    // Notify renderers so UI can show restart option
    sendToRenderer('update-ready', { version: info?.version });
    sendToRenderer('updatelog','Update downloaded');
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded.',
      detail: `Version ${info?.version || ''} is ready to install. Restart the application now to apply the update, or choose Later to continue and install on next restart.`,
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
  lastCheckSource = 'startup';
  autoUpdater.checkForUpdatesAndNotify().catch((e) => sendToRenderer('updatelog','checkForUpdates failed:'+ e));

  // Periodically check for updates (packaged only)
  const minutes = parseInt(process.env.APP_UPDATE_INTERVAL_MINUTES || '360', 10);
  const intervalMs = Math.max(10, isNaN(minutes) ? 360 : minutes) * 60 * 1000; // minimum 10 minutes
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = setInterval(() => {
    if (updateReady) return; // stop once update is downloaded
    if (isCheckingUpdates) return;
    isCheckingUpdates = true;
    // sendToRenderer('updatelog','Periodic update check...');
    lastCheckSource = 'periodic';
    autoUpdater.checkForUpdatesAndNotify()
      .catch((e) => sendToRenderer('updatelog','Periodic check failed: '+ e))
      .finally(() => { isCheckingUpdates = false; });
  }, intervalMs);
}

const appServe = app.isPackaged ? serve({
  directory: path.join(__dirname, "../out")
}) : null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    }
  });

  if (app.isPackaged) {
    win.loadURL("https://phone.windshieldhub.com");
  } else {
    win.loadURL("http://localhost:3000");
    // win.loadURL("http://127.0.0.1:3000");
    win.webContents.openDevTools();
    win.webContents.on("did-fail-load", (e, code, desc) => {
      win.webContents.reloadIgnoringCache();
    });
  }
  Mainwindow = win;

  const refreshBackgroundOverlays = () => {
    if (pendingCallInfo) {
      syncIncomingOverlayWindow(pendingCallInfo);
      return;
    }
    if (callProgressStartedAt) {
      showCallProgressWindow({
        ...callProgressInfo,
        startedAt: callProgressStartedAt,
      });
    }
  };

  win.on('minimize', () => {
    refreshBackgroundOverlays();
  });

  win.on('blur', () => {
    refreshBackgroundOverlays();
  });

  const hideOverlay = () => {
    hideNotificationWindow();
  };
  win.on('restore', hideOverlay);
  win.on('show', hideOverlay);
  win.on('focus', hideOverlay);
}

function createAppMenu() {
  const template = [
    // {
    //   label: 'About',
    //   submenu: [
    //     {
    //       label: 'Check Version',
    //       click: () => {
    //         const version = app.getVersion();
    //         dialog.showMessageBox({
    //           type: 'info',
    //           title: 'App Version',
    //           message: `Version: ${version}`,
    //           buttons: ['OK']
    //         });
    //       },
    //     },
    //     {
    //       label: 'Check for Updates',
    //       click: () => {
    //         try {
    //           // Trigger a manual update check
    //           autoUpdater.checkForUpdatesAndNotify();
    //           sendToRenderer('updatelog','Checking for updates...');
    //         } catch (e) {
    //           dialog.showErrorBox('Update Error', String(e));
    //         }
    //       },
    //     },
    //   ],
    // },
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

function createTray() {
  const trayIconPath = path.join(__dirname, '..', 'public', 'mini-log.ico');
  const fallbackPath = path.join(__dirname, '..', 'public', 'logo.ico');
  let icon;
  try {
    icon = nativeImage.createFromPath(trayIconPath);
    if (icon.isEmpty()) icon = nativeImage.createFromPath(fallbackPath);
  } catch (_) {
    try { icon = nativeImage.createFromPath(fallbackPath); } catch (__) { return; }
  }
  if (!icon || icon.isEmpty()) return;

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Voice by WHUB');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Voice by WHUB',
      click: () => {
        if (Mainwindow && !Mainwindow.isDestroyed()) {
          if (Mainwindow.isMinimized()) Mainwindow.restore();
          Mainwindow.show();
          Mainwindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (Mainwindow && !Mainwindow.isDestroyed()) {
      if (Mainwindow.isMinimized()) Mainwindow.restore();
      Mainwindow.show();
      Mainwindow.focus();
    }
  });
}

app.on("ready", () => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.windshieldhub.voice');
    }
    createWindow();
    createTray();
    createAppMenu();
    setupAutoUpdater();
    if (pendingDeepLink) {
      const deepLink = pendingDeepLink;
      pendingDeepLink = null;
      const focusSlackOAuth = () => handleSlackOAuthDeepLink(deepLink);
      if (Mainwindow && !Mainwindow.isDestroyed()) {
        if (Mainwindow.webContents.isLoading()) {
          Mainwindow.webContents.once('did-finish-load', focusSlackOAuth);
        } else {
          focusSlackOAuth();
        }
      }
    }
    // optional: after a short delay, broadcast initial app info
    setTimeout(() => {
      sendToRenderer('app-info', { version: app.getVersion(), updateReady });
    }, 1000);
});

app.on('before-quit', () => {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
  destroyCallProgressWindow();
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
});

function isMainWindowForeground() {
  if (!Mainwindow || Mainwindow.isDestroyed()) return false;
  return !Mainwindow.isMinimized() && Mainwindow.isFocused();
}

function shouldShowIncomingOverlay() {
  if (!Mainwindow || Mainwindow.isDestroyed()) return false;
  return !isMainWindowForeground();
}

function buildIncomingCallUrl(callInfo = {}) {
  const params = new URLSearchParams({
    from: callInfo.from || '',
    callerName: callInfo.callerName || '',
  });

  if (callInfo.activeCall) {
    params.set('activeCallerName', callInfo.activeCall.callerName || 'On Call');
    params.set('activeCallerNumber', callInfo.activeCall.callerNumber || '');
    if (callInfo.activeCall.startedAt) {
      params.set('activeStartedAt', String(callInfo.activeCall.startedAt));
    }
  }

  return `${getAppBaseUrl()}/incoming-call-notification?${params}`;
}

function getIncomingOverlayBounds(hasActiveCall = false) {
  const workArea = screen.getPrimaryDisplay().workArea;
  const windowWidth = 420;
  const windowHeight = hasActiveCall ? 240 : 190;
  const margin = 16;
  return {
    width: windowWidth,
    height: windowHeight,
    x: workArea.x + workArea.width - windowWidth - margin,
    y: workArea.y + margin,
  };
}

function syncIncomingOverlayWindow(callInfo) {
  pendingCallInfo = callInfo || null;
  if (!pendingCallInfo) {
    destroyNotificationWindow(false);
    return;
  }

  const hasActiveCall = Boolean(callInfo.activeCall && callProgressStartedAt);
  const bounds = getIncomingOverlayBounds(hasActiveCall);
  const url = buildIncomingCallUrl(callInfo);

  if (hasActiveCall && callProgressWindow && !callProgressWindow.isDestroyed()) {
    callProgressWindow.hide();
  }

  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.setBounds(bounds);
    notificationWindow.webContents.send('incoming-call-update', {
      from: callInfo.from,
      callerName: callInfo.callerName,
      activeCall: callInfo.activeCall || null,
    });
    if (!notificationWindow.isVisible()) {
      notificationWindow.show();
    }
    return;
  }

  notificationWindow = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    }
  });

  notificationWindow.loadURL(url);
  notificationWindow.once('ready-to-show', () => {
    if (notificationWindow && !notificationWindow.isDestroyed()) {
      notificationWindow.show();
    }
  });
  notificationWindow.on('closed', () => {
    notificationWindow = null;
  });
}

function hideNotificationWindow() {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
  }
  notificationWindow = null;

  if (!pendingCallInfo && callProgressStartedAt) {
    showCallProgressWindow({
      ...callProgressInfo,
      startedAt: callProgressStartedAt,
    });
  }
}

function destroyNotificationWindow(restoreCallProgress = true, clearPending = true) {
  if (notificationWindow && !notificationWindow.isDestroyed()) {
    notificationWindow.close();
  }
  notificationWindow = null;
  if (clearPending) {
    pendingCallInfo = null;
  }

  if (restoreCallProgress && callProgressStartedAt) {
    showCallProgressWindow({
      ...callProgressInfo,
      startedAt: callProgressStartedAt,
    });
  }
}

function getAppBaseUrl() {
  return app.isPackaged
    ? 'https://phone.windshieldhub.com'
    : 'http://localhost:3000';
}

function destroyCallProgressWindow(resetSession = true) {
  if (callProgressWindow && !callProgressWindow.isDestroyed()) {
    callProgressWindow.close();
  }
  callProgressWindow = null;
  if (resetSession) {
    callProgressStartedAt = null;
    callProgressInfo = { callerName: '', callerNumber: '' };
    callProgressOnHold = false;
  }
}

function getCallProgressBounds() {
  const workArea = screen.getPrimaryDisplay().workArea;
  const windowWidth = 440;
  const windowHeight = 72;
  const margin = 16;
  return {
    width: windowWidth,
    height: windowHeight,
    x: workArea.x + workArea.width - windowWidth - margin,
    y: workArea.y + margin,
  };
}

function showCallProgressWindow(callInfo = {}) {
  const { callerName = '', callerNumber = '', startedAt, isOnHold } = callInfo;
  const effectiveStartedAt = startedAt || callProgressStartedAt;
  if (!effectiveStartedAt) return;

  callProgressStartedAt = effectiveStartedAt;
  if (callerName || callerNumber) {
    callProgressInfo = {
      callerName: callerName || callProgressInfo.callerName,
      callerNumber: callerNumber || callProgressInfo.callerNumber,
    };
  }
  if (typeof isOnHold === 'boolean') {
    callProgressOnHold = isOnHold;
  }

  if (pendingCallInfo) {
    syncIncomingOverlayWindow({
      ...pendingCallInfo,
      activeCall: {
        callerName: callProgressInfo.callerName,
        callerNumber: callProgressInfo.callerNumber,
        startedAt: effectiveStartedAt,
      },
    });
    return;
  }

  if (callProgressWindow && !callProgressWindow.isDestroyed()) {
    callProgressWindow.setBounds(getCallProgressBounds());
    callProgressWindow.webContents.send('call-progress-update', {
      callerName: callProgressInfo.callerName,
      callerNumber: callProgressInfo.callerNumber,
      startedAt: effectiveStartedAt,
      isOnHold: callProgressOnHold,
    });
    if (!callProgressWindow.isVisible()) {
      callProgressWindow.show();
    }
    return;
  }

  callProgressWindow = new BrowserWindow({
    ...getCallProgressBounds(),
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    }
  });

  const params = new URLSearchParams({
    callerName,
    callerNumber,
    startedAt: String(effectiveStartedAt),
  });

  callProgressWindow.loadURL(`${getAppBaseUrl()}/call-progress-bar?${params}`);
  callProgressWindow.once('ready-to-show', () => {
    if (callProgressWindow && !callProgressWindow.isDestroyed()) {
      callProgressWindow.show();
    }
  });
  callProgressWindow.on('closed', () => {
    callProgressWindow = null;
  });
}

function formatPhoneForNotification(value) {
  if (!value) return 'Unknown';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return String(value);
}

function formatSmsSenderLabel(sms = {}) {
  const from = sms.from || 'Unknown';
  const formattedNumber = formatPhoneForNotification(from);
  const contactName = typeof sms.contact_name === 'string' ? sms.contact_name.trim() : '';

  if (contactName) {
    return `${contactName} (${formattedNumber})`;
  }

  return formattedNumber;
}

function showSmsNotification(sms = {}) {
  if (!Notification.isSupported()) return;
  if (!Mainwindow || Mainwindow.isDestroyed()) return;

  const hasMedia = Boolean(sms?.meta_data?.num_media || sms?.meta_data?.media_urls?.length);
  const senderLabel = formatSmsSenderLabel(sms);
  const title = hasMedia ? `New MMS from ${senderLabel}` : `New message from ${senderLabel}`;
  const body = sms.body || (hasMedia ? 'Media attachment' : 'New message received');

  const notification = new Notification({
    title,
    body: String(body).slice(0, 240),
    silent: false,
  });

  notification.on('click', () => {
    if (!Mainwindow || Mainwindow.isDestroyed()) return;
    if (Mainwindow.isMinimized()) {
      Mainwindow.restore();
    }
    Mainwindow.show();
    Mainwindow.focus();
    if (sms.from && sms.to) {
      Mainwindow.webContents.send('open-sms-conversation', {
        from: sms.from,
        to: sms.to,
      });
    }
  });

  notification.show();
}

ipcMain.on('incoming-sms', (_event, sms) => {
  showSmsNotification(sms || {});
});

ipcMain.on('incoming-call', (_event, callInfo) => {
  const payload = callInfo || null;
  pendingCallInfo = payload;
  if (shouldShowIncomingOverlay()) {
    syncIncomingOverlayWindow(payload);
  } else {
    hideNotificationWindow();
  }
});

ipcMain.on('accept-call', () => {
  destroyNotificationWindow(false);
  pendingCallInfo = null;
  if (Mainwindow) {
    Mainwindow.webContents.send('call-accepted');
  }
});

ipcMain.on('accept-call-hold', () => {
  destroyNotificationWindow(false);
  pendingCallInfo = null;
  if (Mainwindow) {
    Mainwindow.webContents.send('accept-call-hold');
  }
});

ipcMain.on('accept-call-end-current', () => {
  destroyNotificationWindow(false);
  pendingCallInfo = null;
  if (Mainwindow) {
    Mainwindow.webContents.send('accept-call-end-current');
  }
});

ipcMain.on('accept-call-merge', () => {
  destroyNotificationWindow(false);
  pendingCallInfo = null;
  if (Mainwindow) {
    Mainwindow.webContents.send('accept-call-merge');
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
  destroyNotificationWindow(false);
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

ipcMain.on('show-call-progress', (_event, callInfo) => {
  showCallProgressWindow(callInfo || {});
});

ipcMain.on('hide-call-progress', () => {
  // Full reset — keeping startedAt made the pill resurrect after hangup
  // (notification dismiss / restore paths reuse callProgressStartedAt).
  destroyCallProgressWindow(true);
});

ipcMain.on('focus-main-window', () => {
  if (Mainwindow && !Mainwindow.isDestroyed()) {
    if (Mainwindow.isMinimized()) {
      Mainwindow.restore();
    }
    Mainwindow.show();
    Mainwindow.focus();
  }
});

ipcMain.on('end-call-from-progress', () => {
  // Drop the widget immediately; don't wait for renderer React state to catch up.
  destroyCallProgressWindow(true);
  if (Mainwindow && !Mainwindow.isDestroyed()) {
    Mainwindow.webContents.send('end-call-from-progress');
  }
});

ipcMain.on('hold-call-from-progress', () => {
  if (Mainwindow && !Mainwindow.isDestroyed()) {
    Mainwindow.webContents.send('hold-call-from-progress');
  }
});

ipcMain.on('restore-active-call-ui', () => {
  if (Mainwindow && !Mainwindow.isDestroyed()) {
    if (Mainwindow.isMinimized()) {
      Mainwindow.restore();
    }
    Mainwindow.show();
    Mainwindow.focus();
    Mainwindow.webContents.send('restore-active-call-ui');
  }
});

ipcMain.on('open-external-url', (_event, payload) => {
  const url = payload?.url;
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    shell.openExternal(url).catch((error) => {
      sendToRenderer('updatelog', `Failed to open external URL: ${error}`);
    });
  }
});
