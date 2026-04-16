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
  gov_doc_1_url: DataTypes.STRING,
  gov_doc_2_url: DataTypes.STRING,
  gov_doc_3_url: DataTypes.STRING,
  fitness_certificate_url: DataTypes.STRING,
  aadhaar_verified_url: DataTypes.STRING,
  pan_number: DataTypes.STRING
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

const Team = sequelize.define("Team", {
  name: DataTypes.STRING,
  jersey_color: DataTypes.STRING,
  status: {
    type: DataTypes.STRING,
    defaultValue: "Pending Approval" // Requires Admin Approval
  }
});

const TeamPlayer = sequelize.define("TeamPlayer", {
  jersey_number: DataTypes.INTEGER,
  assigned_position: DataTypes.STRING
});
const Tournament = sequelize.define("Tournament", {
  name: DataTypes.STRING,
  description: DataTypes.TEXT,
  banner_url: DataTypes.STRING,
  
  format: DataTypes.STRING, // Knockout, League, Group Stages + Knockout
  
  registration_deadline: DataTypes.DATE,
  start_date: DataTypes.DATE,
  end_date: DataTypes.DATE,
  
  venue: DataTypes.STRING,
  city: DataTypes.STRING,
  
  age_category: DataTypes.STRING,
  gender: DataTypes.STRING,
  
  max_teams: DataTypes.INTEGER,
  entry_fee: DataTypes.INTEGER,
  prize_pool: DataTypes.STRING,
  registration_mode: DataTypes.JSON, // Stores array like ["Online", "Offline"]
  qr_code_url: DataTypes.STRING, // Stores Google Drive link for QR code
  upi_id: DataTypes.STRING,
  
  status: {
    type: DataTypes.STRING,
    defaultValue: "Registration Open" 
  }
});
const TournamentRegistration = sequelize.define("TournamentRegistration", {
  status: {
    type: DataTypes.STRING,
    defaultValue: "Pending Verification" // Admin must approve
  },
  payment_receipt_url: DataTypes.STRING,
  roster_data: DataTypes.JSON // Will store { starters: [...], subs: [...] }
});

/* ===============================
   UPDATED MATCH MODEL
================================ */
const Match = sequelize.define("Match", {
  match_type: DataTypes.STRING, // 🌟 NEW: 'Group', 'League', or 'Knockout'
  group_name: DataTypes.STRING, // 🌟 NEW: e.g., 'A' (Only used if match_type is 'Group')
  
  round_name: DataTypes.STRING, 
  round_number: DataTypes.INTEGER, 
  match_number: DataTypes.INTEGER, 
  
  team1_id: DataTypes.INTEGER, 
  team2_id: DataTypes.INTEGER, 
  // Add these two lines to save the "Winner Match X" text!
  team1_placeholder: DataTypes.STRING,
  team2_placeholder: DataTypes.STRING,
  
  team1_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  team2_score: { type: DataTypes.INTEGER, defaultValue: 0 },
  
  winner_id: DataTypes.INTEGER, 
  is_draw: { type: DataTypes.BOOLEAN, defaultValue: false }, // 🌟 NEW: Crucial for Leagues
  
  next_match_id: DataTypes.INTEGER, 

  match_date: DataTypes.STRING,
  match_time: DataTypes.STRING,
  venue: DataTypes.STRING,

  referee_id: DataTypes.INTEGER, 
  team1_jersey: DataTypes.STRING, 
  team2_jersey: DataTypes.STRING, 
  is_live: { type: DataTypes.BOOLEAN, defaultValue: false }, 
  
  // 🌟 NEW: Stores the entire JSON timeline of goals, cards, and substitutions!
  match_events: { 
    type: DataTypes.TEXT, 
    allowNull: true 
  },
  
  status: {
    type: DataTypes.STRING,
    defaultValue: "Pending Setup" 
  }
});
/* ===============================
   NEW TABLE: STANDINGS
================================ */
const Standings = sequelize.define("Standings", {
  group_name: DataTypes.STRING, // e.g., 'A', 'B' (Null for a pure League)
  
  matches_played: { type: DataTypes.INTEGER, defaultValue: 0 },
  wins: { type: DataTypes.INTEGER, defaultValue: 0 },
  draws: { type: DataTypes.INTEGER, defaultValue: 0 },
  losses: { type: DataTypes.INTEGER, defaultValue: 0 },
  
  goals_for: { type: DataTypes.INTEGER, defaultValue: 0 },
  goals_against: { type: DataTypes.INTEGER, defaultValue: 0 },
  goal_difference: { type: DataTypes.INTEGER, defaultValue: 0 },
  
  points: { type: DataTypes.INTEGER, defaultValue: 0 }
});
/* ===============================
   REFEREE MODEL
================================ */
const Referee = sequelize.define("Referee", {
  full_name: DataTypes.STRING,
  phone: DataTypes.STRING,
  email: DataTypes.STRING,
  mpin: DataTypes.STRING, // Kept for secure login
  
  date_of_birth: DataTypes.DATEONLY,
  gender: DataTypes.STRING,
  
  city: DataTypes.STRING,
  address: DataTypes.TEXT,
  
  photo_url: DataTypes.STRING,
  
  status: {
    type: DataTypes.STRING,
    defaultValue: "Active" // Active / Inactive
  }
});
const TransferHistory = sequelize.define("TransferHistory", {
  noc_document_url: DataTypes.STRING,
  transfer_date: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
  // Note: player_id, from_club_id, and to_club_id will be added by relationships below
});

// --- TRANSFER HISTORY RELATIONSHIPS ---
Player.hasMany(TransferHistory, { foreignKey: 'player_id' });
TransferHistory.belongsTo(Player, { foreignKey: 'player_id' });

// We use 'as' aliases because Club connects to TransferHistory twice (From and To)
Club.hasMany(TransferHistory, { foreignKey: 'from_club_id', as: 'OutgoingTransfers' });
TransferHistory.belongsTo(Club, { foreignKey: 'from_club_id', as: 'FromClub' });

Club.hasMany(TransferHistory, { foreignKey: 'to_club_id', as: 'IncomingTransfers' });
TransferHistory.belongsTo(Club, { foreignKey: 'to_club_id', as: 'ToClub' });

// Link Referee to Matches
Referee.hasMany(Match, { foreignKey: 'referee_id' });
Match.belongsTo(Referee, { foreignKey: 'referee_id', as: 'MatchReferee' });

// Relationships
Tournament.hasMany(Standings);
Standings.belongsTo(Tournament);

Team.hasMany(Standings);
Standings.belongsTo(Team);

/* ===============================
   ADD TO TOURNAMENT REGISTRATION
================================ */
// Add this field to your existing TournamentRegistration model
// coach_accepted_fixture: { type: DataTypes.BOOLEAN, defaultValue: false }

// Relationships for Matches
Tournament.hasMany(Match);
Match.belongsTo(Tournament);

// We must use 'as' aliases because Team connects to Match twice!
Team.hasMany(Match, { foreignKey: 'team1_id', as: 'MatchesAsTeam1' });
Team.hasMany(Match, { foreignKey: 'team2_id', as: 'MatchesAsTeam2' });
Team.hasMany(Match, { foreignKey: 'winner_id', as: 'MatchesWon' });

Match.belongsTo(Team, { foreignKey: 'team1_id', as: 'Team1' });
Match.belongsTo(Team, { foreignKey: 'team2_id', as: 'Team2' });
Match.belongsTo(Team, { foreignKey: 'winner_id', as: 'Winner' });

// Assuming you have a User model for Admins/Referees
// User.hasMany(Match, { foreignKey: 'referee_id' });

// Relationships
Tournament.hasMany(TournamentRegistration, { foreignKey: 'tournament_id' });
TournamentRegistration.belongsTo(Tournament, { foreignKey: 'tournament_id' });

Team.hasMany(TournamentRegistration, { foreignKey: 'team_id' });
TournamentRegistration.belongsTo(Team, { foreignKey: 'team_id' });

// Relationships: A Tournament can have many Teams, and a Team can join many Tournaments
Tournament.belongsToMany(Team, { through: 'TournamentTeams' });
Team.belongsToMany(Tournament, { through: 'TournamentTeams' });
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
// A Club has one Permanent Team
Club.hasOne(Team, { foreignKey: "club_id" });
Team.belongsTo(Club, { foreignKey: "club_id" });

// Many-to-Many Relationship between Team and Player
Team.belongsToMany(Player, { through: TeamPlayer, foreignKey: "team_id" });
Player.belongsToMany(Team, { through: TeamPlayer, foreignKey: "player_id" });

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
    
    // 🌟 Basic Stats (Great for Manager UI)
    age: player.age,
    height: player.height,
    weight: player.weight,
    strong_foot: player.strong_foot,
    experience_years: player.experience_years,
    
    // 🌟 Contact Info
    phone: player.phone,
    email: player.email,

    // 🌟 Document URLs (Critical for Admin Verification)
    photo_url: player.player_photo_url,
    gov_doc_1_url: player.gov_doc_1_url,
    gov_doc_2_url: player.gov_doc_2_url,
    gov_doc_3_url: player.gov_doc_3_url,
    fitness_certificate_url: player.fitness_certificate_url,

    // Badge Logic
    badge:
      player.status === "Registered"
        ? "Approved Player"
        : "Pending Approval",
  };
}
function TransferHistorySerializer(history) {
  return {
    id: history.id,
    transfer_date: history.transfer_date,
    noc_document_url: history.noc_document_url,
    
    // Player Details (Safely checking if data exists to avoid crashes)
    player_id: history.player_id,
    player_name: history.Player ? history.Player.full_name : "Unknown Player",
    player_photo: history.Player ? history.Player.player_photo_url : null,
    
    // Previous Club Details
    from_club_id: history.from_club_id,
    from_club: history.FromClub ? history.FromClub.name : "Independent / New",
    
    // New Club Details
    to_club_id: history.to_club_id,
    to_club: history.ToClub ? history.ToClub.name : "Unknown Club"
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

function TeamSerializer(team) {
  return {
    id: team.id,
    name: team.name,
    jersey_color: team.jersey_color,
    status: team.status,
    club_id: team.club_id,
    // Map through the associated players and extract the junction table data
    players: team.Players ? team.Players.map(p => ({
      id: p.id,
      full_name: p.full_name,
      player_photo_url: p.player_photo_url,
      // Access the data from the TeamPlayer junction table
      jersey_number: p.TeamPlayer.jersey_number,
      assigned_position: p.TeamPlayer.assigned_position
    })) : []
  };
}
function TournamentSerializer(tournament) {
  return {
    id: tournament.id,
    name: tournament.name,
    description: tournament.description,
    banner_url: tournament.banner_url,
    format: tournament.format,
    registration_deadline: tournament.registration_deadline,
    start_date: tournament.start_date,
    end_date: tournament.end_date,
    venue: tournament.venue,
    city: tournament.city,
    age_category: tournament.age_category,
    gender: tournament.gender,
    max_teams: tournament.max_teams,
    entry_fee: tournament.entry_fee,
    prize_pool: tournament.prize_pool,
    status: tournament.status,
    registration_mode: tournament.registration_mode || [],
    qr_code_url: tournament.qr_code_url,
    upi_id: tournament.upi_id,
    registered_teams_count: tournament.Teams ? tournament.Teams.length : 0
  };
}
/* ===============================
   MATCH SERIALIZER
================================ */
/* ===============================
   MATCH SERIALIZER
================================ */
function MatchSerializer(match) {
  return {
    id: match.id,
    tournament_id: match.TournamentId,
    tournament_name: match.Tournament ? match.Tournament.name : 'Unknown Tournament',
    
    round_name: match.round_name,
    round_number: match.round_number,
    match_number: match.match_number,
    
    team1_id: match.team1_id,
    // 🌟 YOUR AWESOME LOGIC: Actual Name > Database Placeholder > "TBD"
    team1_name: match.Team1 ? match.Team1.name : (match.team1_placeholder || "TBD"),
    team1_placeholder: match.team1_placeholder,
    team1_jersey: match.team1_jersey,
    team1_score: match.team1_score,
    // 🌟 RESTORED: The Club Logo for the UI
    team1_logo: match.Team1 && match.Team1.Club ? match.Team1.Club.logo_url : null,
    
    team2_id: match.team2_id,
    // 🌟 YOUR AWESOME LOGIC: Actual Name > Database Placeholder > "TBD"
    team2_name: match.Team2 ? match.Team2.name : (match.team2_placeholder || "TBD"),
    team2_placeholder: match.team2_placeholder,
    team2_jersey: match.team2_jersey,
    team2_score: match.team2_score,
    // 🌟 RESTORED: The Club Logo for the UI
    team2_logo: match.Team2 && match.Team2.Club ? match.Team2.Club.logo_url : null,
    
    match_date: match.match_date,
    match_time: match.match_time,
    venue: match.venue,

    winner_id: match.winner_id,
    next_match_id: match.next_match_id,
    
    referee_id: match.referee_id,
    // 🌟 RESTORED: Prevents the "Ref #1" bug!
    referee_name: match.MatchReferee ? match.MatchReferee.full_name : "TBD",
    
    is_live: match.is_live,
    status: match.status,
    
    // 🌟 RESTORED: Needed for the Live Timeline to work!
    match_events: match.match_events ? JSON.parse(match.match_events) : []
  };
}
/* ===============================
   TOURNAMENT REGISTRATION SERIALIZER
================================ */
function TournamentRegistrationSerializer(registration) {
  return {
    id: registration.id,
    status: registration.status,
    payment_receipt_url: registration.payment_receipt_url,
    
    // Ensure the roster data is properly parsed as a JSON object for React
    roster_data: typeof registration.roster_data === 'string' 
      ? JSON.parse(registration.roster_data) 
      : registration.roster_data,
      
    tournament_id: registration.tournament_id,
    team_id: registration.team_id,
    
    // If we join the tables, grab the names so the Admin knows who it is!
    team_name: registration.Team ? registration.Team.name : "Unknown Team",
    tournament_name: registration.Tournament ? registration.Tournament.name : "Unknown Tournament",
    
    applied_on: registration.createdAt
  };
}
/* ===============================
   STANDINGS SERIALIZER
================================ */
function StandingsSerializer(standing) {
  return {
    id: standing.id,
    tournament_id: standing.TournamentId,
    team_id: standing.TeamId,
    team_name: standing.Team ? standing.Team.name : "Unknown Team",
    group_name: standing.group_name,
    
    matches_played: standing.matches_played,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    
    goals_for: standing.goals_for,
    goals_against: standing.goals_against,
    goal_difference: standing.goal_difference,
    points: standing.points
  };
}

/* ===============================
   REFEREE SERIALIZER
================================ */
function RefereeSerializer(referee) {
  return {
    id: referee.id,
    full_name: referee.full_name,
    phone: referee.phone,
    email: referee.email,
    mpin: referee.mpin, // Sent to frontend so Admin can view/edit it
    date_of_birth: referee.date_of_birth,
    gender: referee.gender,
    city: referee.city,
    address: referee.address,
    photo_url: referee.photo_url,
    status: referee.status,
    registered_on: referee.createdAt
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
   TOURNAMENT ROUTES
================================ */

// CREATE Tournament (Admin)
// CREATE Tournament (Admin)
app.post("/admin/tournaments", upload.fields([
  { name: "banner_file", maxCount: 1 },
  { name: "qr_code_file", maxCount: 1 }
]), async (req, res) => {
  try {
    let bannerUrl = null;
    let qrCodeUrl = null;
    
    if (req.files && req.files.banner_file) {
      bannerUrl = await uploadToGoogleDrive(req.files.banner_file[0]);
    }
    
    if (req.files && req.files.qr_code_file) {
      qrCodeUrl = await uploadToGoogleDrive(req.files.qr_code_file[0]);
    }

    // Parse the JSON array string sent from FormData
    const regMode = req.body.registration_mode ? JSON.parse(req.body.registration_mode) : [];

    const newTournament = await Tournament.create({
      ...req.body,
      registration_mode: regMode,
      banner_url: bannerUrl,
      qr_code_url: qrCodeUrl
    });

    res.json({ message: "Tournament created successfully!", tournament: newTournament });
  } catch (error) {
    console.error("TOURNAMENT CREATION ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET All Tournaments (Used by both Admin and Managers)
app.get("/tournaments", async (req, res) => {
  try {
    const tournaments = await Tournament.findAll({
      include: [{ model: Team, attributes: ['id'] }], // To count registered teams
      order: [['createdAt', 'DESC']]
    });
    
    res.json(tournaments.map(TournamentSerializer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// DELETE a Tournament (Admin)
app.delete("/admin/tournaments/:id", async (req, res) => {
  try {
    const tournament = await Tournament.findByPk(req.params.id);
    
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    await tournament.destroy();
    res.json({ message: "Tournament deleted successfully" });
  } catch (error) {
    console.error("TOURNAMENT DELETE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   TOURNAMENT REGISTRATION
================================ */
/* ===============================
   TOURNAMENT REGISTRATION
================================ */
/* ===============================
   TOURNAMENT REGISTRATION
================================ */
app.post("/manager/tournaments/register", upload.single("receipt_file"), async (req, res) => {
  try {
    const { tournament_id, team_id, roster_data } = req.body;

    // 🌟 THE FIX: First, check if the tournament is still accepting registrations!
    const tournament = await Tournament.findByPk(tournament_id);
    if (!tournament) {
        return res.status(404).json({ error: "Tournament not found." });
    }
    
    // If the Admin clicked "Generate Fixtures", the status is now "Ongoing"
    if (tournament.status !== "Registration Open") {
        return res.status(403).json({ error: "Registrations are currently closed for this tournament." });
    }

    // Check if team already registered
    const existingEntry = await TournamentRegistration.findOne({
      where: { tournament_id, team_id }
    });
    if (existingEntry) {
      return res.status(400).json({ error: "Your team is already registered for this tournament." });
    }

    let receiptUrl = null;
    if (req.file) {
      receiptUrl = await uploadToGoogleDrive(req.file);
    }

    const registration = await TournamentRegistration.create({
      tournament_id,
      team_id,
      roster_data: JSON.parse(roster_data),
      payment_receipt_url: receiptUrl,
      status: "Pending Verification"
    });

    res.json({ message: "Registration submitted successfully!", registration });
  } catch (error) {
    console.error("REGISTRATION ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   ADMIN: UPDATE STATUS & VERIFY AADHAAR
================================ */

app.post("/admin/update-status", upload.single("aadhaar_screenshot"), async (req, res) => {
  const { player_id, status } = req.body;

  try {
    const player = await Player.findByPk(player_id);
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    // 🌟 1. UPLOAD AADHAAR SCREENSHOT TO GOOGLE DRIVE
    let aadhaarUrl = player.aadhaar_verified_url; // Keep existing if there is one
    if (req.file) {
        aadhaarUrl = await uploadToGoogleDrive(req.file);
    }

    // 🌟 2. UPDATE DATABASE
    player.status = status;
    player.aadhaar_verified_url = aadhaarUrl;
    await player.save();

    // 🌟 3. AUTOMATION: Auto-add to permanent team if status is set to "Registered"
    if (status === "Registered" && player.club_applied) {
        const team = await Team.findOne({ where: { club_id: player.club_applied } });
        
        if (team) {
            // Find highest jersey number to avoid conflicts
            const currentMax = await TeamPlayer.max('jersey_number', { where: { team_id: team.id } });
            const nextJersey = (currentMax || 0) + 1;

            await TeamPlayer.findOrCreate({
                where: { team_id: team.id, player_id: player.id },
                defaults: {
                    jersey_number: nextJersey,
                    assigned_position: player.position || "Reserve"
                }
            });
        }
    }

    res.json({ message: "Player status updated successfully" });
  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   ADMIN: TRANSFER PLAYER
================================ */
/* ===============================
   ADMIN: TRANSFER PLAYER (UPDATED FOR HISTORY TABLE)
================================ */
app.post("/admin/transfer-player", upload.single("noc_document"), async (req, res) => {
  try {
    const { player_id, new_club_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "NOC document is required for transfer." });
    }

    const player = await Player.findByPk(player_id);
    if (!player) return res.status(404).json({ error: "Player not found" });

    // 1. Upload the NOC document to Google Drive
    const nocUrl = await uploadToGoogleDrive(req.file);

    // Save the old club id so we can log it
    const oldClubId = player.club_applied;

    // 2. 🌟 NEW: Create the Transfer History Record!
    await TransferHistory.create({
        player_id: player.id,
        from_club_id: oldClubId || null, // Might be null if they were independent
        to_club_id: new_club_id,
        noc_document_url: nocUrl
    });

    // 3. Update player's current club 
    // (Notice we are no longer saving the NOC URL here!)
    await player.update({ club_applied: new_club_id });

    // 4. Remove them from their OLD permanent team
    if (oldClubId) {
       const oldTeam = await Team.findOne({ where: { club_id: oldClubId } });
       if (oldTeam) {
          await TeamPlayer.destroy({ where: { team_id: oldTeam.id, player_id: player.id } });
       }
    }

    // 5. Automatically add them to the NEW club's permanent team (if it exists)
    const newTeam = await Team.findOne({ where: { club_id: new_club_id } });
    if (newTeam) {
        const currentMax = await TeamPlayer.max('jersey_number', { where: { team_id: newTeam.id } });
        const nextJersey = (currentMax || 0) + 1;

        await TeamPlayer.findOrCreate({
            where: { team_id: newTeam.id, player_id: player.id },
            defaults: {
                jersey_number: nextJersey,
                assigned_position: player.position || "Transfer"
            }
        });
    }

    res.json({ message: "Player successfully transferred to the new club and history logged!", noc_url: nocUrl });
  } catch (error) {
    console.error("TRANSFER ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   ADMIN: GET ALL TRANSFER HISTORY
================================ */
app.get("/admin/transfer-history", async (req, res) => {
    try {
        const history = await TransferHistory.findAll({
            include: [
                { model: Player, attributes: ['id', 'full_name', 'player_photo_url'] },
                { model: Club, as: 'FromClub', attributes: ['name'] },
                { model: Club, as: 'ToClub', attributes: ['name'] }
            ],
            order: [['transfer_date', 'DESC']]
        });
        
        // Map data to be clean for the frontend
        const formattedHistory = history.map(record => ({
            id: record.id,
            transfer_date: record.transfer_date,
            noc_document_url: record.noc_document_url,
            player_name: record.Player ? record.Player.full_name : "Unknown Player",
            player_photo: record.Player ? record.Player.player_photo_url : null,
            from_club: record.FromClub ? record.FromClub.name : "Independent / New",
            to_club: record.ToClub ? record.ToClub.name : "Unknown Club"
        }));

        res.json(formattedHistory);
    } catch (error) {
        console.error("FETCH TRANSFER HISTORY ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});
// GET all matches for a specific tournament
app.get("/admin/tournaments/:id/matches", async (req, res) => {
  try {
    const matches = await Match.findAll({
      where: { TournamentId: req.params.id }, // Sequelize auto-generates this foreign key
      include: [
        { model: Team, as: 'Team1', attributes: ['id', 'name'] },
        { model: Team, as: 'Team2', attributes: ['id', 'name'] },
        { model: Team, as: 'Winner', attributes: ['id', 'name'] }
      ],
      order: [['round_number', 'ASC'], ['match_number', 'ASC']]
    });
    
    // We use the Serializer you added earlier!
    res.json(matches.map(MatchSerializer));
  } catch (error) {
    console.error("FETCH MATCHES ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   UNIVERSAL MATCH COMPLETION ENGINE
================================ */
/* ===============================
   ADMIN: COMPLETE MATCH & ADVANCE
================================ */
app.put("/admin/matches/:id/complete", async (req, res) => {
  try {
    const { team1_score, team2_score } = req.body;
    const match = await Match.findByPk(req.params.id);
    
    if (!match) return res.status(404).json({ error: "Match not found" });

    // 🌟 THE FIX: Force these into actual numbers so JavaScript math works properly!
    const s1_score = parseInt(team1_score) || 0;
    const s2_score = parseInt(team2_score) || 0;

    match.team1_score = s1_score;
    match.team2_score = s2_score;
    match.is_live = false;
    match.status = "Completed";

    // --- LEAGUE OR GROUP STAGE MATH ---
    if (match.match_type === "League" || match.match_type === "Group") {
      const isDraw = s1_score === s2_score;
      match.is_draw = isDraw;
      match.winner_id = isDraw ? null : (s1_score > s2_score ? match.team1_id : match.team2_id);

      // 🌟 FIXED: Use findOne so it grabs the exact existing standing row safely
      const standings1 = await Standings.findOne({ where: { TournamentId: match.TournamentId, TeamId: match.team1_id }});
      const standings2 = await Standings.findOne({ where: { TournamentId: match.TournamentId, TeamId: match.team2_id }});

      if (standings1 && standings2) {
          // Explicitly fallback to 0 before adding, preventing NaN errors
          standings1.matches_played = (standings1.matches_played || 0) + 1;
          standings1.goals_for = (standings1.goals_for || 0) + s1_score;
          standings1.goals_against = (standings1.goals_against || 0) + s2_score;
          
          standings2.matches_played = (standings2.matches_played || 0) + 1;
          standings2.goals_for = (standings2.goals_for || 0) + s2_score;
          standings2.goals_against = (standings2.goals_against || 0) + s1_score;

          if (isDraw) {
            standings1.draws = (standings1.draws || 0) + 1; 
            standings1.points = (standings1.points || 0) + 1;
            
            standings2.draws = (standings2.draws || 0) + 1; 
            standings2.points = (standings2.points || 0) + 1;
          } else if (s1_score > s2_score) {
            standings1.wins = (standings1.wins || 0) + 1; 
            standings1.points = (standings1.points || 0) + 3;
            
            standings2.losses = (standings2.losses || 0) + 1;
          } else {
            standings2.wins = (standings2.wins || 0) + 1; 
            standings2.points = (standings2.points || 0) + 3;
            
            standings1.losses = (standings1.losses || 0) + 1;
          }

          standings1.goal_difference = standings1.goals_for - standings1.goals_against;
          standings2.goal_difference = standings2.goals_for - standings2.goals_against;

          await standings1.save();
          await standings2.save();
      }
    } 
    // --- KNOCKOUT MATH (BRACKET ADVANCEMENT) ---
    else {
      if (s1_score === s2_score) return res.status(400).json({ error: "Knockout matches cannot end in a draw." });
      
      const winnerId = s1_score > s2_score ? match.team1_id : match.team2_id;
      match.winner_id = winnerId;

      // 🌟 THE AUTOMATION: Push winner to the linked next match
      if (match.next_match_id) {
        const nextMatch = await Match.findByPk(match.next_match_id);
        if (nextMatch) {
          // If Team 1 slot is empty, fill it. Otherwise, fill Team 2.
          if (!nextMatch.team1_id) {
            nextMatch.team1_id = winnerId;
          } else if (!nextMatch.team2_id) {
            nextMatch.team2_id = winnerId;
          }

          // 🌟 AUTO-UPDATE STATUS: If both teams are now present, it's ready for a referee!
          if (nextMatch.team1_id && nextMatch.team2_id) {
            nextMatch.status = "Pending Setup";
          }

          await nextMatch.save();
        }
      }
    }

    await match.save();
    res.json({ message: "Match completed and winner advanced!", match });
  } catch (error) {
    console.error("ADMIN COMPLETE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   MANAGER'S TOURNAMENT STATUS
================================ */
app.get("/manager/my-tournaments/:clubId", async (req, res) => {
  try {
    // 1. Find the manager's permanent team
    const team = await Team.findOne({ where: { club_id: req.params.clubId } });
    
    if (!team) {
      return res.json({ registrations: [], matches: [] });
    }

    // 2. Find all tournaments this team has registered for
    const registrations = await TournamentRegistration.findAll({
      where: { team_id: team.id },
      include: [
        { model: Tournament } // Attach the tournament details
      ],
      order: [['createdAt', 'DESC']]
    });

    // Note: Once the Admin "Generates Fixtures", we will fetch the 'Matches' table here 
    // to show exactly who they are playing. For now, we will return the registrations.

    res.json({ registrations });
  } catch (error) {
    console.error("MY TOURNAMENTS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   ADMIN: TOURNAMENT REGISTRATIONS
================================ */

// GET all tournament registrations
app.get("/admin/tournament-registrations", async (req, res) => {
  try {
    const registrations = await TournamentRegistration.findAll({
      include: [
        { model: Tournament },
        { 
          model: Team, 
          include: [
            { model: Club }, // To get the Manager/Club name
            { model: Player } // To map the roster IDs to actual player names
          ] 
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(registrations);
  } catch (error) {
    console.error("ADMIN FETCH REGISTRATIONS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE registration status (Approve/Reject)
app.put("/admin/tournament-registrations/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const registration = await TournamentRegistration.findByPk(req.params.id);
    
    if (!registration) {
      return res.status(404).json({ error: "Registration not found" });
    }

    registration.status = status;
    await registration.save();
    
    res.json({ message: `Registration ${status}`, registration });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
          club_id: manager.club_id, // 🌟 This will be null if they haven't set up a club
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

    const referee = await Referee.findOne({ where: { phone, mpin } });
    if (referee) {
      if (referee.status !== 'Active') {
        return res.status(403).json({ error: "Your account is currently inactive or suspended." });
      }
      return res.json({
        message: "Referee login successful",
        user: { id: referee.id, name: referee.name, role: "referee" },
      });
    }

    res.status(401).json({ error: "Invalid Phone or MPIN" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   THE MASTER FIXTURE GENERATOR
================================ */
app.post("/admin/tournaments/:id/generate-fixtures", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    
    // 1. Fetch Tournament & Approved Teams
    const tournament = await Tournament.findByPk(tournamentId);
    if (!tournament) return res.status(404).json({ error: "Tournament not found" });

    const registrations = await TournamentRegistration.findAll({
      where: { tournament_id: tournamentId, status: "Approved" },
      include: [{ model: Team }]
    });

    if (registrations.length < 2) {
      return res.status(400).json({ error: "Not enough approved teams to start." });
    }

    let teams = registrations.map(reg => reg.Team).sort(() => Math.random() - 0.5);
    
    // Clear any old data if regenerating
    await Match.destroy({ where: { TournamentId: tournamentId } });
    await Standings.destroy({ where: { TournamentId: tournamentId } });

    let matchesToCreate = [];
    const format = tournament.format; // 'Knockout', 'League', or 'Group Stages + Knockout'

    /* ---------------------------------------------------
       FORMAT 1: PURE KNOCKOUT
    --------------------------------------------------- */
    /* ---------------------------------------------------
       FORMAT 1: PURE KNOCKOUT (SMART DISTRIBUTION)
    --------------------------------------------------- */
    /* ---------------------------------------------------
       FORMAT 1: PURE KNOCKOUT (PERFECT BYES + STRICT ROUTING)
    --------------------------------------------------- */
    if (format === "Knockout") {
      const totalTeams = teams.length;
      
      // Find the next power of 2 (e.g., if 5 teams, next is 8)
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(totalTeams)));
      const totalRounds = Math.log2(nextPowerOf2);
      
      // Calculate how many byes we need
      const numByes = nextPowerOf2 - totalTeams;
      const numFirstRoundMatches = totalTeams - numByes; // Teams that actually play in Round 1
      
      // Separate teams into those playing Round 1 and those getting a Bye
      const playingTeams = teams.slice(0, numFirstRoundMatches);
      const byeTeams = teams.slice(numFirstRoundMatches);

      let matchCounter = 1;
      let previousRoundMatches = [];

      for (let r = 1; r <= totalRounds; r++) {
        const matchesInRound = nextPowerOf2 / Math.pow(2, r);
        let currentRoundMatches = [];
        let playingTeamIndex = 0;
        let byeTeamIndex = 0;

        for (let m = 0; m < matchesInRound; m++) {
           let team1_id = null;
           let team2_id = null;
           let t1_placeholder = null;
           let t2_placeholder = null;
           let status = "Pending TBD"; 

           if (r === 1) {
              // Distribute teams playing in Round 1
              if (playingTeamIndex < playingTeams.length) {
                team1_id = playingTeams[playingTeamIndex++]?.id || null;
              }
              if (playingTeamIndex < playingTeams.length) {
                team2_id = playingTeams[playingTeamIndex++]?.id || null;
              }
              
              // If we have teams, it's a real match ready for a ref
              if (team1_id && team2_id) {
                status = "Pending Setup";
              } 
              // If we ran out of playing teams, start distributing the Byes
              else if (!team1_id && !team2_id && byeTeamIndex < byeTeams.length) {
                 team1_id = byeTeams[byeTeamIndex++]?.id || null;
                 status = "Completed"; // It's a Bye, so they win instantly
              }
           } else {
              // Assign placeholders for Round 2+
              const sourceMatch1 = previousRoundMatches[m * 2];
              const sourceMatch2 = previousRoundMatches[m * 2 + 1];
              t1_placeholder = sourceMatch1 ? `Winner Match ${sourceMatch1.match_number}` : "TBD";
              t2_placeholder = sourceMatch2 ? `Winner Match ${sourceMatch2.match_number}` : "TBD";
           }

           let roundName = `Round ${r}`;
           if (r === totalRounds) roundName = "Final";
           else if (r === totalRounds - 1) roundName = "Semi-Final";
           else if (r === totalRounds - 2) roundName = "Quarter-Final";

           const newMatch = await Match.create({
              TournamentId: tournamentId,
              match_type: "Knockout",
              round_name: roundName,
              round_number: r,
              match_number: matchCounter++,
              team1_id,
              team2_id,
              team1_placeholder: t1_placeholder,
              team2_placeholder: t2_placeholder,
              winner_id: (status === "Completed") ? (team1_id || team2_id) : null, 
              status
           });
           currentRoundMatches.push(newMatch);
        }

        // Link winners to the next round
        if (r > 1) {
           for (let i = 0; i < previousRoundMatches.length; i++) {
              const nextMatchIndex = Math.floor(i / 2);
              const parentMatch = currentRoundMatches[nextMatchIndex];
              previousRoundMatches[i].next_match_id = parentMatch.id;
              await previousRoundMatches[i].save();

              // 🌟 STRICT AUTO-ADVANCE BYES
              // This instantly pushes the automatic winners forward to the correct slot!
              if (previousRoundMatches[i].status === "Completed") {
                  const winnerId = previousRoundMatches[i].winner_id;
                  
                  // STRICT ROUTING: Even index -> Top Slot, Odd index -> Bottom Slot
                  if (i % 2 === 0) {
                      parentMatch.team1_id = winnerId;
                  } else {
                      parentMatch.team2_id = winnerId;
                  }
                  
                  // If both teams arrived via Byes, make the match ready for a Ref
                  if (parentMatch.team1_id && parentMatch.team2_id) {
                      parentMatch.status = "Pending Setup";
                  }
                  await parentMatch.save();
              }
           }
        }
        previousRoundMatches = currentRoundMatches;
      }
    }
    /* ---------------------------------------------------
       FORMAT 2: LEAGUE (ROUND-ROBIN)
    --------------------------------------------------- */
    else if (format === "League") {
      // Initialize Standings
      await Standings.bulkCreate(teams.map(team => ({
        TournamentId: tournamentId, TeamId: team.id, group_name: null 
      })));

      // Circle Algorithm
      if (teams.length % 2 !== 0) teams.push({ id: null, name: "BYE" }); 
      
      const numTeams = teams.length;
      let matchCounter = 1;

      for (let round = 0; round < numTeams - 1; round++) {
        for (let match = 0; match < numTeams / 2; match++) {
          let home = (round + match) % (numTeams - 1);
          let away = (numTeams - 1 - match + round) % (numTeams - 1);
          if (match === 0) away = numTeams - 1; 

          const team1 = teams[home];
          const team2 = teams[away];

          if (team1.id !== null && team2.id !== null) {
            matchesToCreate.push({
              TournamentId: tournamentId,
              match_type: "League",
              round_name: `Matchday ${round + 1}`,
              round_number: round + 1,
              match_number: matchCounter++,
              team1_id: team1.id,
              team2_id: team2.id,
              status: "Pending Setup"
            });
          }
        }
      }
    } 
    
    /* ---------------------------------------------------
       FORMAT 3: GROUP STAGES + KNOCKOUT
    --------------------------------------------------- */
   else if (format === "Group Stages + Knockout") {
      // 1. Determine Groups (Aiming for 4 teams per group)
      const numGroups = Math.max(1, Math.floor(teams.length / 4)); 
      const groupNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      let groups = Array.from({ length: numGroups }, () => []);

      // 2. Snake-draft distribute teams
      teams.forEach((team, index) => {
        groups[index % numGroups].push(team);
      });

      let standingsData = [];
      let matchCounter = 1;
      let highestGroupRound = 0; // Track this so we can put KO rounds AFTER groups

      // 3. Process each group as a mini-league
      groups.forEach((groupTeams, groupIndex) => {
        const gName = groupNames[groupIndex];
        
        groupTeams.forEach(team => {
          standingsData.push({ TournamentId: tournamentId, TeamId: team.id, group_name: gName });
        });

        if (groupTeams.length % 2 !== 0) groupTeams.push({ id: null, name: "BYE" });
        const gNumTeams = groupTeams.length;

        for (let round = 0; round < gNumTeams - 1; round++) {
          if (round + 1 > highestGroupRound) highestGroupRound = round + 1;

          for (let match = 0; match < gNumTeams / 2; match++) {
            let home = (round + match) % (gNumTeams - 1);
            let away = (gNumTeams - 1 - match + round) % (gNumTeams - 1);
            if (match === 0) away = gNumTeams - 1;

            const t1 = groupTeams[home];
            const t2 = groupTeams[away];

            if (t1.id !== null && t2.id !== null) {
              matchesToCreate.push({
                TournamentId: tournamentId,
                match_type: "Group",
                group_name: gName,
                round_name: `Group ${gName} - MD ${round + 1}`,
                round_number: round + 1, // Will group them in UI columns correctly
                match_number: matchCounter++,
                team1_id: t1.id,
                team2_id: t2.id,
                status: "Pending Setup"
              });
            }
          }
        }
      });
      await Standings.bulkCreate(standingsData);

      // 4. 🌟 THE MAGIC: BUILD THE KNOCKOUT TREE MAP!
      // Top 2 from each group advance. 
      const advancingTeamsCount = numGroups * 2;
      const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(advancingTeamsCount)));
      const koRounds = Math.log2(nextPowerOf2);

      let previousRoundMatches = [];
      
      // Setup Placeholders for Round 1 of Knockouts (e.g., 1st Group A vs 2nd Group B)
      let koRound1Placeholders = [];
      for (let i = 0; i < numGroups; i += 2) {
          const g1 = groupNames[i];
          const g2 = groupNames[i+1] || groupNames[0]; // Cross matches
          koRound1Placeholders.push({ t1: `1st Group ${g1}`, t2: `2nd Group ${g2}` });
          koRound1Placeholders.push({ t1: `1st Group ${g2}`, t2: `2nd Group ${g1}` });
      }

      for (let r = 1; r <= koRounds; r++) {
         const matchesInRound = nextPowerOf2 / Math.pow(2, r);
         let currentRoundMatches = [];

         for (let m = 0; m < matchesInRound; m++) {
            let t1_placeholder = null;
            let t2_placeholder = null;

            if (r === 1 && koRound1Placeholders[m]) {
               t1_placeholder = koRound1Placeholders[m].t1;
               t2_placeholder = koRound1Placeholders[m].t2;
            }

            let roundName = `KO Round ${r}`;
            if (r === koRounds) roundName = "Final";
            else if (r === koRounds - 1) roundName = "Semi-Final";
            else if (r === koRounds - 2) roundName = "Quarter-Final";

            const newMatch = await Match.create({
               TournamentId: tournamentId,
               match_type: "Knockout", 
               round_name: roundName,
               // We add highestGroupRound so these columns appear to the right of the Group matches in your UI!
               round_number: highestGroupRound + r, 
               match_number: matchCounter++,
               team1_placeholder: t1_placeholder,
               team2_placeholder: t2_placeholder,
               status: "Pending TBD" // Waiting for group stage to finish!
            });

            currentRoundMatches.push(newMatch);
         }

         // Link the Knockout Tree
         if (r > 1) {
            for (let i = 0; i < previousRoundMatches.length; i++) {
               const nextMatchIndex = Math.floor(i / 2);
               previousRoundMatches[i].next_match_id = currentRoundMatches[nextMatchIndex].id;
               await previousRoundMatches[i].save();
            }
         }
         previousRoundMatches = currentRoundMatches;
      }
    }

    /* ---------------------------------------------------
       SAVE TO DATABASE
    --------------------------------------------------- */
    await Match.bulkCreate(matchesToCreate);

    await tournament.update({ status: "Ongoing" });

    res.json({ 
      message: `${format} fixtures generated successfully! Registrations are now closed.`, 
      matches_created: matchesToCreate.length 
    });

  } catch (error) {
    console.error("MASTER FIXTURE ENGINE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/admin/tournaments/:id/fixtures", async (req, res) => {
  try {
    const tournamentId = req.params.id;
    
    // Destroy all matches and standings for this tournament
    await Match.destroy({ where: { TournamentId: tournamentId } });
    await Standings.destroy({ where: { TournamentId: tournamentId } });

    res.json({ message: "Bracket has been completely reset!" });
  } catch (error) {
    console.error("RESET BRACKET ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   MANAGER CLUB SETUP WITH DRIVE
================================ */
app.post("/manager/setup-club-with-drive", upload.single("club_logo"), async (req, res) => {
  const { manager_id, name, city } = req.body;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "Club logo file is required" });
    }

    // 1. Upload Logo to Google Drive
    const logoUrl = await uploadToGoogleDrive(req.file);

    // 2. Create the Club Entry
    const newClub = await Club.create({
      name,
      city,
      logo_url: logoUrl
    });

    // 3. Link Club to the Manager
    const manager = await Manager.findByPk(manager_id);
    if (!manager) {
      return res.status(404).json({ error: "Manager account not found" });
    }

    await manager.update({ club_id: newClub.id });

    res.json({ 
      message: "Club successfully created and linked", 
      club_id: newClub.id 
    });

  } catch (error) {
    console.error("CLUB SETUP ERROR:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

/* ===============================
   PLAYER PROFILE (WITH FILE UPLOAD)
================================ */
/* ===============================
   DOCUMENT DUPLICATE CHECK
================================ */
app.get("/players/check-document", async (req, res) => {
  try {
    const { field, value } = req.query;

    if (!field || !value) {
      return res.status(400).json({ error: "Missing field or value" });
    }

    // Dynamically check either aadhaar_number or pan_number
    const query = {};
    query[field] = value;

    const existingPlayer = await Player.findOne({ where: query });

    if (existingPlayer) {
      return res.json({ exists: true });
    }

    res.json({ exists: false });

  } catch (error) {
    console.error("CHECK DOCUMENT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});


app.post(
  "/players/profile",
  upload.fields([
    { name: "player_photo", maxCount: 1 },
    { name: "gov_doc_1", maxCount: 1 },
    { name: "gov_doc_2", maxCount: 1 },
    { name: "gov_doc_3", maxCount: 1 },
    { name: "fitness_certificate", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      // 🌟 1. Extract Aadhaar and PAN along with the ID
      const { id, aadhaar_number, pan_number } = req.body;

      if (!id) {
        return res.status(400).json({ error: "Player ID required" });
      }

      const player = await Player.findByPk(id);

      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      /* ===============================
         🌟 STRICT BACKEND DUPLICATE CHECK 🌟
      ================================ */
      // Check if Aadhaar is already used by ANOTHER player
      if (aadhaar_number) {
        const existingAadhaar = await Player.findOne({
          where: {
            aadhaar_number: aadhaar_number,
            id: { [Sequelize.Op.ne]: id } // Ignore their own current record
          }
        });
        if (existingAadhaar) {
          return res.status(400).json({ error: "This Aadhaar number is already registered to another player." });
        }
      }

      // Check if PAN is already used by ANOTHER player
      if (pan_number) {
        const existingPan = await Player.findOne({
          where: {
            pan_number: pan_number,
            id: { [Sequelize.Op.ne]: id } // Ignore their own current record
          }
        });
        if (existingPan) {
          return res.status(400).json({ error: "This PAN number is already registered to another player." });
        }
      }

      /* ===============================
         HANDLE FILES SAFELY WITH DRIVE
      ================================ */

      // Load existing URLs just in case they are re-submitting without changing a file
      let photoUrl = player.player_photo_url;
      let govDoc1Url = player.gov_doc_1_url;
      let govDoc2Url = player.gov_doc_2_url;
      let govDoc3Url = player.gov_doc_3_url;
      let fitnessUrl = player.fitness_certificate_url;

      // Upload new files if they were attached
      if (req.files?.player_photo) {
        photoUrl = await uploadToGoogleDrive(req.files.player_photo[0]);
      }
      if (req.files?.gov_doc_1) {
        govDoc1Url = await uploadToGoogleDrive(req.files.gov_doc_1[0]);
      }
      if (req.files?.gov_doc_2) {
        govDoc2Url = await uploadToGoogleDrive(req.files.gov_doc_2[0]);
      }
      if (req.files?.gov_doc_3) {
        govDoc3Url = await uploadToGoogleDrive(req.files.gov_doc_3[0]);
      }
      if (req.files?.fitness_certificate) {
        fitnessUrl = await uploadToGoogleDrive(req.files.fitness_certificate[0]);
      }

      /* ===============================
         UPDATE PLAYER DATABASE
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
        pan_number: req.body.pan_number,

        position: req.body.position,
        strong_foot: req.body.strong_foot,
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

        // Save the new Drive URLs
        player_photo_url: photoUrl,
        gov_doc_1_url: govDoc1Url,
        gov_doc_2_url: govDoc2Url,
        gov_doc_3_url: govDoc3Url,
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
  }
);
/* ===============================
   GET PLAYER PROFILE (WITH CLUB NAME)
================================ */
app.get("/players/profile/:id", async (req, res) => {
  try {
    // 🌟 THE FIX: We added "include" to fetch the linked Club Name!
    const player = await Player.findByPk(req.params.id, {
        include: [{ model: Club, attributes: ['name'] }]
    });

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

    // 🌟 AUTOMATION: Auto-add to permanent team if status is set to "Registered"
    if (status === "Registered" && player.club_applied) {
        const team = await Team.findOne({ where: { club_id: player.club_applied } });
        
        if (team) {
            // Find highest jersey number to avoid conflicts
            const currentMax = await TeamPlayer.max('jersey_number', { where: { team_id: team.id } });
            const nextJersey = (currentMax || 0) + 1;

            await TeamPlayer.findOrCreate({
                where: { team_id: team.id, player_id: player.id },
                defaults: {
                    jersey_number: nextJersey,
                    assigned_position: player.position || "Reserve"
                }
            });
        }
    }

    res.json({ message: "Player status updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   COACH (MANAGER) MANAGEMENT ROUTES
================================ */

// 1. Create a New Coach
app.post("/admin/coaches", async (req, res) => {
  const { name, phone, mpin, club_id } = req.body;
  try {
    const newCoach = await Manager.create({
      name,
      phone,
      mpin,
      club_id: club_id || null // Coaches can be independent or assigned to a club
    });
    res.json(newCoach);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. View All Coaches
// GET All Coaches with their assigned Club details
app.get("/admin/coaches", async (req, res) => {
  try {
    const coaches = await Manager.findAll({
      // include the Club model so coach.Club is populated
      include: [{
        model: Club,
        attributes: ['id', 'name', 'city', 'logo_url'] 
      }]
    });
    res.json(coaches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all players with their club details
// GET all players with their club details
// Change app.post to app.get
app.get("/admin/players", async (req, res) => {
  try {
    const players = await Player.findAll({
      include: [{
        model: Club,
        attributes: ['name', 'logo_url']
      }]
    });
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   UNIFIED USER MANAGEMENT ROUTE
================================ */
app.get("/admin/users", async (req, res) => {
  try {
    // Fetch all categories simultaneously
    const [admins, managers, players] = await Promise.all([
      Admin.findAll({ attributes: ['id', 'name', 'phone'] }),
      Manager.findAll({ attributes: ['id', 'name', 'phone'] }),
      Player.findAll({ attributes: ['id', 'full_name', 'phone', 'status'] })
    ]);

    // Format them into a single list
    const allUsers = [
      ...admins.map(u => ({ id: `admin-${u.id}`, name: u.name, phone: u.phone, role: 'Admin', status: 'Active' })),
      ...managers.map(u => ({ id: `coach-${u.id}`, name: u.name, phone: u.phone, role: 'Manager', status: 'Active' })),
      ...players.map(u => ({ id: `player-${u.id}`, name: u.full_name, phone: u.phone, role: 'Player', status: u.status || 'Registered' }))
    ];

    res.json(allUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   DASHBOARD STATISTICS ROUTE
================================ */
app.get("/admin/dashboard-stats", async (req, res) => {
  try {
    const [totalPlayers, pendingApps, totalCoaches] = await Promise.all([
      Player.count(),
      Player.count({ where: { status: 'Recommended' } }),
      Manager.count()
    ]);

    const recentApplications = await Player.findAll({
      where: { status: 'Recommended' },
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{ model: Club, attributes: ['name'] }]
    });

    res.json({
      counts: {
        totalPlayers,
        pendingApps,
        activeCoaches: totalCoaches,
        activeTeams: 0 // Placeholder as requested
      },
      recentApplications
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Update a Coach (Edit)
app.put("/admin/coaches/:id", async (req, res) => {
  try {
    const coach = await Manager.findByPk(req.params.id);
    if (!coach) return res.status(404).json({ error: "Coach not found" });
    
    await coach.update(req.body);
    res.json({ message: "Coach updated successfully", coach });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete a Coach
app.delete("/admin/coaches/:id", async (req, res) => {
  try {
    const coach = await Manager.findByPk(req.params.id);
    if (!coach) return res.status(404).json({ error: "Coach not found" });

    await coach.destroy();
    res.json({ message: "Coach deleted successfully" });
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

/* ===============================
   NEW: EDIT AND DELETE QUESTIONS
================================ */

// UPDATE a specific question
app.put("/manager/questions/:id", async (req, res) => {
  try {
    const { question } = req.body;
    const questionId = req.params.id;

    const existingQuestion = await TrialQuestion.findByPk(questionId);
    if (!existingQuestion) {
      return res.status(404).json({ error: "Question not found" });
    }

    await existingQuestion.update({ question });
    res.json({ success: true, message: "Question updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a specific question
app.delete("/manager/questions/:id", async (req, res) => {
  try {
    const questionId = req.params.id;
    
    const existingQuestion = await TrialQuestion.findByPk(questionId);
    if (!existingQuestion) {
      return res.status(404).json({ error: "Question not found" });
    }

    await existingQuestion.destroy();
    res.json({ success: true, message: "Question deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/admin/approve-player", async (req, res) => {
  const { player_id } = req.body;

  try {
      const player = await Player.findByPk(player_id);

      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      player.status = "Registered";
      await player.save();

      // 🌟 AUTOMATION: Auto-add to permanent team on direct approval
      if (player.club_applied) {
          const team = await Team.findOne({ where: { club_id: player.club_applied } });
          
          if (team) {
              // Find highest jersey number to avoid conflicts
              const currentMax = await TeamPlayer.max('jersey_number', { where: { team_id: team.id } });
              const nextJersey = (currentMax || 0) + 1;

              await TeamPlayer.findOrCreate({
                  where: { team_id: team.id, player_id: player.id },
                  defaults: {
                      jersey_number: nextJersey,
                      assigned_position: player.position || "Reserve"
                  }
              });
          }
      }

      res.json({ message: "Player approved and added to team successfully" });
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});
/* ===============================
   PHONE AVAILABILITY CHECK
================================ */
/* ===============================
   PHONE AVAILABILITY CHECK (ALL ROLES)
================================ */
app.post("/auth/check-phone", async (req, res) => {
  const { phone } = req.body;
  try {
    // Check all three databases at the exact same time
    const [existingPlayer, existingManager, existingAdmin, existingReferee] = await Promise.all([
      Player.findOne({ where: { phone } }),
      Manager.findOne({ where: { phone } }),
      Admin.findOne({ where: { phone } }),
      Referee.findOne({ where: { phone } }) // 🌟 NEW
    ]);
    
    if (existingPlayer || existingManager || existingAdmin || existingReferee) {
      return res.status(400).json({ error: "This phone number is already registered to an account." });
    }
    
    // If it's completely new, give the green light
    res.json({ available: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   PERMANENT TEAM ROUTES
================================ */

// 1. Create a Team
app.post("/manager/team", async (req, res) => {
  const { club_id, name, jersey_color, roster } = req.body;

  try {
    // Prevent creating multiple permanent teams for the same club
    const existingTeam = await Team.findOne({ where: { club_id } });
    if (existingTeam) {
      return res.status(400).json({ error: "A permanent team already exists for this club." });
    }

    // Create the team
    const team = await Team.create({
      club_id,
      name,
      jersey_color,
      status: "Pending Approval"
    });

    // Add players to the team using the TeamPlayer junction table
    // The roster comes from frontend as: { playerId: { jerseyNumber: "10", assignedPosition: "Forward" } }
    for (const [playerId, details] of Object.entries(roster)) {
      await TeamPlayer.create({
        team_id: team.id,
        player_id: playerId,
        jersey_number: details.jerseyNumber,
        assigned_position: details.assignedPosition
      });
    }

    res.json({ message: "Team created successfully and sent for approval", team });
  } catch (error) {
    console.error("TEAM CREATION ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Get Team for a Club
app.get("/manager/team/:clubId", async (req, res) => {
  try {
    const team = await Team.findOne({
      where: { club_id: req.params.clubId },
      include: [{
        model: Player,
        // Include the junction table attributes we want
        through: { attributes: ['jersey_number', 'assigned_position'] }
      }]
    });

    if (!team) {
      return res.status(404).json({ error: "No team found" });
    }

    res.json(TeamSerializer(team));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// GET all teams for the Admin dashboard (WITH ROSTERS)
// GET all teams for the Admin dashboard
// GET all teams for the Admin dashboard (WITH FULL ROSTERS)
app.get("/admin/teams", async (req, res) => {
  try {
    const teams = await Team.findAll({
      include: [
        // 1. Fetch the Club info
        { 
            model: Club, 
            attributes: ['name', 'city'] 
        },
        // 2. Fetch the Players and their specific Jersey/Position for this team
        { 
            model: Player, 
            attributes: ['id', 'full_name', 'player_photo_url'],
            through: { attributes: ['jersey_number', 'assigned_position'] } 
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(teams);
  } catch (error) {
    console.error("Error fetching admin teams:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   ADMIN: EDIT MATCH TEAMS
================================ */
app.put("/admin/matches/:id/edit-teams", async (req, res) => {
  try {
    const { team1_id, team2_id } = req.body;
    const match = await Match.findByPk(req.params.id);
    
    if (!match) return res.status(404).json({ error: "Match not found" });

    // Update the teams (Allowing null if we want to change it back to TBD)
    match.team1_id = team1_id || null;
    match.team2_id = team2_id || null;
    
    // Automatically manage the status based on the teams
    if (match.status === "Pending TBD" && match.team1_id && match.team2_id) {
        match.status = "Pending Setup"; // Both teams exist, ready for a ref!
    } else if (match.status === "Pending Setup" && (!match.team1_id || !match.team2_id)) {
        match.status = "Pending TBD"; // Missing a team, waiting for one
    }

    await match.save();
    res.json({ message: "Match teams updated successfully!", match });
  } catch (error) {
    console.error("EDIT TEAMS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT route to approve a team
// PUT route to approve a permanent team
app.put("/admin/teams/:id/approve", async (req, res) => {
  try {
    const teamId = req.params.id;
    const team = await Team.findByPk(teamId);
    
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    // Update the team status to Approved
    team.status = "Approved";
    await team.save();

    res.json({ message: "Team officially approved for tournaments!" });
  } catch (error) {
    console.error("TEAM APPROVAL ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   GET TOURNAMENT STANDINGS
================================ */
app.get("/tournaments/:id/standings", async (req, res) => {
  try {
    const standings = await Standings.findAll({
      where: { TournamentId: req.params.id },
      include: [
        { model: Team, attributes: ['id', 'name'] }
      ],
      // OFFICIAL TIE-BREAKER LOGIC: 
      // 1. Highest Points
      // 2. Highest Goal Difference
      // 3. Highest Goals Scored
      order: [
        ['group_name', 'ASC'], // Groups A, B, C together
        ['points', 'DESC'], 
        ['goal_difference', 'DESC'], 
        ['goals_for', 'DESC']
      ]
    });

    res.json(standings.map(StandingsSerializer));
  } catch (error) {
    console.error("FETCH STANDINGS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   ADMIN: REFEREE MANAGEMENT
================================ */
app.get("/admin/referees", async (req, res) => {
  try {
    const referees = await Referee.findAll({ order: [['createdAt', 'DESC']] });
    res.json(referees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create Referee (With Photo Upload)
app.post("/admin/referees", upload.single("photo_file"), async (req, res) => {
  try {
    const { phone } = req.body;
    
    const existing = await Promise.all([
      Player.findOne({ where: { phone } }), Manager.findOne({ where: { phone } }),
      Admin.findOne({ where: { phone } }), Referee.findOne({ where: { phone } })
    ]);

    if (existing.some(user => user !== null)) {
      return res.status(400).json({ error: "Phone number already in use." });
    }

    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadToGoogleDrive(req.file);
    }

    const referee = await Referee.create({
      ...req.body,
      photo_url: photoUrl
    });

    res.json({ message: "Referee profile created!", referee });
  } catch (error) {
    console.error("REFEREE CREATE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/admin/referees", async (req, res) => {
  try {
    const referees = await Referee.findAll({ order: [['createdAt', 'DESC']] });
    res.json(referees.map(RefereeSerializer)); // 🌟 NEW: Cleanly serialized!
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Referee (With Optional Photo Update)
app.put("/admin/referees/:id", upload.single("photo_file"), async (req, res) => {
  try {
    const referee = await Referee.findByPk(req.params.id);
    if (!referee) return res.status(404).json({ error: "Referee not found" });

    let photoUrl = referee.photo_url;
    if (req.file) {
      photoUrl = await uploadToGoogleDrive(req.file);
    }

    await referee.update({
      ...req.body,
      photo_url: photoUrl
    });

    res.json({ message: "Referee profile updated!", referee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/admin/referees/:id", async (req, res) => {
  try {
    const referee = await Referee.findByPk(req.params.id);
    if (!referee) return res.status(404).json({ error: "Referee not found" });
    await referee.destroy();
    res.json({ message: "Referee deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   ADMIN: ASSIGN REFEREE TO MATCH
================================ */
app.put("/admin/matches/:id/assign-referee", async (req, res) => {
  try {
    const { referee_id, match_date, match_time, venue } = req.body;
    const match = await Match.findByPk(req.params.id);
    
    if (!match) return res.status(404).json({ error: "Match not found" });

    // Save the new schedule data
    match.referee_id = referee_id || null;
    match.match_date = match_date;
    match.match_time = match_time;
    match.venue = venue;
    
    // Upgrade status to Scheduled
    if (match.status === "Pending Setup" && match.referee_id !== null) {
        match.status = "Scheduled"; 
    }

    await match.save();
    res.json({ message: "Match scheduled and Referee successfully assigned", match });
  } catch (error) {
    console.error("ASSIGN REFEREE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   MANAGER: GET MY TEAM'S MATCHES
*/
/* ===============================
   MANAGER: GET TEAM'S MATCHES
================================ */
/* ===============================
   MANAGER: GET TEAM'S MATCHES
================================ */
app.get("/manager/teams/:id/matches", async (req, res) => {
  try {
    const teamId = req.params.id;
    const matches = await Match.findAll({
      where: {
        // 🌟 FIXED: Using Sequelize.Op.or directly so it NEVER crashes!
        [Sequelize.Op.or]: [
          { team1_id: teamId },
          { team2_id: teamId }
        ]
      },
      include: [
        { model: Team, as: 'Team1' },
        { model: Team, as: 'Team2' }
      ],
      order: [['round_number', 'ASC']]
    });
    
    res.json(matches.map(MatchSerializer)); 
  } catch (error) {
    console.error("TEAM MATCHES ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   REFEREE DASHBOARD ROUTES
================================ */

// 1. Get matches assigned to a specific referee (Include Teams & Players)
/* ===============================
    REFEREE DASHBOARD ROUTES (CLEANED & FIXED)
================================ */

// 1. Get matches assigned to a specific referee (Include Teams & Players)
// 1. Get matches assigned to a specific referee
app.get("/referee/:id/matches", async (req, res) => {
    try {
        const refereeId = req.params.id;
        
        // Handle "undefined" string coming from frontend
        if (!refereeId || refereeId === "undefined" || refereeId === "null") {
            return res.status(400).json({ error: "Valid Referee ID is required" });
        }

        const matches = await Match.findAll({
            where: { referee_id: refereeId },
            include: [
                { 
                    model: Team, as: 'Team1', 
                    include: [{ model: Player, as: 'Players' }] 
                },
                { 
                    model: Team, as: 'Team2',
                    include: [{ model: Player, as: 'Players' }] 
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        
        // Always return an array, even if empty
        res.json(matches || []);
    } catch (error) {
        console.error("REFEREE MATCHES ERROR:", error);
        // Ensure we send JSON even on failure
        res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});
/* ===============================
   ADMIN/REFEREE: TOGGLE LIVE STATUS
================================ */
app.put("/referee/matches/:id/toggle-live", async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });

    // Force the status to Live and boolean to true
    match.is_live = true;
    match.status = "Live";
    
    await match.save();
    res.json({ message: "Match is now Live!", match });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Submit Final Match Data & Save Events
/* ===============================
   REFEREE: COMPLETE MATCH & ADVANCE WINNER
================================ */
/* ===============================
   REFEREE: COMPLETE MATCH & ADVANCE WINNER
================================ */
/* ===============================
   REFEREE: COMPLETE MATCH & ADVANCE WINNER
================================ */
app.put("/referee/matches/:id/complete", async (req, res) => {
    try {
        const { team1_score, team2_score, match_events } = req.body;
        const match = await Match.findByPk(req.params.id);
        
        if (!match) return res.status(404).json({ error: "Match not found" });

        // 🌟 THE FIX: Force these into actual numbers so JavaScript math works properly!
        const s1_score = parseInt(team1_score) || 0;
        const s2_score = parseInt(team2_score) || 0;

        // 1. Save results for the current match
        match.team1_score = s1_score;
        match.team2_score = s2_score;
        match.status = 'Completed';
        
        // 🌟 THE FIX: Turn off the live broadcasting switch!
        match.is_live = false; 
        
        match.match_events = match_events;
        
        // --- LEAGUE OR GROUP STAGE MATH ---
        if (match.match_type === "League" || match.match_type === "Group") {
            const isDraw = s1_score === s2_score;
            match.is_draw = isDraw;
            match.winner_id = isDraw ? null : (s1_score > s2_score ? match.team1_id : match.team2_id);

            // Fetch the exact standings rows safely
            const standings1 = await Standings.findOne({ where: { TournamentId: match.TournamentId, TeamId: match.team1_id }});
            const standings2 = await Standings.findOne({ where: { TournamentId: match.TournamentId, TeamId: match.team2_id }});

            if (standings1 && standings2) {
                // Explicitly fallback to 0 before adding, preventing NaN errors
                standings1.matches_played = (standings1.matches_played || 0) + 1;
                standings1.goals_for = (standings1.goals_for || 0) + s1_score;
                standings1.goals_against = (standings1.goals_against || 0) + s2_score;
                
                standings2.matches_played = (standings2.matches_played || 0) + 1;
                standings2.goals_for = (standings2.goals_for || 0) + s2_score;
                standings2.goals_against = (standings2.goals_against || 0) + s1_score;

                // Points & Wins/Losses/Draws logic
                if (isDraw) {
                    standings1.draws = (standings1.draws || 0) + 1; 
                    standings1.points = (standings1.points || 0) + 1;
                    
                    standings2.draws = (standings2.draws || 0) + 1; 
                    standings2.points = (standings2.points || 0) + 1;
                } else if (s1_score > s2_score) {
                    standings1.wins = (standings1.wins || 0) + 1; 
                    standings1.points = (standings1.points || 0) + 3;
                    
                    standings2.losses = (standings2.losses || 0) + 1;
                } else {
                    standings2.wins = (standings2.wins || 0) + 1; 
                    standings2.points = (standings2.points || 0) + 3;
                    
                    standings1.losses = (standings1.losses || 0) + 1;
                }

                // Goal Difference
                standings1.goal_difference = standings1.goals_for - standings1.goals_against;
                standings2.goal_difference = standings2.goals_for - standings2.goals_against;

                await standings1.save();
                await standings2.save();
            }
        }
        // --- KNOCKOUT MATH (BRACKET ADVANCEMENT) ---
        else {
            if (s1_score === s2_score) return res.status(400).json({ error: "Knockout matches cannot end in a draw." });
            
            // Determine Winner
            const winnerId = s1_score > s2_score ? match.team1_id : match.team2_id;
            match.winner_id = winnerId;

            // 🌟 2. THE AUTOMATION: Push winner to the next round
            if (match.next_match_id) {
                const nextMatch = await Match.findByPk(match.next_match_id);
                
                if (nextMatch) {
                    // If it's the first winner arriving, they take the Team 1 slot
                    if (!nextMatch.team1_id) {
                        nextMatch.team1_id = winnerId;
                    } 
                    // If Team 1 is already taken, this winner takes the Team 2 slot
                    else if (!nextMatch.team2_id) {
                        nextMatch.team2_id = winnerId;
                    }

                    // If BOTH teams are now ready in the next match, set it to "Pending Setup"
                    if (nextMatch.team1_id && nextMatch.team2_id) {
                        nextMatch.status = "Pending Setup";
                    }

                    await nextMatch.save();
                }
            }
        }

        // Finally, save the current match updates
        await match.save();

        res.json({ 
            message: "Match completed and standings/bracket updated!", 
            match 
        });

    } catch (error) {
        console.error("MATCH COMPLETE ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

/* ===============================
   ADMIN: TOGGLE LIVE STATUS
================================ */
app.put("/admin/matches/:id/toggle-live", async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id);
    if (!match) return res.status(404).json({ error: "Match not found" });

    // Swap between Live and Scheduled
    match.is_live = !match.is_live;
    match.status = match.is_live ? "Live" : "Scheduled";
    await match.save();

    res.json({ message: "Live status updated", match });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   ADMIN: UPDATE LIVE SCORE 
================================ */
/* ===============================
   ADMIN: UPDATE LIVE SCORE & EVENTS
================================ */
app.put("/admin/matches/:id/update-score", async (req, res) => {
  try {
    const { team1_score, team2_score, match_events } = req.body;
    const match = await Match.findByPk(req.params.id);
    
    if (!match) return res.status(404).json({ error: "Match not found" });

    match.team1_score = parseInt(team1_score) || 0;
    match.team2_score = parseInt(team2_score) || 0;
    
    // 🌟 THE FIX: Save the timeline events to the database instantly!
    if (match_events) {
        match.match_events = JSON.stringify(match_events);
    }

    await match.save();
    res.json({ message: "Score and events updated", match });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   ADMIN: EDIT USER (SMART ROUTE)
================================ */
app.put("/admin/users/:id", async (req, res) => {
    try {
        const { id } = req.params; // Example: "player-5" or "coach-2"
        
        // Split the ID to find out which table to update
        const [rolePrefix, dbId] = id.split("-");

        if (rolePrefix === "player") {
            const player = await Player.findByPk(dbId);
            if (!player) return res.status(404).json({ error: "Player not found" });
            
            await player.update({
                full_name: req.body.name, // Players use full_name
                phone: req.body.phone,
                email: req.body.email,
                status: req.body.status   // Only Players have status right now
            });
        } 
        else if (rolePrefix === "coach") {
            const manager = await Manager.findByPk(dbId);
            if (!manager) return res.status(404).json({ error: "Manager not found" });
            
            await manager.update({
                name: req.body.name,
                phone: req.body.phone
            });
        } 
        else if (rolePrefix === "admin") {
            const admin = await Admin.findByPk(dbId);
            if (!admin) return res.status(404).json({ error: "Admin not found" });
            
            await admin.update({
                name: req.body.name,
                phone: req.body.phone
            });
        } 
        else {
            return res.status(400).json({ error: "Invalid user role identifier" });
        }

        res.json({ message: "User updated successfully" });
    } catch (error) {
        console.error("EDIT USER ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

/* ===============================
   ADMIN: DELETE USER (SMART ROUTE)
================================ */
app.delete("/admin/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const [rolePrefix, dbId] = id.split("-");

        if (rolePrefix === "player") {
            await Player.destroy({ where: { id: dbId } });
        } else if (rolePrefix === "coach") {
            await Manager.destroy({ where: { id: dbId } });
        } else if (rolePrefix === "admin") {
            await Admin.destroy({ where: { id: dbId } });
        } else {
            return res.status(400).json({ error: "Invalid user role identifier" });
        }

        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("DELETE USER ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});
/* ===============================
   PLAYER: GET PERSONAL STATS
================================ */
app.get("/players/:id/stats", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    
    // 1. Figure out how many matches their team has played overall
    const player = await Player.findByPk(playerId);
    let teamMatchesCount = 0;

    if (player && player.club_applied) {
        const team = await Team.findOne({ where: { club_id: player.club_applied } });
        if (team) {
            teamMatchesCount = await Match.count({
                where: {
                    status: 'Completed',
                    [Sequelize.Op.or]: [{ team1_id: team.id }, { team2_id: team.id }]
                }
            });
        }
    }

    // 2. Fetch all completed matches that actually have events
    const matches = await Match.findAll({
        where: {
            status: 'Completed',
            match_events: { [Sequelize.Op.not]: null }
        },
        include: [
            { model: Team, as: 'Team1', attributes: ['name'] },
            { model: Team, as: 'Team2', attributes: ['name'] }
        ]
    });

    let goals = 0;
    let yellowCards = 0;
    let redCards = 0;
    let playerEvents = [];

    // 3. Scan the JSON timeline of every match
    matches.forEach(match => {
        if (match.match_events) {
            try {
                // Parse the JSON string back into an array
                const events = typeof match.match_events === 'string' ? JSON.parse(match.match_events) : match.match_events;
                
                events.forEach(ev => {
                    // If the event belongs to THIS player, count it!
                    if (parseInt(ev.playerId) === playerId) {
                        if (ev.type === 'Goal') goals++;
                        if (ev.type === 'Yellow Card') yellowCards++;
                        if (ev.type === 'Red Card') redCards++;
                        
                        // 🌟 THE FIX: If match_date is missing, fallback to the date it was completed in the DB!
                        const displayDate = match.match_date ? match.match_date : new Date(match.updatedAt).toLocaleDateString();

                        // Save the event details to show on their timeline
                        playerEvents.push({
                            id: ev.id || Math.random(),
                            match_name: `${match.Team1?.name || 'TBD'} vs ${match.Team2?.name || 'TBD'}`,
                            minute: ev.minute,
                            type: ev.type,
                            date: displayDate
                        });
                    }
                });
            } catch (e) {
                console.error("Failed to parse match events", e);
            }
        }
    });

    // Sort events so the newest ones are at the top
    playerEvents = playerEvents.reverse();

    res.json({
        goals,
        yellowCards,
        redCards,
        matchesPlayed: teamMatchesCount, 
        recentEvents: playerEvents
    });

  } catch (error) {
    console.error("STATS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   PLAYER: GET UPCOMING MATCHES
================================ */
app.get("/players/:id/matches", async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    const player = await Player.findByPk(playerId);

    if (!player || !player.club_applied) {
        return res.json([]);
    }

    const team = await Team.findOne({ where: { club_id: player.club_applied } });
    if (!team) {
        return res.json([]);
    }

    const matches = await Match.findAll({
        where: {
            [Sequelize.Op.or]: [{ team1_id: team.id }, { team2_id: team.id }],
            status: { [Sequelize.Op.ne]: 'Completed' } // Only fetch matches that aren't finished
        },
        include: [
            { model: Team, as: 'Team1', attributes: ['name'] },
            { model: Team, as: 'Team2', attributes: ['name'] },
            { model: Tournament, attributes: ['name'] } // Attach the tournament name
        ],
        order: [['match_date', 'ASC'], ['match_number', 'ASC']]
    });

    res.json(matches.map(m => ({
        id: m.id,
        tournament_name: m.Tournament ? m.Tournament.name : 'Unknown Tournament',
        round_name: m.round_name,
        match_number: m.match_number,
        team1_name: m.Team1 ? m.Team1.name : (m.team1_placeholder || "TBD"),
        team2_name: m.Team2 ? m.Team2.name : (m.team2_placeholder || "TBD"),
        team1_id: m.team1_id,
        team2_id: m.team2_id,
        match_date: m.match_date,
        match_time: m.match_time,
        venue: m.venue,
        status: m.status
    })));
  } catch (error) {
    console.error("PLAYER MATCHES ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
/* ===============================
   PUBLIC MATCH ROUTES (FOR FRONTEND)
================================ */

// Get ALL matches for the Home Page slider
/* ===============================
   PUBLIC MATCH ROUTES (FOR FRONTEND)
================================ */
app.get("/matches", async (req, res) => {
  try {
    const matches = await Match.findAll({
      include: [
        { 
          model: Team, 
          as: 'Team1', 
          attributes: ['name'],
          // 🌟 THIS IS THE FIX: Fetch the logo from the connected Club
          include: [{ model: Club, attributes: ['logo_url'] }] 
        },
        { 
          model: Team, 
          as: 'Team2', 
          attributes: ['name'],
          // 🌟 THIS IS THE FIX: Fetch the logo from the connected Club
          include: [{ model: Club, attributes: ['logo_url'] }] 
        },
        { 
          model: Tournament, 
          attributes: ['name'] 
        }
      ],
      order: [['match_date', 'DESC']]
    });
    
    // We use the MatchSerializer to format this data perfectly for the frontend
    res.json(matches.map(MatchSerializer));
  } catch (error) {
    console.error("GET MATCHES ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get a SINGLE match for the Match Details Page
/* ===============================
   PUBLIC MATCH DETAILS ROUTE
================================ */
app.get("/matches/:id", async (req, res) => {
  try {
    const match = await Match.findByPk(req.params.id, {
      include: [
        { model: Team, as: 'Team1', attributes: ['name'] },
        { model: Team, as: 'Team2', attributes: ['name'] },
        { model: Tournament, attributes: ['name'] },
        // 🌟 FIXED: We are now explicitly asking the database for the Referee's data!
        { model: Referee, as: 'MatchReferee', attributes: ['full_name'] } 
      ]
    });

    if (!match) return res.status(404).json({ error: "Match not found" });

    // Use your existing serializer
    const serializedMatch = MatchSerializer(match);
    
    // Attach the parsed timeline events
    serializedMatch.match_events = match.match_events ? JSON.parse(match.match_events) : [];
    
    // Attach the tournament name
    serializedMatch.tournament_name = match.Tournament ? match.Tournament.name : 'Unknown Tournament';
    
    // 🌟 FIXED: Instead of hardcoding "Ref #1", we pull the actual name we requested above
    serializedMatch.referee_name = match.MatchReferee ? match.MatchReferee.full_name : "TBD";

    res.json(serializedMatch);
  } catch (error) {
    console.error("GET MATCH DETAILS ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
// 3. Edit an Existing Team
app.put("/manager/team/:id", async (req, res) => {
  const { name, jersey_color, roster } = req.body;
  
  try {
    const team = await Team.findByPk(req.params.id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    // 1. Update basic details and reset status to pending (because roster changed)
    await team.update({ 
        name, 
        jersey_color, 
        status: "Pending Approval" 
    });

    // 2. Wipe the old roster completely
    await TeamPlayer.destroy({ where: { team_id: team.id } });

    // 3. Insert the newly updated roster
    for (const [playerId, details] of Object.entries(roster)) {
      await TeamPlayer.create({
        team_id: team.id,
        player_id: playerId,
        jersey_number: details.jerseyNumber,
        assigned_position: details.assignedPosition
      });
    }

    res.json({ message: "Team updated and sent for re-approval successfully", team });
  } catch (error) {
    console.error("TEAM EDIT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete an Existing Team
app.delete("/manager/team/:id", async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    // Delete the team (and because of associations, it safely removes the roster mapping too)
    await team.destroy();
    
    // Just to be 100% clean, let's explicitly wipe the TeamPlayer entries
    await TeamPlayer.destroy({ where: { team_id: req.params.id } });

    res.json({ message: "Team completely deleted." });
  } catch (error) {
    console.error("TEAM DELETE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});
// 3. Edit an Existing Team
app.put("/manager/team/:id", async (req, res) => {
  const { name, jersey_color, roster } = req.body;
  
  try {
    const team = await Team.findByPk(req.params.id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    // 1. Update basic details and reset status to pending (because roster changed)
    await team.update({ 
        name, 
        jersey_color, 
        status: "Pending Approval" 
    });

    // 2. Wipe the old roster completely
    await TeamPlayer.destroy({ where: { team_id: team.id } });

    // 3. Insert the newly updated roster
    for (const [playerId, details] of Object.entries(roster)) {
      await TeamPlayer.create({
        team_id: team.id,
        player_id: playerId,
        jersey_number: details.jerseyNumber,
        assigned_position: details.assignedPosition
      });
    }

    res.json({ message: "Team updated and sent for re-approval successfully", team });
  } catch (error) {
    console.error("TEAM EDIT ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete an Existing Team
app.delete("/manager/team/:id", async (req, res) => {
  try {
    const team = await Team.findByPk(req.params.id);
    if (!team) return res.status(404).json({ error: "Team not found" });

    // Delete the team (and because of associations, it safely removes the roster mapping too)
    await team.destroy();
    
    // Just to be 100% clean, let's explicitly wipe the TeamPlayer entries
    await TeamPlayer.destroy({ where: { team_id: req.params.id } });

    res.json({ message: "Team completely deleted." });
  } catch (error) {
    console.error("TEAM DELETE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
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

sequelize.sync({alter:true}).then(() => {
  // create drive folder

  const PORT = process.env.PORT || 8080;
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
});
