require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');

const app = express();

// Set up the client using your exact .env credentials
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  "http://localhost:3000/oauth2callback" 
);

app.get('/', (req, res) => {
  // Generate the secure Google Login link
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // THIS FORCES A NEW REFRESH TOKEN
    scope: ['https://www.googleapis.com/auth/drive'],
    prompt: 'consent' 
  });
  res.send(`<h2>Google Drive Token Generator</h2><a href="${url}" style="font-size: 20px; color: blue;">Click here to Authorize</a>`);
});

app.get('/oauth2callback', async (req, res) => {
  try {
    // Exchange the code for the actual tokens
    const { tokens } = await oauth2Client.getToken(req.query.code);
    
    console.log('\n\n✅ SUCCESS! COPY THE REFRESH TOKEN BELOW:\n');
    console.log('==================================================');
    console.log(tokens.refresh_token);
    console.log('==================================================\n\n');
    
    res.send('<h1>Success!</h1><p>Check your VS Code / Terminal for the refresh token. You can close this window now.</p>');
    
    // Auto-close the mini server
    setTimeout(() => process.exit(0), 1000);
  } catch (err) {
    res.send('Error: ' + err.message);
  }
});

app.listen(3000, () => {
  console.log('🚀 Mini Token Server running! Open your browser and go to: http://localhost:3000');
});