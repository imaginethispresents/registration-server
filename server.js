const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.urlencoded({ extended: true })); // needed for form POSTs
const PORT = process.env.PORT || 3000;

// ADMIN_KEY must be set as environment variable in Render
const ADMIN_KEY = process.env.ADMIN_KEY;

// Load the counters file
const COUNTERS_FILE = path.join(__dirname, "counters.json");

// Define your camps and limits
const CAMPS = {
  springweek1: { limit: 35 },
  springweek2: { limit: 35 },
  W20260411: { limit: 30 },	
  W20260523: { limit: 30 },	
  summerweek1: { limit: 35 },
  summerweek2: { limit: 35 },
  summerweek3: { limit: 35 },
  summerweek4: { limit: 35 }
};

// Optional: friendly display names
const CAMP_PRETTY_NAMES = {
  springweek1: "Spring Week 1",
  springweek2: "Spring Week 2",
  W20260411: "Workshop Apr 11",
  W20260523: "Workshop May 23",
  summerweek1: "Summer Week 1",
  summerweek2: "Summer Week 2",
  summerweek3: "Summer Week 3",
  summerweek4: "Summer Week 4"
};

// -----------------
// Helpers
// -----------------
function readCounters() {
  if (!fs.existsSync(COUNTERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(COUNTERS_FILE, "utf8"));
}

function writeCounters(counters) {
  fs.writeFileSync(COUNTERS_FILE, JSON.stringify(counters, null, 2));
}

// Auto-initialize any new camps to 0
function initializeCounters() {
  const counters = readCounters();
  let changed = false;
  for (const campName in CAMPS) {
    if (!(campName in counters)) {
      counters[campName] = 0;
      changed = true;
    }
  }
  if (changed) writeCounters(counters);
}

// -----------------
// Existing endpoints
// -----------------

app.get("/", (req, res) => res.send("Hello! I am awake."));

app.get("/check-limit/:camp", (req, res) => {
  const campName = req.params.camp;
  const camp = CAMPS[campName];
  if (!camp) return res.status(404).json({ error: "Camp not found" });

  const counters = readCounters();
  const count = counters[campName] || 0;

  res.json({ full: count >= camp.limit, count, limit: camp.limit });
});

app.post("/register/:camp", express.json(), (req, res) => {
  const campName = req.params.camp;
  const camp = CAMPS[campName];
  if (!camp) return res.status(404).json({ error: "Camp not found" });

  const counters = readCounters();
  counters[campName] = (counters[campName] || 0) + 1;
  writeCounters(counters);

  res.json({ success: true, newCount: counters[campName] });
});

// -----------------
// Status page
// -----------------
app.get("/status", (req, res) => {
  const counters = readCounters();
  let html = "<h1>Camp Registration Status</h1><ul>";
  for (const campName in CAMPS) {
    html += `<li><strong>${CAMP_PRETTY_NAMES[campName] || campName}</strong>: ${counters[campName] || 0} / ${CAMPS[campName].limit}</li>`;
  }
  html += "</ul>";
  res.send(html);
});

// -----------------
// Admin Dashboard (table layout)
// -----------------
app.get("/admin", (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_KEY) return res.status(403).send("Unauthorized");

  initializeCounters();
  const counters = readCounters();

  let html = `
    <h1>Admin Dashboard</h1>
    <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; font-family: sans-serif;">
      <thead style="background-color:#333; color:white;">
        <tr>
          <th>Program</th>
          <th>Count</th>
          <th>Limit</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const campName in CAMPS) {
    const count = counters[campName] || 0;
    const limit = CAMPS[campName].limit;

    // Color coding
    let color = "green";
    if (count >= limit) color = "red";
    else if (count >= limit * 0.8) color = "orange";

    const displayName = CAMP_PRETTY_NAMES[campName] || campName;

    html += `
      <tr>
        <td>${displayName}</td>
        <td style="font-weight:bold; color:${color};">${count}</td>
        <td>${limit}</td>
        <td>
          <form style="display:inline;" method="POST" action="/admin/add/${campName}?key=${ADMIN_KEY}">
            <button style="padding:3px 8px; margin-right:3px;" type="submit">+1</button>
          </form>
          <form style="display:inline;" method="POST" action="/admin/cancel/${campName}?key=${ADMIN_KEY}">
            <button style="padding:3px 8px; margin-right:3px;" type="submit">-1</button>
          </form>
          <form style="display:inline;" method="POST" action="/admin/set/${campName}?key=${ADMIN_KEY}">
            <input type="number" name="newCount" value="${count}" min="0" style="width:60px;" />
            <button style="padding:3px 8px;" type="submit">Set</button>
          </form>
        </td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  res.send(html);
});


// Admin +1
app.post("/admin/add/:camp", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");
  const campName = req.params.camp;
  if (!CAMPS[campName]) return res.status(404).send("Camp not found");

  const counters = readCounters();
  counters[campName] = (counters[campName] || 0) + 1;
  writeCounters(counters);

  res.redirect(`/admin?key=${ADMIN_KEY}`);
});

// Admin -1
app.post("/admin/cancel/:camp", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");
  const campName = req.params.camp;
  if (!CAMPS[campName]) return res.status(404).send("Camp not found");

  const counters = readCounters();
  counters[campName] = Math.max((counters[campName] || 0) - 1, 0);
  writeCounters(counters);

  res.redirect(`/admin?key=${ADMIN_KEY}`);
});

// Admin set to specific number
app.post("/admin/set/:camp", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Unauthorized");
  const campName = req.params.camp;
  if (!CAMPS[campName]) return res.status(404).send("Camp not found");

  const newCount = parseInt(req.body.newCount);
  if (isNaN(newCount) || newCount < 0) return res.status(400).send("Invalid number");

  const counters = readCounters();
  counters[campName] = newCount;
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
