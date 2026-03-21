const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { fork } = require('child_process');

let serverProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'src', 'assets', 'images', process.platform === 'win32' ? 'LogoAppETV.ico' : (process.platform === 'darwin' ? 'LogoAppETV.icns' : 'LogoAppETV.png')),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const checkServerAndLoad = (url, attempts = 0, isFallback = false) => {
    console.log(`Intentando conectar al servidor (intento ${attempts + 1})...`);
    const request = http.get(url, (res) => {
      console.log('Servidor detectado, cargando URL...');
      win.loadURL(url).catch(err => {
        console.error('Error al cargar la URL del servidor:', err);
      });
    });

    request.on('error', (err) => {
      console.log(`Servidor no disponible aún: ${err.message}`);
      if (attempts < 60 && !isFallback) { // Aumentamos a 60 intentos (1 minuto)
        setTimeout(() => checkServerAndLoad(url, attempts + 1), 1000);
      } else if (isFallback && attempts < 5) {
        setTimeout(() => checkServerAndLoad(url, attempts + 1, true), 1000);
      } else {
        console.error('El servidor no respondió.');
        if (serverProcess) serverProcess.kill();
        win.loadURL(`data:text/html;charset=utf-8,<h1>Error Crítico</h1><p>El servidor interno no respondió a tiempo en ${url}. Revisa los logs en ${app.getPath('userData')}</p>`).catch(e => console.error(e));
      }
    });

    request.end();
  };

  if (app.isPackaged) {
    try {
      const serverPath = path.join(__dirname, 'dist', 'server.cjs');
      console.log('Iniciando servidor desde:', serverPath);
      
      process.env.NODE_ENV = 'production';
      process.env.USER_DATA_PATH = app.getPath('userData');
      process.env.APP_DIST_PATH = path.join(__dirname, 'dist');

      const serverModule = require(serverPath);
      if (serverModule && serverModule.startServer) {
        serverModule.startServer().then(port => {
          console.log(`Servidor iniciado en el puerto ${port}`);
          checkServerAndLoad(`http://localhost:${port}`);
        }).catch(err => {
          console.error('Error al iniciar el servidor:', err);
          win.loadURL(`data:text/html;charset=utf-8,<h1>Error Crítico</h1><p>Error al iniciar el servidor: ${err.message}. Revisa los logs en ${app.getPath('userData')}</p>`).catch(e => console.error(e));
        });
      } else {
        console.error('El módulo del servidor no exporta startServer, intentando cargar de todos modos...');
        checkServerAndLoad('http://localhost:3000');
      }
      
      // checkServerAndLoad('http://localhost:3000'); // Removed hardcoded port
    } catch (err) {
      console.error('Error al intentar iniciar el servidor:', err);
      const fallbackPath = path.join(__dirname, 'dist', 'index.html');
      win.loadFile(fallbackPath).catch(e => {
        console.error('Error al cargar index.html como respaldo:', e);
      });
    }
  } else {
    checkServerAndLoad('http://localhost:3000');
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
