const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dhsa_ultra_secure_2026';

// --- IN-MEMORY DATABASE (Replaces Prisma for stability) ---
const db = {
    users: new Map(),
    applications: new Map(),
    players: new Map(),
    coaches: new Map(),
    trials: new Map(),
    documents: new Map(),
    lockouts: new Map() // For MPIN security
};

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// --- SERIALIZERS (Security Layer) ---
const serializers = {
    user: (u) => ({ id: u.id, phone: u.phone, fullName: u.fullName, role: u.role }),
    application: (a) => ({ id: a.id, status: a.status, data: a.formData, risk: a.riskLevel }),
    player: (p) => ({ id: p.id, identity: p.footballIdentity, status: p.status }),
    coach: (c) => ({ id: c.id, specialization: c.specialization, active: c.isActive })
};

// --- SECURITY HELPERS ---
const checkLockout = (phone) => {
    const lock = db.lockouts.get(phone);
    if (lock && lock.attempts >= 5 && Date.now() < lock.until) return true;
    return false;
};

// --- 1. AUTHENTICATION MODULE ---

// Request OTP
app.post('/api/auth/request-otp', (req, res) => {
    const { phone } = req.body;
    res.json({ message: "OTP sent (52050)", otp: "52050" });
});

// Verify OTP & Setup MPIN/Signup
app.post('/api/auth/verify-otp', async (req, res) => {
    const { phone, otp, mpin, fullName } = req.body;
    if (otp !== "52050") return res.status(400).json({ error: "Invalid OTP" });

    const hashedMpin = await bcrypt.hash(mpin, 10);
    const user = { id: uuidv4(), phone, fullName, mpin: hashedMpin, role: 'USER' };
    db.users.set(phone, user);

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    res.json({ token, user: serializers.user(user) });
});

// MPIN Login with Rate Limiting
app.post('/api/auth/login-mpin', async (req, res) => {
    const { phone, mpin } = req.body;
    if (checkLockout(phone)) return res.status(403).json({ error: "Account locked. Try later." });

    const user = db.users.get(phone);
    if (!user || !(await bcrypt.compare(mpin, user.mpin))) {
        const lock = db.lockouts.get(phone) || { attempts: 0, until: 0 };
        lock.attempts++;
        if (lock.attempts >= 5) lock.until = Date.now() + 30 * 60 * 1000;
        db.lockouts.set(phone, lock);
        return res.status(401).json({ error: "Invalid MPIN" });
    }

    db.lockouts.delete(phone); // Clear on success
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    res.json({ token, user: serializers.user(user) });
});

// --- 2. PLAYER APPLICATION MODULE ---

app.post('/api/applications', (req, res) => {
    const { userId, formData, isDraft } = req.body;
    const appId = uuidv4();
    const appData = {
        id: appId,
        userId,
        formData,
        status: isDraft ? 'DRAFT' : 'PENDING',
        riskLevel: 'LOW',
        createdAt: new Date()
    };
    db.applications.set(appId, appData);
    res.json(serializers.application(appData));
});

// --- 3. DOCUMENT MANAGEMENT ---

app.post('/api/documents/upload', upload.single('file'), (req, res) => {
    const docId = uuidv4();
    const doc = { id: docId, path: req.file.path, status: 'PENDING' };
    db.documents.set(docId, doc);
    res.json({ docId, status: 'UPLOADED' });
});

// --- 4. ADMIN & COACH MODULE ---

// Admin Approve Application -> Create Player
app.post('/api/admin/approve/:appId', (req, res) => {
    const appData = db.applications.get(req.params.appId);
    if (!appData) return res.status(404).json({ error: "Not found" });

    appData.status = 'VERIFIED';
    const player = {
        id: uuidv4(),
        userId: appData.userId,
        footballIdentity: appData.formData.name,
        status: 'ELIGIBLE'
    };
    db.players.set(player.id, player);
    res.json({ message: "Player Created", player: serializers.player(player) });
});

// Coach Evaluation
app.post('/api/trials/evaluate', (req, res) => {
    const { trialId, score, status } = req.body; // RECOMMENDED, NEEDS_RETEST
    const evaluation = { trialId, score, status, evaluator: 'Coach_ID' };
    db.trials.set(trialId, evaluation);
    res.json({ message: "Evaluation saved", evaluation });
});

// --- SERVER START ---
app.get('/health', (req, res) => res.json({ status: "DHSA System Operational" }));

app.listen(PORT, () => {
    console.log(`
    🚀 DHSA BACKEND READY
    ----------------------------
    Auth Module:      ACTIVE
    Player Module:    ACTIVE
    Coach Module:     ACTIVE
    Admin Module:     ACTIVE
    Security:         BCRYPT/JWT ENABLED
    Port:             ${PORT}
    `);
});