import express from "express";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const PORT = 3000;

let sock: any = null;
let qrCodeDataUrl: string | null = null;
let isConnected = false;
let isConnecting = false;
let lastError: string | null = null;

const userDataPath = process.env.USER_DATA_PATH || process.cwd();
const authInfoPath = path.join(userDataPath, 'baileys_auth_info');
const logPath = path.join(userDataPath, 'baileys.log');

async function connectToWhatsApp() {
    if (isConnecting) return;
    isConnecting = true;
    try {
        let authState;
        try {
            authState = await useMultiFileAuthState(authInfoPath);
        } catch (e) {
            console.error('Error reading auth state, clearing and retrying...', e);
            fs.rmSync(authInfoPath, { recursive: true, force: true });
            authState = await useMultiFileAuthState(authInfoPath);
        }
        const { state, saveCreds } = authState;
        const { version, isLatest } = await fetchLatestBaileysVersion();
        const logger = pino({ level: 'info' }, pino.destination(logPath));
        logger.info(`using WA v${version.join('.')}, isLatest: ${isLatest}`);

        sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            logger: logger as any,
            browser: Browsers.macOS('Desktop')
        });

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
                        lastError = "El código QR ha expirado. Haz clic en 'Generar nuevo QR' para intentar de nuevo.";
                        // DO NOT automatically reconnect to avoid infinite loop
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
app.get('/api/whatsapp/status', (req, res) => {
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
    if (typeof __dirname !== 'undefined') {
        return __dirname;
    }
    return path.dirname(fileURLToPath(import.meta.url));
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
        // Si server.js está en la raíz, distPath es ./dist. Si está en dist/, es currentDir.
        const distPath = path.basename(currentDir) === 'dist' ? currentDir : path.join(currentDir, 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
    }).on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Please close other instances.`);
        } else {
            console.error('Server error:', err);
        }
    });
}

startServer();
