const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assetsimages', process.platform === 'win32' ? 'LogoAppETV.ico' : (process.platform === 'darwin' ? 'LogoAppETV.icns' : 'LogoAppETV.png')),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const checkServerAndLoad = (url, attempts = 0) => {
    console.log(`Intentando conectar al servidor (intento ${attempts + 1})...`);
    const request = http.get(url, (res) => {
      console.log('Servidor detectado, cargando URL...');
      win.loadURL(url).catch(err => {
        console.error('Error al cargar la URL del servidor:', err);
      });
    });

    request.on('error', (err) => {
      console.log(`Servidor no disponible aún: ${err.message}`);
      if (attempts < 30) {
        setTimeout(() => checkServerAndLoad(url, attempts + 1), 1000);
      } else {
        console.error('El servidor no respondió después de 30 intentos.');
        const fallbackPath = path.join(__dirname, 'dist', 'index.html');
        if (fs.existsSync(fallbackPath)) {
          win.loadFile(fallbackPath).catch(e => {
            console.error('Error al cargar index.html como respaldo:', e);
          });
        } else {
          win.loadURL('data:text/html,<h1>Error Crítico</h1><p>No se pudo iniciar el servidor interno y no se encontró el archivo de respaldo.</p>');
        }
      }
    });

    request.end();
  };

  if (app.isPackaged) {
    try {
      process.env.NODE_ENV = 'production';
      process.env.USER_DATA_PATH = app.getPath('userData');
      
      const serverPath = path.join(__dirname, 'dist', 'server.cjs');
      console.log('Cargando servidor desde:', serverPath);
      require(serverPath);
      
      checkServerAndLoad('http://127.0.0.1:3000');
    } catch (err) {
      console.error('Error al iniciar el servidor empaquetado:', err);
      const fallbackPath = path.join(__dirname, 'dist', 'index.html');
      win.loadFile(fallbackPath).catch(e => {
        console.error('Error al cargar index.html como respaldo:', e);
      });
    }
  } else {
    // win.webContents.openDevTools();
    checkServerAndLoad('http://127.0.0.1:3000');
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
