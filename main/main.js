import { app, BrowserWindow } from 'electron';

// const serve = 'electron-serve';
import serve from 'electron-serve';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// __dirname is not defined in ES modules; recreate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safely load CommonJS modules from ESM
const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');

// Simple logger wrapper (avoid extra deps)
const log = {
  info: (...args) => console.log('[auto-updater]', ...args),
  error: (...args) => console.error('[auto-updater]', ...args),
};

function setupAutoUpdater() {
  if (!app.isPackaged) {
    log.info('Skipping auto-update in development');
    return;
  }

  // Optional: allow setting a custom feed at runtime (e.g., S3 static host URL)
  // Example: UPDATE_FEED_URL=https://my-bucket.s3.amazonaws.com/updates/latest
  const customFeed = process.env.UPDATE_FEED_URL;
  if (customFeed) {
    try {
      // Use generic provider that points at an S3/static website URL with release assets
      autoUpdater.setFeedURL({ provider: 'generic', url: customFeed });
      log.info('Using custom update feed URL:', customFeed);
    } catch (e) {
      log.error('Failed setting custom feed URL:', e);
    }
  }

  // Recommended: publish config for S3 is embedded by electron-builder at build time
  // via package.json > build.publish. When present, no need to setFeedURL at runtime.

  // Event hooks for visibility
  autoUpdater.on('checking-for-update', () => log.info('Checking for updates...'));
  autoUpdater.on('update-available', (info) => log.info('Update available:', info && info.version));
  autoUpdater.on('update-not-available', () => log.info('No updates available'));
  autoUpdater.on('error', (err) => log.error('Updater error:', err));
  autoUpdater.on('download-progress', (p) => {
    const pct = (p && p.percent != null) ? p.percent.toFixed(1) : 'N/A';
    log.info(`Download progress: ${pct}%`);
  });
  autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded; quitting and installing...');
    // Install on next tick to avoid blocking the event loop
    setImmediate(() => autoUpdater.quitAndInstall());
  });

  // Start the update flow
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = Boolean(process.env.APP_ALLOW_PRERELEASE);

  // Use notify helper to show native notification (when supported)
  autoUpdater.checkForUpdatesAndNotify().catch((e) => log.error('checkForUpdates failed:', e));
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
    win.loadURL("https://phone.windshieldhub.com");
    win.webContents.openDevTools();
    win.webContents.on("did-fail-load", (e, code, desc) => {
      win.webContents.reloadIgnoringCache();
    });
  }
}

app.on("ready", () => {
    createWindow();
    setupAutoUpdater();
});

app.on("window-all-closed", () => {
    if(process.platform !== "darwin"){
        app.quit();
    }
});
