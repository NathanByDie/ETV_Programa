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
      if (attempts < 60) { // Aumentamos a 60 intentos (1 minuto)
        setTimeout(() => checkServerAndLoad(url, attempts + 1), 1000);
      } else {
        console.error('El servidor no respondió después de 60 intentos.');
        win.loadURL(`data:text/html;charset=utf-8,<h1>Error Crítico</h1><p>El servidor interno no respondió a tiempo. Revisa los logs en ${app.getPath('userData')}</p>`).catch(e => console.error(e));
      }
    });

    request.end();
  };

  if (app.isPackaged) {
    try {
      const serverPath = path.join(__dirname, 'dist', 'server.cjs');
      console.log('Iniciando servidor desde:', serverPath);
      
      serverProcess = fork(serverPath, [], {
        cwd: __dirname,
        env: { 
          ...process.env,
          NODE_ENV: 'production',
          USER_DATA_PATH: app.getPath('userData'),
          APP_DIST_PATH: path.join(__dirname, 'dist')
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
      });

      serverProcess.on('error', (err) => {
        console.error('Error en el proceso del servidor:', err);
      });

      let serverStarted = false;

      serverProcess.on('exit', (code, signal) => {
        console.log(`El proceso del servidor salió con código ${code} y señal ${signal}`);
        if (!serverStarted) {
          win.loadURL(`data:text/html;charset=utf-8,<h1>Error Crítico</h1><p>El servidor interno se cerró inesperadamente (código ${code}). Revisa los logs en ${app.getPath('userData')}</p>`).catch(e => console.error(e));
        }
      });

      const timeoutId = setTimeout(() => {
        if (!serverStarted) {
          console.error('El servidor no envió el mensaje de inicio después de 45 segundos.');
          if (serverProcess) serverProcess.kill();
          win.loadURL(`data:text/html;charset=utf-8,<h1>Error Crítico</h1><p>El servidor interno no respondió a tiempo (Timeout 45s). Revisa los logs en ${app.getPath('userData')}</p>`).catch(e => console.error(e));
        }
      }, 45000);

      serverProcess.on('message', (msg) => {
        if (msg && msg.type === 'server-started') {
          serverStarted = true;
          clearTimeout(timeoutId);
          console.log(`Servidor iniciado en el puerto ${msg.port}`);
          checkServerAndLoad(`http://127.0.0.1:${msg.port}`);
        } else if (msg && msg.type === 'server-error') {
          serverStarted = true;
          clearTimeout(timeoutId);
          win.loadURL(`data:text/html;charset=utf-8,<h1>Error Crítico</h1><p>Error al iniciar el servidor: ${msg.error}. Revisa los logs en ${app.getPath('userData')}</p>`).catch(e => console.error(e));
        }
      });
      
      // checkServerAndLoad('http://localhost:3000'); // Removed hardcoded port
    } catch (err) {
      console.error('Error al intentar iniciar el servidor:', err);
      const fallbackPath = path.join(__dirname, 'dist', 'index.html');
      win.loadFile(fallbackPath).catch(e => {
        console.error('Error al cargar index.html como respaldo:', e);
      });
    }
  } else {
    checkServerAndLoad('http://127.0.0.1:3000');
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
