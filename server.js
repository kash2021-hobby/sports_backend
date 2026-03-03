const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dhsa_ultra_secure_2026';

// --- GOOGLE DRIVE CONFIG ---
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
    SCOPES
);
const drive = google.drive({ version: 'v3', auth });

// --- IN-MEMORY DATABASE ---
const db = {
    users: new Map(),
    applications: new Map(),
    players: new Map(),
    coaches: new Map(),
    trials: new Map(),
    documents: new Map(),
    lockouts: new Map()
};

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' }); // Temporary local storage before Drive upload

// --- SERIALIZERS ---
const serializers = {
    user: (u) => ({ id: u.id, phone: u.phone, fullName: u.fullName, role: u.role }),
    application: (a) => ({ id: a.id, status: a.status, data: a.formData, risk: a.riskLevel }),
    player: (p) => ({ id: p.id, identity: p.footballIdentity, status: p.status, photoUrl: p.photoUrl }),
    coach: (c) => ({ id: c.id, specialization: c.specialization, active: c.isActive })
};

// --- AUTH MODULE ---
app.post('/api/auth/request-otp', (req, res) => {
    res.json({ message: "OTP sent (52050)", otp: "52050" });
});

app.post('/api/auth/verify-otp', async (req, res) => {
    const { phone, otp, mpin, fullName } = req.body;
    if (otp !== "52050") return res.status(400).json({ error: "Invalid OTP" });

    const hashedMpin = await bcrypt.hash(mpin, 10);
    const user = { id: uuidv4(), phone, fullName, mpin: hashedMpin, role: 'USER' };
    db.users.set(phone, user);

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    res.json({ token, user: serializers.user(user) });
});

app.post('/api/auth/login-mpin', async (req, res) => {
    const { phone, mpin } = req.body;
    const user = db.users.get(phone);
    if (!user || !(await bcrypt.compare(mpin, user.mpin))) {
        return res.status(401).json({ error: "Invalid MPIN" });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    res.json({ token, user: serializers.user(user) });
});

// --- GOOGLE DRIVE DOCUMENT UPLOAD ---
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });

        // 1. Upload to Google Drive
        const fileMetadata = {
            name: `DHSA_${Date.now()}_${req.file.originalname}`,
            parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] 
        };
        const media = {
            mimeType: req.file.mimetype,
            body: fs.createReadStream(req.file.path)
        };

        const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
        });

        // 2. Set Public Permissions so frontend can fetch/view
        await drive.permissions.create({
            fileId: driveResponse.data.id,
            requestBody: { role: 'reader', type: 'anyone' }
        });

        // 3. Clean up local file
        fs.unlinkSync(req.file.path);

        const docData = { 
            id: driveResponse.data.id, 
            url: driveResponse.data.webViewLink, 
            status: 'VERIFIED' 
        };
        db.documents.set(docData.id, docData);

        res.json({ message: "Uploaded to Google Drive", file: docData });
    } catch (error) {
        console.error("Drive Error:", error);
        res.status(500).json({ error: "Google Drive Upload Failed" });
    }
});

// --- PLAYER & APPLICATION MODULE ---
app.post('/api/applications', (req, res) => {
    const { userId, formData, isDraft } = req.body;
    const appId = uuidv4();
    const appData = { id: appId, userId, formData, status: isDraft ? 'DRAFT' : 'PENDING', createdAt: new Date() };
    db.applications.set(appId, appData);
    res.json(serializers.application(appData));
});

app.post('/api/admin/approve/:appId', (req, res) => {
    const appData = db.applications.get(req.params.appId);
    if (!appData) return res.status(404).json({ error: "Application not found" });

    appData.status = 'VERIFIED';
    const player = {
        id: uuidv4(),
        userId: appData.userId,
        footballIdentity: appData.formData.name,
        photoUrl: appData.formData.photoUrl || null, // URL from Google Drive
        status: 'ELIGIBLE'
    };
    db.players.set(player.id, player);
    res.json({ message: "Player Created", player: serializers.player(player) });
});

// --- SERVER START ---
app.get('/health', (req, res) => res.json({ status: "DHSA Operational", driveConnected: !!process.env.GOOGLE_CLIENT_EMAIL }));

app.listen(PORT, () => {
    console.log(`🚀 DHSA Backend Live on Port ${PORT}`);
});