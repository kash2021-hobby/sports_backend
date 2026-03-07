require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Sequelize, DataTypes } = require("sequelize");

/* ===============================
   NEW IMPORTS (GOOGLE DRIVE)
================================ */

const multer = require("multer");
const stream = require("stream");

const app = express();
app.use(cors());
app.use(express.json());

/* ===============================
   MULTER MEMORY STORAGE
================================ */

const upload = multer({
  storage: multer.memoryStorage(),
});

/* ===============================
   GOOGLE DRIVE SETUP
================================ */

const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  process.env.GOOGLE_DRIVE_REDIRECT_URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
});

const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

async function uploadToGoogleDrive(file) {

  const bufferStream = new stream.PassThrough();
  bufferStream.end(file.buffer);

  const response = await drive.files.create({
    requestBody: {
      name: file.originalname,
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: {
      mimeType: file.mimetype,
      body: bufferStream,
    },
    fields: "id",
  });

  const fileId = response.data.id;

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return `https://drive.google.com/file/d/${fileId}/preview`;
}
/* ===============================
   DATABASE CONNECTION
================================ */

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
  }
);

/* ===============================
   MODELS
================================ */

const Player = sequelize.define("Player", {

  phone: DataTypes.STRING,
  mpin: DataTypes.STRING,

  full_name: DataTypes.STRING,
  dob: DataTypes.DATE,
  age: DataTypes.INTEGER,
  gender: DataTypes.STRING,
  nationality: DataTypes.STRING,

  height: DataTypes.STRING,
  weight: DataTypes.STRING,
  blood_group: DataTypes.STRING,

  aadhaar_number: DataTypes.STRING,

  position: DataTypes.STRING,
  strong_foot: DataTypes.STRING,
  preferred_team: DataTypes.STRING,
  experience_years: DataTypes.INTEGER,

  city: DataTypes.STRING,
  district: DataTypes.STRING,
  pincode: DataTypes.STRING,

  email: DataTypes.STRING,

  emergency_contact_name: DataTypes.STRING,
  emergency_contact_phone: DataTypes.STRING,

  injury_last_6_months: DataTypes.STRING,
  pain_running: DataTypes.STRING,
  medical_treatment: DataTypes.STRING,

  club_applied: DataTypes.INTEGER,
  status: DataTypes.STRING,

  player_photo_url: DataTypes.STRING,
  gov_id_url: DataTypes.STRING,
  fitness_certificate_url: DataTypes.STRING

});

const Club = sequelize.define("Club", {
  name: DataTypes.STRING,
  city: DataTypes.STRING,
  logo_url: DataTypes.STRING,
});

const Trial = sequelize.define("Trial", {
  trial_date: DataTypes.DATE,
  venue: DataTypes.STRING,

  /* Player performance ratings */
  pace: DataTypes.INTEGER,
  passing: DataTypes.INTEGER,
  shooting: DataTypes.INTEGER,
  stamina: DataTypes.INTEGER,

  /* Manager checklist answers (stored as JSON) */
  checklist_answers: DataTypes.JSON,

  /* NEW: Explicitly named Medical notes */
  medical_notes: DataTypes.TEXT,

  /* Live photo taken during trial */
  trial_photo_url: DataTypes.TEXT,

  /* Manager recommendation */
  recommendation: DataTypes.BOOLEAN
});

const Admin = sequelize.define("Admin", {
  name: DataTypes.STRING,
  phone: DataTypes.STRING,
  mpin: DataTypes.STRING,
});

const Manager = sequelize.define("Manager", {
  name: DataTypes.STRING,
  phone: DataTypes.STRING,
  mpin: DataTypes.STRING,
  club_id: DataTypes.INTEGER,
});

const TrialQuestion = sequelize.define("TrialQuestion",{
 question: DataTypes.TEXT,
 club_id: DataTypes.INTEGER
});

const TrialAnswer = sequelize.define("TrialAnswer",{
 player_id: DataTypes.INTEGER,
 question_id: DataTypes.INTEGER,
 answer: DataTypes.STRING
});
/* ===============================
   RELATIONSHIPS
================================ */

Club.hasMany(Player, { foreignKey: "club_applied" });
Player.belongsTo(Club, { foreignKey: "club_applied" });

Club.hasMany(Manager, { foreignKey: "club_id" });
Manager.belongsTo(Club, { foreignKey: "club_id" });

Player.hasMany(Trial);
Trial.belongsTo(Player);

Club.hasMany(Trial);
Trial.belongsTo(Club);

/* ===============================
   SERIALIZERS
================================ */

function PlayerSerializer(player) {
  return {
    id: player.id,
    name: player.full_name,
    position: player.position,
    club: player.club_applied,
    status: player.status,
    photo_url: player.player_photo_url,
    badge:
      player.status === "Registered"
        ? "Approved Player"
        : "Pending Approval",
  };
}

function ClubSerializer(club) {
  return {
    id: club.id,
    name: club.name,
    city: club.city,
    logo: club.logo_url,
  };
}

function TrialSerializer(trial) {
  return {
    id: trial.id,
    date: trial.trial_date,
    venue: trial.venue,
    scores: {
      pace: trial.pace,
      passing: trial.passing,
      shooting: trial.shooting,
      stamina: trial.stamina,
    },
    recommendation: trial.recommendation,
  };
}

/* ===============================
   AUTH ROUTES
================================ */

app.post("/auth/send-otp", (req, res) => {
  res.json({ message: "OTP sent (use 52050)" });
});

app.post("/auth/verify-otp", (req, res) => {
  const { otp } = req.body;

  if (otp === "52050") {
    return res.json({ message: "OTP verified" });
  }

  res.status(401).json({ error: "Invalid OTP" });
});

app.post("/auth/set-mpin", async (req, res) => {
  const { phone, mpin } = req.body;

  let player = await Player.findOne({ where: { phone } });

  if (!player) {
    player = await Player.create({
      phone,
      mpin,
      status: "Registered",
    });
  } else {
    player.mpin = mpin;
    await player.save();
  }

  res.json({ message: "MPIN saved successfully" });
});

/* ===============================
   LOGIN (ROLE BASED)
================================ */

app.post("/auth/login", async (req, res) => {
  const { phone, mpin } = req.body;

  try {
    const admin = await Admin.findOne({ where: { phone, mpin } });

    if (admin) {
      return res.json({
        message: "Admin login successful",
        user: { id: admin.id, name: admin.name, role: "admin" },
      });
    }

    const manager = await Manager.findOne({ where: { phone, mpin } });

    if (manager) {
      return res.json({
        message: "Manager login successful",
        user: {
          id: manager.id,
          name: manager.name,
          club_id: manager.club_id,
          role: "manager",
        },
      });
    }

    const player = await Player.findOne({ where: { phone, mpin } });

    if (player) {
      return res.json({
        message: "Player login successful",
        user: { ...PlayerSerializer(player), role: "player" },
      });
    }

    res.status(401).json({ error: "Invalid Phone or MPIN" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   PLAYER PROFILE (WITH FILE UPLOAD)
================================ */

app.post(
  "/players/profile",

  upload.fields([
    { name: "player_photo", maxCount: 1 },
    { name: "gov_id_file", maxCount: 1 },
    { name: "fitness_certificate", maxCount: 1 }
  ]),

  async (req, res) => {

    try {

      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Player ID required" });
      }

      const player = await Player.findByPk(id);

      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      /* ===============================
         HANDLE FILES SAFELY
      ================================ */

      let photoUrl = player.player_photo_url;
      let govIdUrl = player.gov_id_url;
      let fitnessUrl = player.fitness_certificate_url;

      if (req.files?.player_photo) {
        photoUrl = await uploadToGoogleDrive(req.files.player_photo[0]);
      }

      if (req.files?.gov_id_file) {
        govIdUrl = await uploadToGoogleDrive(req.files.gov_id_file[0]);
      }

      if (req.files?.fitness_certificate) {
        fitnessUrl = await uploadToGoogleDrive(req.files.fitness_certificate[0]);
      }

      /* ===============================
         UPDATE PLAYER
      ================================ */

      await player.update({

        full_name: req.body.full_name,
        dob: req.body.dob,
        age: req.body.age,
        gender: req.body.gender,
        nationality: req.body.nationality,

        height: req.body.height,
        weight: req.body.weight,
        blood_group: req.body.blood_group,

        aadhaar_number: req.body.aadhaar_number,

        position: req.body.position,
        strong_foot: req.body.strong_foot,
        preferred_team: req.body.preferred_team,
        experience_years: req.body.experience_years,

        city: req.body.city,
        district: req.body.district,
        pincode: req.body.pincode,

        email: req.body.email,
        phone: req.body.phone,

        emergency_contact_name: req.body.emergency_contact_name,
        emergency_contact_phone: req.body.emergency_contact_phone,

        injury_last_6_months: req.body.injury_last_6_months,
        pain_running: req.body.pain_running,
        medical_treatment: req.body.medical_treatment,

        club_applied: req.body.club_applied,

        player_photo_url: photoUrl,
        gov_id_url: govIdUrl,
        fitness_certificate_url: fitnessUrl,
        status: "Applied"
      });

      res.json({
        message: "Player updated successfully",
        player
      });

    } catch (error) {

      console.error("PLAYER UPDATE ERROR:", error);

      res.status(500).json({
        error: "Server error",
        details: error.message
      });

    }

  });

app.get("/players/profile/:id", async (req, res) => {

  try {

    const player = await Player.findByPk(req.params.id);

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json(player);

  } catch (error) {

    res.status(500).json({ error: error.message });

  }

});
/* ===============================
   CLUB ROUTES
================================ */

app.get("/clubs", async (req, res) => {
  const clubs = await Club.findAll();

  res.json(clubs.map(ClubSerializer));
});

/* ===============================
   TRIAL ROUTES
================================ */

app.post("/trial/invite", async (req, res) => {
  const { player_id, club_id, trial_date, venue } = req.body;

  const trial = await Trial.create({
    PlayerId: player_id,
    ClubId: club_id,
    trial_date,
    venue,
  });

  const player = await Player.findByPk(player_id);

  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  player.status = "Trialist";
  await player.save();

  res.json({ message: "Player invited for trial" });
});

app.post("/trial/evaluate", upload.single("trial_photo"), async (req, res) => {

  const {
    player_id,
    pace,
    passing,
    shooting,
    stamina,
    recommendation,
    checklist_answers,
    medical_notes
  } = req.body;

  try {

    const trial = await Trial.findOne({
      where: { PlayerId: player_id }
    });

    if (!trial) {
      return res.status(404).json({ error: "Trial not found" });
    }

    /* Upload live trial photo */
    let photoUrl = trial.trial_photo_url;

    if (req.file) {
      photoUrl = await uploadToGoogleDrive(req.file);
    }

    /* Parse checklist answers JSON */
    let parsedChecklist = null;

    if (checklist_answers) {
      parsedChecklist = JSON.parse(checklist_answers);
    }

    /* Update trial record */

    await trial.update({
      pace,
      passing,
      shooting,
      stamina,
      recommendation,
      checklist_answers: parsedChecklist,
      trial_photo_url: photoUrl,
      medical_notes
    });

    /* Update player status if recommended */

    const player = await Player.findByPk(player_id);

    if (recommendation === true || recommendation === "true") {
      player.status = "Recommended";
      await player.save();
    }

    res.json({
      message: "Evaluation saved",
      trial
    });

  } catch (error) {
    console.error("TRIAL EVALUATION ERROR:", error);
    res.status(500).json({ error: error.message });
  }

});
app.get("/clubs/applications", async (req, res) => {
  try {

    const { club_id } = req.query;

    const players = await Player.findAll({
      where: { club_applied: club_id }
    });

    res.json(players);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   ADMIN ROUTES
================================ */

app.get("/admin/pending-players", async (req, res) => {

  const players = await Player.findAll({

    where: { status: "Recommended" },

    include: [
      {
        model: Trial,
        attributes: [
          "trial_date", "venue", "pace", "passing", "shooting", "stamina",
          "medical_notes", // <-- ONLY ask for medical_notes here
          "recommendation", "checklist_answers", "trial_photo_url" 
        ]
      }
    ]

  });

  res.json(players);

});
app.post("/admin/update-status", async (req, res) => {
  const { player_id, status } = req.body;

  try {
    const player = await Player.findByPk(player_id);
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    // This dynamically updates the database with "Registered", "Blacklisted", etc.
    player.status = status;
    await player.save();

    res.json({ message: "Player status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/manager/questions", async (req,res)=>{
 const { club_id, question } = req.body;

 const q = await TrialQuestion.create({
  club_id,
  question
 });

 res.json(q);
});

app.get("/manager/questions/:clubId", async (req,res)=>{

 const questions = await TrialQuestion.findAll({
  where:{ club_id:req.params.clubId }
 });

 res.json(questions);
});

app.post("/admin/approve-player", async (req, res) => {
  const { player_id } = req.body;

  const player = await Player.findByPk(player_id);

  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }

  player.status = "Registered";
  await player.save();

  res.json({ message: "Player approved successfully" });
});


/* ===============================
   START SERVER
================================ */
async function createFolder() {
  try {
    const folder = await drive.files.create({
      requestBody: {
        name: "DHSA_Uploads",
        mimeType: "application/vnd.google-apps.folder"
      },
      fields: "id"
    });

    console.log("FOLDER ID:", folder.data.id);
  } catch (error) {
    console.error("Error creating folder:", error);
  }
}

sequelize.sync({}).then(() => {
  // create drive folder

  app.listen(5000, () => {
    console.log("Server running on port 5000");
  });

});