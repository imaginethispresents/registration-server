const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Load the counters file
const COUNTERS_FILE = path.join(__dirname, "counters.json");

// Define your camps and limits
const CAMPS = {
  week1: { limit: 5 },
  week2: { limit: 24 },
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

// Endpoint to check limit
app.get("/check-limit/:camp", (req, res) => {
  const campName = req.params.camp;
  const camp = CAMPS[campName];

  if (!camp) {
    return res.status(404).json({ error: "Camp not found" });
  }

  const counters = readCounters();
  const count = counters[campName] || 0;

  res.json({
    full: count >= camp.limit,
    count,
    limit: camp.limit
  });
});

// Endpoint to increment count after submission
app.post("/register/:camp", express.json(), (req, res) => {
  const campName = req.params.camp;
  const camp = CAMPS[campName];

  if (!camp) {
    return res.status(404).json({ error: "Camp not found" });
  }

  const counters = readCounters();
  counters[campName] = (counters[campName] || 0) + 1;
  writeCounters(counters);

  res.json({ success: true, newCount: counters[campName] });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
