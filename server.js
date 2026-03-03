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
const JWT_SECRET = process.env.JWT_SECRET || 'dhsa_secure_2026';

// --- MYSQL CONNECTION POOL ---
const pool = mysql.createPool(process.env.DATABASE_URL);

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

// --- SERIALIZERS (The Security Layer) ---
// This ensures sensitive database columns (like mpin) are NEVER sent to the user.
const serializers = {
    user: (u) => {
        if (!u) return null;
        return {
            id: u.id,
            phone: u.phone,
            fullName: u.fullName,
            role: u.role
        };
    },
    application: (a) => {
        if (!a) return null;
        return {
            id: a.id,
            userId: a.userId,
            // Parse JSON if it's stored as a string in MySQL
            formData: typeof a.formData === 'string' ? JSON.parse(a.formData) : a.formData,
            status: a.status
        };
    }
};

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

// --- AUTH MODULE (With Serialization) ---

app.post('/api/auth/verify-otp', async (req, res) => {
    const { phone, otp, mpin, fullName } = req.body;
    if (otp !== "52050") return res.status(400).json({ error: "Invalid OTP" });

    try {
        const hashedMpin = await bcrypt.hash(mpin, 10);
        const userId = uuidv4();
        
        await pool.execute(
            'INSERT INTO users (id, phone, fullName, mpin, role) VALUES (?, ?, ?, ?, ?)',
            [userId, phone, fullName, hashedMpin, 'USER']
        );

        const newUser = { id: userId, phone, fullName, role: 'USER' };
        const token = jwt.sign({ id: userId, role: 'USER' }, JWT_SECRET);

        res.json({ 
            token, 
            user: serializers.user(newUser) // Used Serializer here
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login-mpin', async (req, res) => {
    const { phone, mpin } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(mpin, user.mpin))) {
            return res.status(401).json({ error: "Invalid MPIN" });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
        
        res.json({ 
            token, 
            user: serializers.user(user) // Used Serializer here to hide mpin
        });
    } catch (error) {
        res.status(500).json({ error: "Database error" });
    }
});

// --- APPLICATION MODULE (With Serialization) ---

app.get('/api/applications/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM applications WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: "Not found" });

        res.json(serializers.application(rows[0])); // Used Serializer to format JSON
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SERVER START ---
app.listen(PORT, () => console.log(`🚀 DHSA Backend + MySQL + Serializers Live on ${PORT}`));