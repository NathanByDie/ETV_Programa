const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true, // Oculta el menú superior para que parezca una app nativa
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Si la app está empaquetada (producción), carga los archivos locales
  if (app.isPackaged) {
    // Iniciar el servidor Express empaquetado
    process.env.NODE_ENV = 'production';
    process.env.USER_DATA_PATH = app.getPath('userData');
    require(path.join(__dirname, 'dist', 'server.cjs'));
    
    // Esperar un momento a que el servidor inicie y cargar la URL local
    setTimeout(() => {
      win.loadURL('http://127.0.0.1:3000');
    }, 1000);
  } else {
    // En desarrollo, carga el servidor local de Vite
    win.loadURL('http://127.0.0.1:3000');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
