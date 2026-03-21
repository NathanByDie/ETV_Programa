import express from "express";
import 'dotenv/config';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import cors from 'cors';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const userDataPath = process.env.USER_DATA_PATH || path.join(process.cwd(), 'data');
if (!fs.existsSync(userDataPath)) {
    try {
        fs.mkdirSync(userDataPath, { recursive: true });
    } catch (e) {
        console.error('Error creating userDataPath:', e);
    }
}
const authInfoPath = path.join(userDataPath, 'baileys_auth_info');
const logPath = path.join(userDataPath, 'baileys.log');
const serverLogPath = path.join(userDataPath, 'server_error.log');

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    fs.appendFileSync(serverLogPath, `[${new Date().toISOString()}] Uncaught Exception: ${err.stack || err}\n`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    fs.appendFileSync(serverLogPath, `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n`);
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

let sock: any = null;
let qrCodeDataUrl: string | null = null;
let isConnected = false;
let isConnecting = false;
let lastError: string | null = null;


console.log('--- WHATSAPP CONFIG ---');
console.log('User Data Path:', userDataPath);
console.log('Auth Info Path:', authInfoPath);
console.log('Log Path:', logPath);

async function connectToWhatsApp() {
    console.log('--- STARTING WHATSAPP CONNECTION ---');
    if (isConnecting) {
        console.log('Already connecting, skipping...');
        return;
    }
    isConnecting = true;
    try {
        console.log('Reading auth state from:', authInfoPath);
        let authState;
        try {
            authState = await useMultiFileAuthState(authInfoPath);
        } catch (e) {
            console.error('Error reading auth state, clearing and retrying...', e);
            fs.rmSync(authInfoPath, { recursive: true, force: true });
            authState = await useMultiFileAuthState(authInfoPath);
        }
        const { state, saveCreds } = authState;
        console.log('Fetching latest Baileys version...');
        const { version, isLatest } = await fetchLatestBaileysVersion().catch(err => {
            console.warn('Error fetching latest Baileys version, using default...', err);
            return { version: [3, 50, 0], isLatest: false };
        });
        
        let logger;
        try {
            logger = pino({ level: 'info' }, pino.destination(logPath));
        } catch (e) {
            console.warn('Error creating pino logger with destination, using default logger...', e);
            logger = pino({ level: 'info' });
        }
        
        console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version: version as any,
            auth: state,
            printQRInTerminal: false,
            logger: logger as any,
            browser: Browsers.macOS('Desktop')
        });
        console.log('WhatsApp socket created, setting up events...');

        sock.ev.on('connection.update', async (update: any) => {
            try {
                logger.info({ update }, 'Connection update');
                const { connection, lastDisconnect, qr } = update;
                if (connection === 'connecting') {
                    qrCodeDataUrl = null;
                }
                if (qr) {
                    try {
                        qrCodeDataUrl = await QRCode.toDataURL(qr);
                        lastError = null;
                    } catch (err) {
                        console.error("Error generating QR code", err);
                        lastError = "Error generating QR code";
                    }
                }
                if (connection === 'close') {
                    isConnecting = false;
                    isConnected = false;
                    sock = null;
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
                    const errorMessage = lastDisconnect?.error?.message || String(lastDisconnect?.error) || '';
                    const isLoggedOut = statusCode === DisconnectReason.loggedOut || errorMessage.includes('Intentional Logout') || errorMessage.includes('Unauthorized');
                    const isBadSession = statusCode === DisconnectReason.badSession;
                    const isQrTimeout = errorMessage.includes('QR refs attempts ended');
                    const shouldReconnect = !isLoggedOut && !isBadSession && !isQrTimeout;
                    
                    console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                    
                    if (isLoggedOut || isBadSession) {
                        try {
                            fs.rmSync(authInfoPath, { recursive: true, force: true });
                        } catch (e) {
                            console.error('Error removing auth info', e);
                        }
                        qrCodeDataUrl = null;
                        lastError = isBadSession ? "Sesión inválida, por favor escanea el QR nuevamente." : null;
                        connectToWhatsApp();
                    } else if (isQrTimeout) {
                        try {
                            fs.rmSync(authInfoPath, { recursive: true, force: true });
                        } catch (e) {
                            console.error('Error removing auth info', e);
                        }
                        qrCodeDataUrl = null;
                        lastError = null;
                        console.log('QR expired, automatically generating a new one...');
                        connectToWhatsApp();
                    } else if (statusCode === DisconnectReason.restartRequired) {
                        console.log('Restart required, restarting immediately...');
                        lastError = null; // Clear error so user doesn't see it
                        connectToWhatsApp();
                    } else if (shouldReconnect) {
                        lastError = `Conexión cerrada: ${errorMessage || 'Error desconocido'}. Reconectando...`;
                        setTimeout(connectToWhatsApp, 5000);
                    }
                } else if (connection === 'open') {
                    console.log('opened connection');
                    isConnecting = false;
                    isConnected = true;
                    qrCodeDataUrl = null;
                    lastError = null;
                }
            } catch (err) {
                console.error("Error in connection.update handler:", err);
            }
        });

        sock.ev.on('creds.update', () => saveCreds().catch(err => console.error('Error saving creds:', err)));
    } catch (err: any) {
        isConnecting = false;
        console.error("Error in connectToWhatsApp:", err);
        lastError = err.message || "Unknown error in connectToWhatsApp";
    }
}

connectToWhatsApp();

// API Routes
app.get('/api/health', (req, res) => {
    console.log('Health check received');
    res.json({ status: 'ok', isConnected, isConnecting, hasLastError: !!lastError });
});

app.get('/api/whatsapp/status', (req, res) => {
    console.log('GET /api/whatsapp/status hit');
    res.json({ isConnected, qrCode: qrCodeDataUrl, error: lastError });
});

app.post('/api/whatsapp/connect', async (req, res) => {
    if (!isConnected && !qrCodeDataUrl) {
        lastError = null;
        connectToWhatsApp();
    }
    res.json({ success: true });
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
            // The 'close' event will handle the cleanup and reconnection
        } else {
            try {
                fs.rmSync(authInfoPath, { recursive: true, force: true });
            } catch (e) {}
            isConnected = false;
            qrCodeDataUrl = null;
            lastError = null;
            connectToWhatsApp();
        }
    } catch (e) {
        console.error("Error logging out", e);
        try {
            fs.rmSync(authInfoPath, { recursive: true, force: true });
        } catch (err) {}
        isConnected = false;
        qrCodeDataUrl = null;
        lastError = null;
        connectToWhatsApp();
    }
    res.json({ success: true });
});

app.post('/api/whatsapp/send', async (req, res) => {
    if (!isConnected || !sock) {
        return res.status(400).json({ error: 'WhatsApp no está conectado. Por favor, escanea el código QR.' });
    }
    const { phone, message, image } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ error: 'Falta teléfono o mensaje' });
    }
    try {
        const jid = `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        if (image) {
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            await sock.sendMessage(jid, { image: buffer, caption: message });
        } else {
            await sock.sendMessage(jid, { text: message });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Error al enviar el mensaje' });
    }
});

import { fileURLToPath } from 'url';

const getDirname = () => {
    try {
        if (typeof __dirname !== 'undefined') return __dirname;
        return path.dirname(fileURLToPath(import.meta.url));
    } catch (e) {
        return process.cwd();
    }
};

const currentDir = getDirname();

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        // En producción (Electron), currentDir apunta a la carpeta donde está server.js
        // Intentamos encontrar la carpeta dist de forma robusta
        let distPath = currentDir;
        if (path.basename(currentDir) !== 'dist') {
            const potentialDist = path.join(currentDir, 'dist');
            if (fs.existsSync(potentialDist)) {
                distPath = potentialDist;
            } else {
                // Si no está en dist/, tal vez estamos en la raíz del app bundle
                const rootDist = path.join(process.cwd(), 'dist');
                if (fs.existsSync(rootDist)) {
                    distPath = rootDist;
                }
            }
        }
        
        console.log('--- PRODUCTION MODE ---');
        console.log('Current directory:', currentDir);
        console.log('Process CWD:', process.cwd());
        console.log('Serving static files from:', distPath);
        
        if (!fs.existsSync(distPath)) {
            console.error('CRITICAL ERROR: distPath does not exist:', distPath);
        }

        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            const indexPath = path.join(distPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                res.sendFile(indexPath);
            } else {
                console.error('CRITICAL ERROR: index.html not found at:', indexPath);
                res.status(404).send('index.html not found in ' + distPath + '. Please ensure the app is built correctly.');
            }
        });
    }

    const server = app.listen(PORT, "0.0.0.0", () => {
        const address = server.address();
        const actualPort = typeof address === 'string' ? PORT : address?.port;
        console.log(`Server running on http://0.0.0.0:${actualPort}`);
        if (process.send) {
            process.send({ type: 'server-started', port: actualPort });
        }
    }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Trying a random port...`);
            const fallbackServer = app.listen(0, "0.0.0.0", () => {
                const address = fallbackServer.address();
                const actualPort = typeof address === 'string' ? 0 : address?.port;
                console.log(`Server running on fallback port http://0.0.0.0:${actualPort}`);
                if (process.send) {
                    process.send({ type: 'server-started', port: actualPort });
                }
            });
        } else {
            console.error('Server error:', err);
            fs.appendFileSync(serverLogPath, `[${new Date().toISOString()}] Server error: ${err}\n`);
        }
    });
}

startServer();
