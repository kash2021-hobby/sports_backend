const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dhsa_ultra_secure_2026';

// --- DATABASE CONNECTION (Optimized for Railway Internal) ---
const pool = mysql.createPool({
    uri: process.env.DATABASE_URL, // Ensure this is the Railway MySQL Internal URL
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// --- GOOGLE DRIVE CONFIG ---
const drive = google.drive({
    version: 'v3',
    auth: new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        null,
        process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
        ['https://www.googleapis.com/auth/drive.file']
    ),
});

// --- SERIALIZERS ---
const serializers = {
    user: (u) => ({ id: u.id, phone: u.phone, fullName: u.fullName, role: u.role }),
    application: (a) => ({ 
        id: a.id, 
        status: a.status, 
        formData: typeof a.formData === 'string' ? JSON.parse(a.formData) : a.formData 
    }),
    player: (p) => ({ id: p.id, identity: p.footballIdentity, status: p.eligibilityStatus }),
    trial: (t) => ({ id: t.id, status: t.status, score: t.score, comments: t.comments })
};

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// --- 1. AUTH MODULE ---
app.post('/api/auth/verify-otp', async (req, res) => {
    const { phone, otp, mpin, fullName } = req.body;
    if (otp !== "52050") return res.status(400).json({ error: "Invalid OTP" });

    try {
        const hashedMpin = await bcrypt.hash(mpin, 10);
        const userId = uuidv4();
        await pool.execute(
            'INSERT INTO users (id, phone, fullName, mpin) VALUES (?, ?, ?, ?)',
            [userId, phone, fullName, hashedMpin]
        );
        const token = jwt.sign({ id: userId, role: 'USER' }, JWT_SECRET);
        res.json({ token, user: { id: userId, phone, fullName, role: 'USER' } });
    } catch (error) {
        console.error("Auth error:", error);
        res.status(500).json({ error: "User already exists or database error" });
    }
});

app.post('/api/auth/login-mpin', async (req, res) => {
    const { phone, mpin } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(mpin, user.mpin))) return res.status(401).json({ error: "Invalid MPIN" });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        res.json({ token, user: serializers.user(user) });
    } catch (error) {
        res.status(500).json({ error: "Login failed" });
    }
});

// --- 2. PLAYER & APPLICATION MODULE ---
app.post('/api/applications', async (req, res) => {
    const { userId, formData } = req.body;
    const appId = uuidv4();
    try {
        await pool.execute(
            'INSERT INTO applications (id, userId, formData) VALUES (?, ?, ?)',
            [appId, userId, JSON.stringify(formData)]
        );
        res.json({ id: appId, status: 'PENDING' });
    } catch (error) {
        res.status(500).json({ error: "Application failed" });
    }
});

// --- 3. DOCUMENT & DRIVE MODULE ---
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });

        const fileMetadata = { name: `DHSA_${Date.now()}`, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] };
        const media = { mimeType: req.file.mimetype, body: fs.createReadStream(req.file.path) };
        const driveRes = await drive.files.create({ requestBody: fileMetadata, media, fields: 'id, webViewLink' });
        
        await drive.permissions.create({ fileId: driveRes.data.id, requestBody: { role: 'reader', type: 'anyone' } });
        fs.unlinkSync(req.file.path);

        await pool.execute('INSERT INTO documents (id, url) VALUES (?, ?)', [driveRes.data.id, driveRes.data.webViewLink]);
        res.json({ docId: driveRes.data.id, url: driveRes.data.webViewLink });
    } catch (error) {
        console.error("Drive upload error:", error);
        res.status(500).json({ error: "Drive upload failed" });
    }
});

// --- 4. AUTO-MIGRATION (Modified for Railway Order) ---
async function setupDatabase() {
    let conn;
    try {
        conn = await pool.getConnection();
        console.log("🛠️ Checking Railway DB Schema...");

        // Parent Tables first
        await conn.query(`CREATE TABLE IF NOT EXISTS users (id VARCHAR(255) PRIMARY KEY, phone VARCHAR(20) UNIQUE, fullName VARCHAR(255), mpin VARCHAR(255), role VARCHAR(50) DEFAULT 'USER')`);
        
        // Dependent Tables second
        await conn.query(`CREATE TABLE IF NOT EXISTS applications (id VARCHAR(255) PRIMARY KEY, userId VARCHAR(255), formData JSON, status VARCHAR(50) DEFAULT 'PENDING', FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE)`);
        
        await conn.query(`CREATE TABLE IF NOT EXISTS players (id VARCHAR(255) PRIMARY KEY, userId VARCHAR(255), footballIdentity VARCHAR(255), eligibilityStatus VARCHAR(50) DEFAULT 'ELIGIBLE', FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE)`);
        
        await conn.query(`CREATE TABLE IF NOT EXISTS trials (id VARCHAR(255) PRIMARY KEY, applicationId VARCHAR(255), status VARCHAR(50) DEFAULT 'PENDING', score INT, comments TEXT, FOREIGN KEY (applicationId) REFERENCES applications(id) ON DELETE CASCADE)`);
        
        await conn.query(`CREATE TABLE IF NOT EXISTS documents (id VARCHAR(255) PRIMARY KEY, url TEXT, status VARCHAR(50) DEFAULT 'PENDING')`);
        
        console.log("✅ Railway MySQL Tables Ready");
    } catch (err) {
        console.error("❌ DB Setup Error:", err.message);
    } finally {
        if (conn) conn.release();
    }
}

// --- HEALTH CHECK ---
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: "DHSA Operational", 
            db: "Railway Connected", 
            api: "efficient-heart-production.up.railway.app" 
        });
    } catch (e) {
        res.status(500).json({ status: "DB Error", detail: e.message });
    }
});

setupDatabase().then(() => {
    app.listen(PORT, () => console.log(`🚀 DHSA Backend Live on Port ${PORT}`));
});
