import { app, BrowserWindow, Menu, dialog } from 'electron';

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
// Load environment variables early (supports dev via root .env)
// Try project root .env relative to this file; fall back to default resolution
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

// Simple logger wrapper (avoid extra deps) and broadcast to renderer
function logs(args) {
    console.log('[auto-updater]', args);
    try {
      // Broadcast to all r
      // 
      console.log('hereee22');
      Mainwindow.webContents.send('log:info', args);
      const wins = BrowserWindow.getAllWindows();
      for (const w of wins) {
        w.webContents.send('log:info', ...args);
      }
    } catch (_) {
      // no-op if windows not ready
      console.log('hereee')
    }
}
 const s3Bucket = process.env.UPDATE_S3_BUCKET;
 console.log('asdasdasd',s3Bucket);
function setupAutoUpdater() {
  if (!app.isPackaged) {
    logs('Skipping auto-update in development');
    return;
  }

  // Prefer S3 public bucket if provided via env
  // Required: UPDATE_S3_BUCKET; Optional: UPDATE_S3_REGION, UPDATE_S3_ENDPOINT, UPDATE_S3_PREFIX, UPDATE_CHANNEL
  const s3Bucket = process.env.UPDATE_S3_BUCKET;
  const s3Region = process.env.UPDATE_S3_REGION || 'us-east-1';
  const s3Endpoint = process.env.UPDATE_S3_ENDPOINT || undefined; // e.g. https://s3.amazonaws.com or custom domain
  const s3Path = process.env.UPDATE_S3_PREFIX || undefined; // optional folder prefix within the bucket
  const s3Channel = process.env.UPDATE_CHANNEL || 'latest';
 
  if (s3Bucket) {
    try {
      autoUpdater.setFeedURL({
        provider: 's3',
        bucket: s3Bucket,
        region: s3Region,
        endpoint: s3Endpoint,
        path: s3Path,
        channel: s3Channel,
      });
      logs('Using S3 update feed:', `bucket=${s3Bucket}`, `region=${s3Region}`, s3Path ? `path=${s3Path}` : 'path=<root>', `channel=${s3Channel}`);
    } catch (e) {
      logs('Failed setting S3 feed:', e);
    }
  } else {
    // Fallback: allow a generic static URL (e.g., S3 static website or CDN) via UPDATE_FEED_URL
    // Example: UPDATE_FEED_URL=https://my-bucket.s3.amazonaws.com/updates
    const customFeed = process.env.UPDATE_FEED_URL;
    if (customFeed) {
      try {
        autoUpdater.setFeedURL({ provider: 'generic', url: customFeed, channel: s3Channel });
        logs('Using custom update feed URL:', customFeed);
      } catch (e) {
        logs('Failed setting custom feed URL:', e);
      }
    }
  }

  // Recommended: publish config for S3 is embedded by electron-builder at build time
  // via package.json > build.publish. When present, no need to setFeedURL at runtime.

  // Event hooks for visibility
  autoUpdater.on('checking-for-update', () => logs('Checking for updates...'));
  autoUpdater.on('update-available', (info) => logs('Update available:', info && info.version));
  autoUpdater.on('update-not-available', () => logs('No updates available'));
  autoUpdater.on('error', (err) => logs('Updater error:', err));
  autoUpdater.on('download-progress', (p) => {
    const pct = (p && p.percent != null) ? p.percent.toFixed(1) : 'N/A';
    logs(`Download progress: ${pct}%`);
  });
  autoUpdater.on('update-downloaded', () => {
    logs('Update downloaded; quitting and installing...');
    // Install on next tick to avoid blocking the event loop
    setImmediate(() => autoUpdater.quitAndInstall());
  });

  // Start the update flow
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = Boolean(process.env.APP_ALLOW_PRERELEASE);

  // Use notify helper to show native notification (when supported)
  autoUpdater.checkForUpdatesAndNotify().catch((e) => logs('checkForUpdates failed:', e));
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
    win.loadURL("http://localhost:3000");
    // win.loadURL("http://127.0.0.1:3000");
    win.webContents.openDevTools();
    win.webContents.on("did-fail-load", (e, code, desc) => {
      win.webContents.reloadIgnoringCache();
    });
  }
  Mainwindow = win;
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
              logs('Checking for updates...');
            } catch (e) {
              dialog.showErrorBox('Update Error', String(e));
            }
          },
        },
      ],
    },
  ];

  // In development, add a Debug menu with DevTools and Reload
  if (!app.isPackaged) {
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
});

app.on("window-all-closed", () => {
    if(process.platform !== "darwin"){
        app.quit();
    }
});
