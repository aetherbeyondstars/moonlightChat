// ============================================================================
// electron/main.js — Proceso Principal de Electron para Moonlight Desktop.
// ============================================================================
const { app, BrowserWindow, shell, ipcMain, session, desktopCapturer } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    title: 'Moonlight',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0F0F12',
    autoHideMenuBar: true,
    show: false, // Oculto hasta que esté listo para evitar destellos blancos
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Permite CORS y peticiones a servidores locales HTTP/HTTPS sin bloqueos
      allowRunningInsecureContent: true,
    },
  });

  // Mostrar ventana suavemente al cargar
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir enlaces externos en el navegador predeterminado del sistema operativo
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let pendingDisplayMediaCallback = null;

// Inicialización de Electron
app.whenReady().then(() => {
  // Ignorar errores de certificados SSL autofirmados para servidores locales LAN/IP
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });

  // Permitir accesos a cámara, micrófono y captura de pantalla
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  // Habilitar captura de pantalla (getDisplayMedia) mediante modal interactivo en Electron
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 600, height: 338 },
      fetchWindowIcons: true,
    }).then((sources) => {
      const formatted = sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail ? s.thumbnail.toDataURL() : null,
        appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
        isScreen: s.id.startsWith('screen:'),
      }));

      pendingDisplayMediaCallback = callback;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('electron:share-picker-open', formatted);
      }
    }).catch((err) => {
      console.error('Error fetching desktop capturer sources:', err);
      callback({});
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// IPC Handlers para selección de fuente de pantalla/ventana desde el modal de React
ipcMain.handle('electron:share-picker-select', async (event, sourceId) => {
  if (pendingDisplayMediaCallback) {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
      const selected = sources.find((s) => s.id === sourceId);
      if (selected) {
        pendingDisplayMediaCallback({ video: selected });
      } else {
        pendingDisplayMediaCallback({});
      }
    } catch {
      pendingDisplayMediaCallback({});
    }
    pendingDisplayMediaCallback = null;
  }
});

ipcMain.handle('electron:share-picker-cancel', () => {
  if (pendingDisplayMediaCallback) {
    pendingDisplayMediaCallback({});
    pendingDisplayMediaCallback = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
