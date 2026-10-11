// Waste2Power backend (Express). Deploy on Render.
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

try { process.loadEnvFile && fs.existsSync(".env") && process.loadEnvFile(".env"); } catch (_) {}

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODELS = (process.env.GEMINI_MODELS || "gemini-2.5-flash,gemini-2.0-flash")
  .split(",").map(s => s.trim()).filter(Boolean);
const ALLOWED = (process.env.ALLOWED_ORIGINS || "*").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean);

const CATEGORIES = ["Organic", "Plastic", "Paper", "Metal", "E-waste", "Other"];
const PLASTIC_FORMS = ["rigid", "film", "multilayer"];

const app = express();
app.set("trust proxy", 1);
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED.includes("*") || ALLOWED.includes(origin)) return cb(null, true);
    cb(new Error("Origin not allowed by CORS"));
  },
  allowedHeaders: ["Content-Type", "x-owner-id"]
}));
app.use(express.json({ limit: "4mb" }));

// ---- tiny in-memory rate limiter (no extra dependency) ----
function rateLimit(max, windowMs) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();
  return (req, res, next) => {
    const n = (hits.get(req.ip) || 0) + 1;
    hits.set(req.ip, n);
    if (n > max) return res.status(429).json({ error: "Too many requests. Please wait a minute." });
    next();
  };
}

// ---- health ----
app.get("/", (_req, res) => res.json({ name: "Waste2Power API", ok: true }));
app.get("/api/health", (_req, res) => res.json({ ok: true, ai: Boolean(GEMINI_API_KEY), time: new Date().toISOString() }));

// ---- AI detection (key stays on the server) ----
async function callGemini(model, base64) {
  const prompt = "You are a waste-sorting assistant. Look at the main waste item in the photo. " +
    "Return JSON only with keys: category (exactly one of Organic, Plastic, Paper, Metal, E-waste, Other), " +
    "item (short name, max 5 words), confidence (number 0 to 1), " +
    "plastic_form (only when category is Plastic: rigid for bottles, jugs, boxes, cups and caps; film for thin carry bags and sheets; multilayer for chips packets and foil-lined pouches; otherwise null). " +
    "Use E-waste for electronics and batteries. Use Other if unsure or mixed. If no waste item is visible, use Other with low confidence.";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    })
  });
  if (!r.ok) { const e = new Error(`Gemini HTTP ${r.status}`); e.status = r.status; throw e; }
  const data = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

app.post("/api/detect", rateLimit(20, 60_000), async (req, res) => {
  if (!GEMINI_API_KEY) return res.status(503).json({ error: "AI is not configured on the server." });
  const image = req.body && req.body.image;
  if (typeof image !== "string" || image.length < 100 || image.length > 3_500_000 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: "Send a base64 JPEG in the 'image' field (without the data: prefix)." });
  }
  let result = null, lastErr = null;
  for (const model of GEMINI_MODELS) {
    try { result = await callGemini(model, image); break; }
    catch (e) { lastErr = e; if (e.status !== 404) break; }
  }
  if (!result) {
    const status = lastErr && lastErr.status === 429 ? 429 : lastErr instanceof SyntaxError ? 502 : 502;
    return res.status(status).json({ error: status === 429 ? "AI quota reached. Try again in a minute." : "AI service failed. Choose the category manually." });
  }
  const category = CATEGORIES.includes(result.category) ? result.category : "Other";
  res.json({
    category,
    item: String(result.item || "").replace(/[<>]/g, "").slice(0, 80),
    confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0)),
    plastic_form: category === "Plastic" ? (PLASTIC_FORMS.includes(result.plastic_form) ? result.plastic_form : "rigid") : null
  });
});

// ---- marketplace listings (JSON file store) ----
// NOTE: Render's free disk is wiped on every redeploy/restart. For permanent data, swap this
// block for MongoDB Atlas / Supabase / Render Postgres (see DEPLOY_GUIDE.md).
// Vercel only allows writing to /tmp (and it is wiped often), so use it there.
const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/w2p-data" : path.join(__dirname, "data"));
const DATA_FILE = path.join(DATA_DIR, "listings.json");
const SAMPLES = [
  { id: "sample-l1", sample: true, category: "Plastic", form: "rigid", weight: 6, condition: "Clean and sorted", details: "Sample: washed PET water and soft-drink bottles.", contact: "sample@example.com", createdAt: "2026-10-09T08:00:00.000Z" },
  { id: "sample-l2", sample: true, category: "Paper", weight: 12, condition: "Compressed / bulk", details: "Sample: flattened cardboard boxes, dry.", contact: "sample@example.com", createdAt: "2026-10-09T09:00:00.000Z" }
];
function readListings() {
  try { const x = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); if (Array.isArray(x)) return x; } catch (_) {}
  return SAMPLES.map(s => ({ ...s }));
}
function writeListings(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(list));
  fs.renameSync(tmp, DATA_FILE);
}
const clean = (v, max) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
const ownerOf = req => clean(req.get("x-owner-id"), 80);
const publicView = (l, owner) => { const { ownerId, ...rest } = l; return { ...rest, mine: Boolean(owner && ownerId === owner) }; };

app.get("/api/listings", (req, res) => {
  const owner = ownerOf(req);
  res.json(readListings().map(l => publicView(l, owner)));
});

app.post("/api/listings", rateLimit(15, 60_000), (req, res) => {
  const owner = ownerOf(req);
  if (owner.length < 8) return res.status(400).json({ error: "Missing x-owner-id header." });
  const b = req.body || {};
  const weight = Math.round(Number(b.weight) * 100) / 100;
  const category = b.category;
  const contact = clean(b.contact, 120);
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: "Invalid category." });
  if (!(weight > 0 && weight <= 100000)) return res.status(400).json({ error: "Weight must be between 0 and 100000 kg." });
  if (contact.length < 3) return res.status(400).json({ error: "Contact is required." });
  const list = readListings();
  if (list.length >= 500) return res.status(507).json({ error: "Marketplace is full." });
  const item = {
    id: crypto.randomUUID(),
    ownerId: owner,
    category,
    form: category === "Plastic" && PLASTIC_FORMS.includes(b.form) ? b.form : undefined,
    weight,
    condition: clean(b.condition, 80),
    details: clean(b.details, 500),
    contact,
    createdAt: new Date().toISOString()
  };
  list.push(item);
  writeListings(list);
  res.status(201).json(publicView(item, owner));
});

app.delete("/api/listings/:id", (req, res) => {
  const owner = ownerOf(req);
  const list = readListings();
  const item = list.find(l => l.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Listing not found." });
  if (item.sample || !owner || item.ownerId !== owner) return res.status(403).json({ error: "You can only delete your own listings." });
  writeListings(list.filter(l => l.id !== item.id));
  res.json({ ok: true });
});

// ---- errors ----
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  if (err && err.message === "Origin not allowed by CORS") return res.status(403).json({ error: err.message });
  if (err && err.type === "entity.too.large") return res.status(413).json({ error: "Image too large." });
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

// Render / local: start the server. Vercel: the app is exported and run as a serverless function.
if (require.main === module) {
  app.listen(PORT, () => console.log(`Waste2Power API listening on ${PORT} (AI ${GEMINI_API_KEY ? "on" : "off"})`));
}
module.exports = app;
