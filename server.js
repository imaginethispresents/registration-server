const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());  
const PORT = process.env.PORT || 3000;

// ADMIN_KEY must be set as environment variable in Render
const ADMIN_KEY = process.env.ADMIN_KEY;

// Load the counters file
const COUNTERS_FILE = path.join(__dirname, "counters.json");

// Define your camps and limits
const CAMPS = {
  week1: { limit: 5 },
  springweek1: { limit: 35 },
  springweek2: { limit: 35 },
  W20260411: { limit: 30 },	
  W20260523: { limit: 30 },	
  summerweek1: { limit: 35 },
  summerweek2: { limit: 35 },
  summerweek3: { limit: 35 },
  summerweek4: { limit: 35 },
  summerA: { limit: 18 }
};

// Helper: read counters from file
function readCounters() {
  const data = fs.readFileSync(COUNTERS_FILE, "utf8");
  return JSON.parse(data);
}

// Helper: write counters to file
function writeCounters(counters) {
  fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2));
}

// -----------------
// Existing endpoints
// -----------------

// Check limit
app.get("/check-limit/:camp", (req, res) => {
  const campName = req.params.camp;
  const camp = CAMPS[campName];

  if (!camp) return res.status(404).json({ error: "Camp not found" });

  const counters = readCounters();
  const count = counters[campName] || 0;

  res.json({
    full: count >= camp.limit,
    count,
    limit: camp.limit
  });
});

// Register a new spot
app.post("/register/:camp", express.json(), (req, res) => {
  const campName = req.params.camp;
  const camp = CAMPS[campName];

  if (!camp) return res.status(404).json({ error: "Camp not found" });

  const counters = readCounters();
  counters[campName] = (counters[campName] || 0) + 1;
  writeCounters(counters);

  res.json({ success: true, newCount: counters[campName] });
});

// Simple root endpoint for keep-alive pings
app.get("/", (req, res) => {
  res.send("Hello! I am awake.");
});

// -----------------
// Status page
// -----------------
app.get("/status", (req, res) => {
  const counters = readCounters();

  let html = "<h1>Camp Registration Status</h1><ul>";
  for (const campName in CAMPS) {
    html += `<li><strong>${campName}</strong>: ${counters[campName] || 0} / ${CAMPS[campName].limit}</li>`;
  }
  html += "</ul>";

  res.send(html);
});

// -----------------
// Secure Admin Dashboard (with colors)
// -----------------
app.get("/admin", (req, res) => {
  const providedKey = req.query.key;
  if (providedKey !== ADMIN_KEY) return res.status(403).send("Unauthorized");

  const counters = readCounters();

  let html = `
    <h1>Registration Admin Dashboard</h1>
    <ul style="list-style:none; padding:0;">
  `;

  for (const campName in CAMPS) {
    const count = counters[campName] || 0;
    const limit = CAMPS[campName].limit;

    // Determine color
    let color = "green"; // plenty of spots
    if (count >= limit) color = "red"; // full
    else if (count >= limit * 0.8) color = "orange"; // almost full

    html += `
      <li style="margin-bottom: 10px;">
        <span style="font-weight:bold; color:${color};">${campName}: ${count} / ${limit}</span>
        <form style="display:inline;" method="POST" action="/admin/add/${campName}?key=${ADMIN_KEY}">
          <button type="submit">+1</button>
        </form>
        <form style="display:inline;" method="POST" action="/admin/cancel/${campName}?key=${ADMIN_KEY}">
          <button type="submit">-1</button>
        </form>
      </li>
    `;
  }

  html += "</ul>";
  res.send(html);
});


// Admin add one spot
app.post("/admin/add/:camp", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");

  const campName = req.params.camp;
  const camp = CAMPS[campName];
  if (!camp) return res.status(404).send("Camp not found");

  const counters = readCounters();
  counters[campName] = (counters[campName] || 0) + 1;
  writeCounters(counters);

  res.redirect(`/admin?key=${ADMIN_KEY}`);
});

// Admin cancel one spot
app.post("/admin/cancel/:camp", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");

  const campName = req.params.camp;
  const camp = CAMPS[campName];
  if (!camp) return res.status(404).send("Camp not found");

  const counters = readCounters();
  counters[campName] = Math.max((counters[campName] || 0) - 1, 0);
  writeCounters(counters);

  res.redirect(`/admin?key=${ADMIN_KEY}`);
});

// -----------------
// Self-ping to keep Render awake
// -----------------
const RENDER_URL = "https://registration-server-8udl.onrender.com/"; // Replace with your live Render URL
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  axios.get(RENDER_URL)
    .then(() => console.log("Self-ping successful!"))
    .catch(err => console.log("Self-ping failed:", err.message));
}, PING_INTERVAL);

// -----------------
// Start server
// -----------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
