/* ===== Backend (optional): set window.W2P_API_BASE in config.js ===== */
const API_BASE = String(window.W2P_API_BASE || "").replace(/\/$/, "");
const OWNER_KEY = "waste2power.ownerId.v1";
function ownerId() {
  try {
    let id = localStorage.getItem(OWNER_KEY);
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : "o" + Date.now() + Math.random().toString(16).slice(2)); localStorage.setItem(OWNER_KEY, id); }
    return id;
  } catch (_) { return "anonymous-device"; }
}
async function api(path, opts = {}) {
  const res = await fetch(API_BASE + path, { ...opts, headers: { "Content-Type": "application/json", "x-owner-id": ownerId(), ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
  return data;
}

/* ===== Simple demo sign-in: each name gets its own saved waste log ===== */
const USER_KEY = "waste2power.currentUser.v1";
function readUser() { try { return (localStorage.getItem(USER_KEY) || "").trim(); } catch (_) { return ""; } }
const currentUser = readUser();
const userSlug = currentUser.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const STORAGE_KEY = "waste2power.entries.v1" + (userSlug ? "." + userSlug : "");
const categoryInfo = {
  // Indicative Panipat market snapshots from public rate listings, checked 9 Oct 2026. These are NOT direct buyer quotes or auto-updating API data.
  "Organic": { emoji: "🍃", energy: 0.25, value: 0, rateLabel: "No resale rate listed", route: "Compost / biogas", advice: "Organic waste usually has no direct scrap resale value. Keep it separate for composting or check an authorised local biogas programme." },
  "Plastic": { emoji: "🧴", energy: 0.8, value: 14.15, rateLabel: "Indicative mixed-plastic market rate", route: "Plastic recycling", advice: "Empty, dry and sort plastic by resin type. This is an indicative Panipat market listing, not a guaranteed buyer offer. Ask the recycler for a quote before selling." },
  "Paper": { emoji: "📄", energy: 0.45, value: 7.35, rateLabel: "Indicative cardboard market rate", route: "Paper recycling", advice: "Keep paper and cardboard dry. The listed reference is for cardboard; newspaper and other paper grades can have different rates. Confirm the exact grade with a buyer." },
  "Metal": { emoji: "🥫", energy: 1.2, value: 36.65, rateLabel: "Iron scrap reference only", route: "Metal recycler", advice: "This reference rate is for iron scrap only—not aluminium, copper or other metals. Identify the metal and confirm the buyer's current rate before estimating payment." },
  "E-waste": { emoji: "🔋", energy: 0, value: 0, route: "Authorised e-waste handler", advice: "No resale amount is estimated for e-waste here. Do not dismantle batteries or electronics; contact an authorised handler to confirm their take-back terms." },
  "Other": { emoji: "🧺", energy: 0.1, value: 0, route: "Check local guidance", advice: "No selling value is estimated for mixed/unknown waste. Separate and identify it before contacting a buyer." }
};
const initialEntries = [
  { id: "seed-1", name: "Food scraps", category: "Organic", weight: 3.2, date: "Today" },
  { id: "seed-2", name: "Plastic bottles", category: "Plastic", weight: 2.5, date: "Today" },
  { id: "seed-3", name: "Paper & cardboard", category: "Paper", weight: 4.8, date: "Yesterday" },
  { id: "seed-4", name: "Aluminium cans", category: "Metal", weight: 2.0, date: "Yesterday" }
];
let entries = loadEntries();
let selectedImageUrl = null;
let selectedFile = null;
let toastTimer;

function loadEntries() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) { console.warn("Could not read local demo data", e); }
  return initialEntries.map(item => ({...item}));
}
function saveEntries() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
  catch (e) { showToast("Browser storage is unavailable. Changes may not persist."); }
}
function totalWeight() { return entries.reduce((sum, e) => sum + Number(e.weight || 0), 0); }
function energyFor(entry) { return Number(entry.weight || 0) * (categoryInfo[entry.category]?.energy ?? 0); }
function totalEnergy() { return entries.reduce((sum, e) => sum + energyFor(e), 0); }
// Only rigid plastic uses the listed plastic rate. Thin film and multilayer packaging usually have no reliable resale rate.
function rateFor(category, form) {
  const base = categoryInfo[category]?.value ?? 0;
  if (category === "Plastic" && (form === "film" || form === "multilayer")) return 0;
  return base;
}
function totalValue() { return entries.reduce((sum, e) => sum + Number(e.weight || 0) * rateFor(e.category, e.form), 0); }
function fmt(value, decimals=1) { return Number(value).toLocaleString("en-IN", {maximumFractionDigits:decimals, minimumFractionDigits:decimals}); }
function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}
const pageCopy = {
  dashboard: [currentUser ? `Hello, ${currentUser} 👋` : "Hello 👋", "Let's turn waste into a better tomorrow."],
  scan: ["Scan waste", "Add an item and get a responsible disposal suggestion."],
  waste: ["My waste", "Your recorded items, all in one place."],
  impact: ["Energy & impact", "Understand the potential value of better waste sorting."],
  route: ["Collection route", "A concept for smarter campus collection."],
  marketplace: ["Seller marketplace", "List recyclable waste and estimate its potential selling value."],
  ewaste: ["E-waste & recycling guide", "Small disposal choices can make a difference."],
  "clean-water": ["Clean Water", "Protect rivers, lakes and groundwater through responsible waste handling."],
  "save-energy": ["Save Energy", "Use energy thoughtfully and extend the life of useful products."],
  "healthy-soil": ["Healthy Soil", "Keep soil healthy by reducing litter and managing organic waste safely."],
  "fresh-air": ["Fresh Air", "Avoid open burning and choose safer waste collection and reuse options."]
};
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active-page", p.id === `page-${name}`));
  document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === name));
  const copy = pageCopy[name] || pageCopy.dashboard;
  document.getElementById("pageTitle").textContent = copy[0];
  document.getElementById("pageSubtitle").textContent = copy[1];
  document.getElementById("sidebar").classList.remove("open");
  if (name === "dashboard" || name === "waste" || name === "impact") renderAll();
  window.scrollTo({top:0, behavior:"smooth"});
}
document.querySelectorAll("[data-page]").forEach(el => el.addEventListener("click", event => {
  event.preventDefault();
  showPage(el.dataset.page);
}));
document.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => showPage(el.dataset.go)));
document.getElementById("mobileMenu").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("open"));

function renderAll() {
  const weight = totalWeight(), energy = totalEnergy(), value = totalValue();
  document.getElementById("statWaste").textContent = `${fmt(weight)} kg`;
  document.getElementById("statEnergy").textContent = `${fmt(energy)} kWh`;
  document.getElementById("statValue").textContent = `₹ ${Math.round(value).toLocaleString("en-IN")}`;
  document.getElementById("statEntries").textContent = entries.length;
  document.getElementById("donutTotal").textContent = fmt(weight);
  document.getElementById("impactEnergy").textContent = `${fmt(energy)} kWh`;
  document.getElementById("impactWaste").textContent = `${fmt(weight)} kg`;
  document.getElementById("impactValue").textContent = `₹ ${Math.round(value).toLocaleString("en-IN")}`;
  renderComposition();
  renderActivity();
  renderTable();
  renderBars();
  renderRecommendation();
}
function renderComposition() {
  const colors = {Organic:"#0fb77b",Plastic:"#4489ef",Paper:"#ffbf43",Metal:"#9561e8","E-waste":"#fa5961",Other:"#9caea8"};
  const order = Object.keys(categoryInfo);
  const total = totalWeight();
  let running = 0;
  const segments = [];
  const legend = [];
  order.forEach(cat => {
    const amount = entries.filter(e => e.category === cat).reduce((s,e)=>s+Number(e.weight||0),0);
    const pct = total ? amount / total * 100 : 0;
    segments.push(`${colors[cat]} ${running}% ${running + pct}%`);
    running += pct;
    if (amount > 0) legend.push(`<div class="legend-row"><i class="legend-dot" style="background:${colors[cat]}"></i><span>${cat}</span><b>${Math.round(pct)}%</b></div>`);
  });
  document.getElementById("donut").style.background = total ? `conic-gradient(${segments.join(",")})` : "#e7efea";
  document.getElementById("legend").innerHTML = legend.length ? legend.join("") : '<p class="form-hint">Add a waste entry to see your composition.</p>';
}
function renderActivity() {
  const target = document.getElementById("recentActivity");
  const latest = [...entries].slice(-4).reverse();
  target.innerHTML = latest.length ? latest.map(e => {
    const info = categoryInfo[e.category] || categoryInfo.Other;
    return `<div class="activity-item"><span class="activity-emoji">${info.emoji}</span><div class="activity-copy"><b>${safeText(e.name)}</b><small>${safeText(e.category)} · ${fmt(e.weight,2)} kg</small></div><span class="activity-time">${safeText(e.date || "Saved")}</span></div>`;
  }).join("") : '<p class="form-hint">No activity yet. Scan your first item.</p>';
}
function renderTable() {
  const target = document.getElementById("wasteTable");
  document.getElementById("tableCount").textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  target.innerHTML = entries.length ? [...entries].reverse().map(e => {
    const info = categoryInfo[e.category] || categoryInfo.Other;
    return `<tr><td><b>${safeText(info.emoji)} ${safeText(e.name)}</b><br><small>${safeText(e.date || "Saved")}</small></td><td><span class="category-pill">${safeText(e.category)}</span></td><td>${fmt(e.weight,2)} kg</td><td>${fmt(energyFor(e),2)} kWh</td><td>${safeText(info.route)}</td><td><button class="delete-btn" data-delete="${safeText(e.id)}" aria-label="Delete ${safeText(e.name)}">Delete</button></td></tr>`;
  }).join("") : '<tr><td colspan="6">No entries yet. Use Scan Waste to add your first item.</td></tr>';
  target.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => {
    entries = entries.filter(e => e.id !== button.dataset.delete);
    saveEntries(); renderAll(); showToast("Waste entry deleted.");
  }));
}
function renderBars() {
  const target = document.getElementById("barChart");
  const order = Object.keys(categoryInfo);
  const amounts = order.map(cat => ({cat, amount:entries.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.weight||0),0)}));
  const max = Math.max(1, ...amounts.map(x=>x.amount));
  target.innerHTML = amounts.map(x => `<div class="bar-row"><span>${safeText(x.cat)}</span><div class="bar-track"><div class="bar-fill" style="width:${x.amount/max*100}%"></div></div><span class="bar-value">${fmt(x.amount,2)} kg</span></div>`).join("");
}
function renderRecommendation() {
  const mostCommon = Object.keys(categoryInfo).map(cat => ({cat, amount:entries.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.weight||0),0)})).sort((a,b)=>b.amount-a.amount)[0];
  const cat = mostCommon && mostCommon.amount > 0 ? mostCommon.cat : "Organic";
  document.getElementById("recommendationTitle").textContent = cat === "E-waste" ? "Keep e-waste out of mixed bins" : `Prioritise ${cat.toLowerCase()} waste separation`;
  document.getElementById("recommendationText").textContent = categoryInfo[cat].advice;
}
function previewSelectedFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("Please choose a valid image file."); return; }
  if (file.size > 8 * 1024 * 1024) { showToast("Please choose an image smaller than 8 MB."); return; }
  if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
  selectedFile = file;
  selectedImageUrl = URL.createObjectURL(file);
  document.getElementById("imagePreview").src = selectedImageUrl;
  document.getElementById("previewWrap").classList.remove("hidden");
  document.getElementById("dropZone").classList.add("has-preview");
  if (typeof refreshAiButton === "function") refreshAiButton();
}
document.getElementById("imageInput").addEventListener("change", e => previewSelectedFile(e.target.files[0]));
document.getElementById("removeImage").addEventListener("click", () => {
  if (selectedImageUrl) URL.revokeObjectURL(selectedImageUrl);
  selectedImageUrl = null;
  selectedFile = null;
  document.getElementById("imageInput").value = "";
  if (typeof refreshAiButton === "function") refreshAiButton();
  document.getElementById("previewWrap").classList.add("hidden");
});
document.getElementById("analyzeBtn").addEventListener("click", () => {
  const category = document.getElementById("wasteCategory").value;
  const plasticForm = category === "Plastic" ? document.getElementById("plasticForm").value : undefined;
  const weight = Number(document.getElementById("wasteWeight").value);
  const description = document.getElementById("wasteDescription").value.trim();
  if (!Number.isFinite(weight) || weight <= 0 || weight > 10000) {
    showToast("Enter a weight greater than 0 and no more than 10,000 kg.");
    document.getElementById("wasteWeight").focus();
    return;
  }
  const info = categoryInfo[category];
  const name = description || ({"Organic":"Food waste","Plastic":"Plastic item","Paper":"Paper/cardboard","Metal":"Metal item","E-waste":"Electronic waste","Other":"Mixed waste"}[category]);
  const entry = {id: (crypto.randomUUID ? crypto.randomUUID() : `entry-${Date.now()}`), name, category, form: plasticForm, weight:Math.round(weight*100)/100, date:"Just now"};
  entries.push(entry);
  saveEntries();
  document.getElementById("emptyResult").classList.add("hidden");
  document.getElementById("resultContent").classList.remove("hidden");
  document.getElementById("resultEmoji").textContent = info.emoji;
  document.getElementById("resultCategory").textContent = category;
  document.getElementById("resultDescription").textContent = name;
  document.getElementById("resultWeight").textContent = `${fmt(weight,2)} kg`;
  document.getElementById("resultEnergy").textContent = `${fmt(energyFor(entry),2)} kWh`;
  const rate = rateFor(category, plasticForm);
  const estimatedMoney = Math.max(0, Number(weight) * Number(rate || 0));
  document.getElementById("resultMoney").textContent = `₹ ${fmt(estimatedMoney,2)}`;
  const hasPrice = estimatedMoney > 0;
  document.getElementById("priceBlock").classList.toggle("hidden", !hasPrice);
  document.getElementById("noPriceNote").classList.toggle("hidden", hasPrice);
  document.getElementById("noPriceFarm").classList.toggle("hidden", category !== "Organic");
  document.getElementById("resultRate").textContent = rate > 0 ? `${info.rateLabel || "Indicative market reference"}: ₹${fmt(rate,2)}/kg × ${fmt(weight,2)} kg` : (category === "Plastic" ? "Thin film and multilayer plastic usually has no reliable resale rate. Ask a recycler if they accept it." : "No selling value estimated for this category");
  document.getElementById("resultAdvice").textContent = info.advice;
  renderAll();
  showToast("Entry saved. Dashboard totals updated.");
});
document.getElementById("resetDemo").addEventListener("click", () => {
  entries = initialEntries.map(item => ({...item}));
  saveEntries(); renderAll(); showToast("Sample data restored.");
});
const MARKET_KEY = "waste2power.market.listings.v1";
function loadListings() {
  try { const x = JSON.parse(localStorage.getItem(MARKET_KEY) || "[]"); return Array.isArray(x) ? x : []; }
  catch (_) { return []; }
}
const sampleListings = [
  { id: "sample-l1", sample: true, category: "Plastic", form: "rigid", weight: 6, condition: "Clean and sorted", details: "Sample: washed PET water and soft-drink bottles.", contact: "sample@example.com", createdAt: "2026-10-09T08:00:00.000Z" },
  { id: "sample-l2", sample: true, category: "Paper", weight: 12, condition: "Compressed / bulk", details: "Sample: flattened cardboard boxes, dry.", contact: "sample@example.com", createdAt: "2026-10-09T09:00:00.000Z" }
];
let listings = loadListings();
try { if (localStorage.getItem(MARKET_KEY) === null) { listings = sampleListings.map(x => ({...x})); localStorage.setItem(MARKET_KEY, JSON.stringify(listings)); } } catch (_) { listings = sampleListings.map(x => ({...x})); }
const demoOffers = {
  Plastic: [{buyer:"Demo Recycler A",rate:14.2,pickup:"Pickup by arrangement"},{buyer:"Demo Recycler B",rate:12.5,pickup:"Seller drop-off"}],
  Paper: [{buyer:"Demo Paper Buyer A",rate:7.4,pickup:"Bulk quantity preferred"},{buyer:"Demo Paper Buyer B",rate:6.8,pickup:"Seller drop-off"}],
  Metal: [{buyer:"Demo Scrap Buyer A",rate:36.5,pickup:"Iron only; confirm grade"},{buyer:"Demo Scrap Buyer B",rate:32,pickup:"Seller drop-off"}]
};
function renderMarketplace() {
  const count = document.getElementById("listingCount");
  const target = document.getElementById("marketplaceListings");
  const offerTarget = document.getElementById("offerComparison");
  if (count) count.textContent = `${listings.length} ${listings.length === 1 ? "LISTING" : "LISTINGS"}`;
  if (target) target.innerHTML = listings.length ? [...listings].reverse().map(l => {
    const total = Number(l.weight) * Number(rateFor(l.category, l.form) || 0);
    const formLabel = l.category === "Plastic" && l.form ? ` · ${({rigid:"Rigid",film:"Thin film",multilayer:"Multilayer"}[l.form]||"")}` : "";
    return `<article class="recycler-card"><span class="recycler-type">${safeText(l.category.toUpperCase())}${safeText(formLabel)} · ${safeText(l.condition)}</span>${l.sample ? '<span class="sample-badge">SAMPLE</span>' : ""}<h4>${safeText(l.weight)} kg listed</h4><p>${safeText(l.details || "No extra details")}</p><p><b>Indicative estimate:</b> ${total > 0 ? "₹" + fmt(total,2) : "No reliable resale rate. Ask a recycler."}</p><p><b>Contact:</b> ${safeText(l.contact)}</p><small class="contact-note">${l.remote ? "Shared listing: visible to everyone using this app." : "Saved in this browser only. Listing is not public."}</small>${(l.remote ? l.mine : true) ? `<button class="btn btn-outline btn-small" data-remove-listing="${safeText(l.id)}">Delete listing</button>` : ""}</article>`;
  }).join("") : '<div class="empty-market">No seller listings yet. Add your first listing using the form.</div>';
  if (target) target.querySelectorAll("[data-remove-listing]").forEach(b => b.addEventListener("click", async () => {
    const id = b.dataset.removeListing;
    const l = listings.find(x => x.id === id);
    if (l && l.remote) {
      try { await api("/api/listings/" + encodeURIComponent(id), { method: "DELETE" }); }
      catch (e) { showToast(e.message || "Could not delete listing."); return; }
      listings = listings.filter(x => x.id !== id);
    } else {
      listings = listings.filter(x => x.id !== id);
      try { localStorage.setItem(MARKET_KEY, JSON.stringify(listings)); } catch (_) {}
    }
    renderMarketplace(); showToast("Listing deleted.");
  }));
  if (offerTarget) offerTarget.innerHTML = Object.entries(demoOffers).map(([cat,offers]) => `<article class="recycler-card"><h4>${safeText(cat)} — example offers</h4>${offers.map(o=>`<div class="market-rate-row"><span>${safeText(o.buyer)}<br><small>${safeText(o.pickup)}</small></span><b>₹${fmt(o.rate,2)}/kg</b></div>`).join("")}</article>`).join("");
}
const listingForm = document.getElementById("listingForm");
if (listingForm) listingForm.addEventListener("submit", async event => {
  event.preventDefault();
  const weight = Number(document.getElementById("listingWeight").value);
  const contact = document.getElementById("listingContact").value.trim();
  if (!(weight > 0) || !contact) { showToast("Enter a valid weight and contact method."); return; }
  const category = document.getElementById("listingCategory").value;
  const draft = {
    category,
    form: category === "Plastic" ? document.getElementById("listingPlasticForm").value : undefined,
    weight: Math.round(weight*100)/100,
    condition: document.getElementById("listingCondition").value,
    details: document.getElementById("listingDetails").value.trim(),
    contact
  };
  if (API_BASE) {
    try {
      const saved = await api("/api/listings", { method: "POST", body: JSON.stringify(draft) });
      listings.push({ ...saved, remote: true });
      listingForm.reset(); renderMarketplace(); showToast("Listing published.");
      return;
    } catch (e) { showToast((e.message || "Server unreachable") + " Saved on this device instead."); }
  }
  listings.push({ id: (crypto.randomUUID ? crypto.randomUUID() : `listing-${Date.now()}`), ...draft, createdAt: new Date().toISOString() });
  try { localStorage.setItem(MARKET_KEY, JSON.stringify(listings)); }
  catch (_) { showToast("Browser storage unavailable; listing may not persist."); }
  listingForm.reset(); renderMarketplace(); showToast("Demo listing saved on this device.");
});
const receiptForm = document.getElementById("receiptForm");
if (receiptForm) receiptForm.addEventListener("submit", event => {
  event.preventDefault();
  const material = document.getElementById("receiptMaterial").value;
  const weight = Number(document.getElementById("receiptWeight").value);
  const rate = Number(document.getElementById("receiptRate").value);
  const buyer = document.getElementById("receiptBuyer").value.trim();
  if (!(weight > 0) || !(rate >= 0) || !buyer) { showToast("Please check receipt details."); return; }
  const id = `W2P-${Date.now().toString().slice(-8)}`;
  const out = document.getElementById("receiptOutput");
  out.classList.remove("hidden");
  out.innerHTML = `<article class="recycler-card" id="receiptPrintable"><span class="recycler-type">WASTE2POWER · DEMO RECEIPT</span><h3>${id}</h3><p><b>Material:</b> ${safeText(material)}</p><p><b>Actual agreed weight:</b> ${fmt(weight,2)} kg</p><p><b>Agreed rate:</b> ₹${fmt(rate,2)}/kg</p><p><b>Total agreed amount:</b> ₹${fmt(weight*rate,2)}</p><p><b>Buyer:</b> ${safeText(buyer)}</p><p><b>Date:</b> ${new Date().toLocaleString("en-IN")}</p><small class="contact-note">Demo record only. This does not verify weight, buyer identity, delivery or payment.</small><button class="btn btn-outline btn-small" onclick="window.print()">Print / Save PDF</button></article>`;
  showToast("Demo receipt generated.");
});

/* ===== AI waste detection (Gemini) ===== */
const GEMINI_KEY_STORAGE = "waste2power.geminiKey.v1";
// Tried in order; if a model name is retired (404) the next one is used.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.0-flash"];
const AI_CATEGORIES = ["Organic", "Plastic", "Paper", "Metal", "E-waste", "Other"];

function getGeminiKey() { try { return localStorage.getItem(GEMINI_KEY_STORAGE) || ""; } catch (_) { return ""; } }
function setAiStatus(text, kind) {
  const el = document.getElementById("aiStatus");
  el.textContent = text;
  el.className = "ai-status" + (kind ? " " + kind : "");
}
function refreshAiButton() {
  const btn = document.getElementById("aiDetectBtn");
  if (!btn) return;
  btn.disabled = !selectedFile;
  const aiBox = document.getElementById("aiSettings");
  if (aiBox) aiBox.hidden = Boolean(API_BASE);
  if (!selectedFile) setAiStatus("Upload a photo first, then tap detect.");
  else if (!API_BASE && !getGeminiKey()) setAiStatus("Add your Gemini API key in AI settings below, then tap detect.");
  else setAiStatus("Photo ready. Tap detect.");
}
function fileToResizedBase64(file, maxSide = 1024) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image.")); };
    img.src = url;
  });
}
async function callGemini(model, key, base64) {
  const prompt = "You are a waste-sorting assistant. Look at the main waste item in the photo. " +
    "Return JSON only with keys: category (exactly one of Organic, Plastic, Paper, Metal, E-waste, Other), " +
    "item (short name, max 5 words), confidence (number 0 to 1), " +
    "plastic_form (only when category is Plastic: rigid for bottles, jugs, boxes, cups and caps; film for thin carry bags and sheets; multilayer for chips packets and foil-lined pouches; otherwise null). " +
    "Use E-waste for electronics and batteries. Use Other if unsure or mixed. If no waste item is visible, use Other with low confidence.";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: base64 } }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    })
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}
async function detectWithAi() {
  const key = getGeminiKey();
  if (!selectedFile) { setAiStatus("Upload a photo first.", "err"); return; }
  if (!API_BASE && !key) { document.getElementById("aiSettings").open = true; setAiStatus("Please add your Gemini API key first.", "err"); return; }
  const btn = document.getElementById("aiDetectBtn");
  btn.disabled = true;
  setAiStatus("Analysing photo with AI...", "busy");
  try {
    const base64 = await fileToResizedBase64(selectedFile);
    let result = null, lastErr = null;
    if (API_BASE) {
      try { result = await api("/api/detect", { method: "POST", body: JSON.stringify({ image: base64 }) }); }
      catch (e) { lastErr = e; }
    } else {
      for (const model of GEMINI_MODELS) {
        try { result = await callGemini(model, key, base64); break; }
        catch (e) { lastErr = e; if (e.status !== 404) break; }
      }
    }
    if (!result) throw lastErr || new Error("No result");
    const category = AI_CATEGORIES.includes(result.category) ? result.category : "Other";
    const item = String(result.item || "").replace(/[<>]/g, "").slice(0, 80);
    const conf = Math.round(Math.min(1, Math.max(0, Number(result.confidence) || 0)) * 100);
    document.getElementById("wasteCategory").value = category;
    if (item) document.getElementById("wasteDescription").value = item;
    if (category === "Plastic") {
      const f = ["rigid", "film", "multilayer"].includes(result.plastic_form) ? result.plastic_form : "rigid";
      document.getElementById("plasticForm").value = f;
    }
    syncPlasticField();
    const low = conf < 60 ? " Low confidence, please check it yourself." : " Please confirm before saving.";
    setAiStatus(`AI suggests: ${category}${item ? " (" + item + ")" : ""}, ${conf}% confident.${low}`, conf < 60 ? "err" : "ok");
  } catch (e) {
    const msg = API_BASE && (e.status === 400 || e.status === 403 || e.status === 503) ? (e.message || "AI is unavailable. Choose the category manually.")
      : e.status === 400 || e.status === 403 ? "The API key looks invalid or not allowed. Check it in AI settings."
      : e.status === 429 ? "Free quota reached. Wait a minute and try again."
      : e instanceof SyntaxError ? "AI reply was not readable. Try again."
      : "Could not reach the AI service. Check internet and try again. You can still choose the category manually.";
    setAiStatus(msg, "err");
  } finally {
    btn.disabled = !selectedFile;
  }
}
document.getElementById("aiDetectBtn").addEventListener("click", detectWithAi);
document.getElementById("saveKeyBtn").addEventListener("click", () => {
  const v = document.getElementById("geminiKey").value.trim();
  if (!v) { showToast("Paste your API key first."); return; }
  try { localStorage.setItem(GEMINI_KEY_STORAGE, v); } catch (_) { showToast("Browser storage unavailable."); return; }
  document.getElementById("geminiKey").value = "";
  showToast("API key saved in this browser.");
  refreshAiButton();
});
document.getElementById("clearKeyBtn").addEventListener("click", () => {
  try { localStorage.removeItem(GEMINI_KEY_STORAGE); } catch (_) {}
  showToast("API key removed.");
  refreshAiButton();
});
refreshAiButton();

/* ===== Plastic type selector ===== */
function syncPlasticField() {
  const isPlastic = document.getElementById("wasteCategory").value === "Plastic";
  document.getElementById("plasticFormField").classList.toggle("hidden", !isPlastic);
}
document.getElementById("wasteCategory").addEventListener("change", syncPlasticField);
syncPlasticField();

/* ===== Camera, drag and drop, impact line, marketplace plastic type ===== */
document.getElementById("cameraInput").addEventListener("change", e => previewSelectedFile(e.target.files[0]));
const dz = document.getElementById("dropZone");
["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("drag-over"); }));
["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("drag-over"); }));
dz.addEventListener("drop", e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) previewSelectedFile(f); });

function renderImpactLine() {
  const el = document.getElementById("impactLine");
  if (!el) return;
  const w = totalWeight();
  el.textContent = w > 0 ? `You have logged ${fmt(w)} kg of waste, about ${fmt(totalEnergy())} kWh of indicative energy and ₹${Math.round(totalValue()).toLocaleString("en-IN")} of estimated value.` : "Log your first item to see your impact.";
}
const _renderAllBase = renderAll;
renderAll = function () { _renderAllBase(); renderImpactLine(); };

function syncListingPlastic() {
  document.getElementById("listingPlasticField").classList.toggle("hidden", document.getElementById("listingCategory").value !== "Plastic");
}
document.getElementById("listingCategory").addEventListener("change", syncListingPlastic);
syncListingPlastic();

/* ===== First render (must stay last, after all declarations) ===== */
renderMarketplace();
renderAll();

/* ===== Signed-in profile display; name sign-in is handled in auth.js ===== */
(function initUserDisplay() {
  const avatar = document.getElementById("userAvatar");
  const logout = document.getElementById("logoutBtn");
  document.getElementById("pageTitle").textContent = pageCopy.dashboard[0];
  if (currentUser) {
    avatar.textContent = currentUser.charAt(0).toUpperCase();
    avatar.title = currentUser;
    logout.hidden = false;
  } else {
    avatar.textContent = "?";
    logout.hidden = true;
  }
  logout.addEventListener("click", () => window.dispatchEvent(new CustomEvent("w2p:signout")));
})();

/* Smart Repair & Recycle Finder: decision support, not an AI diagnosis */
(function initRepairFinder(){
  const device = document.getElementById('repairDevice');
  const problem = document.getElementById('repairProblem');
  const condition = document.getElementById('repairCondition');
  const output = document.getElementById('repairRecommendation');
  if (!device || !problem || !condition || !output) return;
  function updateAdvice(){
    let heading = 'Ask for a repair diagnosis first.';
    let body = 'Request a written estimate, parts details and repair warranty. Compare the total cost with the device value before deciding.';
    let places = 'For mobiles, contact a mobile repair shop; for computers, contact a laptop technician; for circuit boards, ask an electronics/PCB repair specialist.';
    if (condition.value === 'unsafe' || device.value === 'battery' || problem.value === 'battery') {
      heading = 'Safety first: do not charge, open or try to repair a damaged battery.';
      body = 'If a battery is swollen, leaking, unusually hot or damaged, stop using the device and keep it away from heat. Ask the manufacturer/service centre or an authorised e-waste handler for safe handling instructions.';
      places = 'Use the e-waste recycler contacts listed below; call first and explain the battery condition before transporting it.';
    } else if (condition.value === 'old') {
      heading = 'Compare repair cost with reuse or recycling.';
      body = 'Ask for a diagnosis and quote. If repair is uneconomical, check whether the device can be refurbished, donated after data removal, or sent to an authorised e-waste handler.';
      places = 'Try a relevant repair shop below for an estimate; if you decide not to repair it, contact one of the e-waste recyclers below.';
    } else if (device.value === 'charger') {
      heading = 'First check whether replacement is safer and cheaper.';
      body = 'Damaged chargers and cables can be unsafe. Do not use frayed, sparking or overheated accessories; replace them with compatible certified products or ask a qualified technician.';
      places = 'For damaged electronics, ask a qualified electronics shop whether it accepts the item; use the listed e-waste handlers for disposal.';
    } else if (device.value === 'laptop' && problem.value === 'slow') {
      heading = 'A software check or upgrade may help.';
      body = 'Back up important files first. Ask a technician to check storage, software and hardware before paying for parts.';
      places = 'See the laptop/computer repair contacts below.';
    } else if (device.value === 'tv' || device.value === 'other') {
      heading = 'Ask a technician who handles this device type.';
      body = 'Repairability depends on the fault, parts availability and inspection. Ask for a quote before approving repairs.';
      places = 'Call an electronics repair shop to confirm it handles your exact item; otherwise ask the recycler about accepted items.';
    }
    output.innerHTML = '<b>Recommended next step:</b> ' + safeText(heading) + '<br>' + safeText(body) + '<br><br><b>Where to go:</b> ' + safeText(places);
  }
  [device, problem, condition].forEach(el => el.addEventListener('change', updateAdvice));
  updateAdvice();
})();


/* Hindi audio guides for environmental learning pages. Uses the browser's built-in speech synthesis; internet/audio files are not required. */
(function initHindiAudioGuides() {
  const scripts = {
    "clean-water": "स्वच्छ पानी हमारे जीवन के लिए बहुत ज़रूरी है। हम पानी पीने, खाना बनाने, खेती करने और पेड़-पौधों तथा जीव-जंतुओं की मदद के लिए पानी पर निर्भर हैं। जब हम कचरा नालियों, नदियों या तालाबों में फेंकते हैं, तो बारिश उसे जल स्रोतों तक पहुँचा सकती है। बैटरियाँ, इलेक्ट्रॉनिक सामान, तेल और कुछ रसायन गलत तरीके से फेंके जाने पर पानी को दूषित कर सकते हैं। पानी बचाने और उसे साफ रखने के लिए कचरे को अलग-अलग रखें। प्लास्टिक की बोतल और थैली का बार-बार उपयोग करें, जहाँ संभव हो। तेल या रसायन नाली में न डालें। मोबाइल, चार्जर और बैटरी को सामान्य कूड़ेदान में न डालें; उन्हें सही संग्रह केंद्र या अधिकृत रिसाइक्लर तक पहुँचाएँ। याद रखें, साफ दिखाई देने वाला पानी हमेशा पीने योग्य नहीं होता। पानी की गुणवत्ता की जाँच ज़रूरी हो सकती है। छोटी आदतें, जैसे नल बंद रखना और कचरा सही जगह डालना, पानी की सुरक्षा में मदद करती हैं।",
    "save-energy": "ऊर्जा बचाने से बिजली की माँग और प्राकृतिक संसाधनों पर दबाव कम करने में मदद मिल सकती है। घर और कॉलेज में जब पंखा, लाइट या कोई उपकरण उपयोग में न हो, तो उसे बंद कर दें। मोबाइल और लैपटॉप में पावर सेविंग मोड का उपयोग करें और स्क्रीन की चमक ज़रूरत के अनुसार रखें। कोई इलेक्ट्रॉनिक सामान खराब हो जाए, तो तुरंत फेंकने के बजाय योग्य तकनीशियन से जाँच करवाएँ। अगर मरम्मत सुरक्षित और किफ़ायती है, तो उपकरण को दोबारा इस्तेमाल किया जा सकता है। काम करने वाले उपकरण किसी भरोसेमंद व्यक्ति को देने से पहले अपना निजी डेटा मिटा दें। जब उपकरण उपयोग के लायक न रहे, तो उसे अधिकृत ई-वेस्ट संग्रह केंद्र या रिसाइक्लर को दें। सही रिसाइक्लिंग से कुछ उपयोगी सामग्री वापस मिल सकती है और नए कच्चे माल की ज़रूरत घट सकती है। ध्यान दें, हर कचरे को जलाकर ऊर्जा बनाना सही नहीं है। खुले में कचरा जलाना खतरनाक हो सकता है। ऊर्जा बचाने की शुरुआत रोज़ की छोटी आदतों से होती है।",
    "healthy-soil": "स्वस्थ मिट्टी पौधों को बढ़ने में मदद करती है, पानी को सँभालती है और कई छोटे जीवों को रहने की जगह देती है। जब हम प्लास्टिक, बैटरी, इलेक्ट्रॉनिक सामान या रसायन खुले मैदान में फेंकते हैं, तो कुछ पदार्थ मिट्टी को दूषित कर सकते हैं। प्लास्टिक लंबे समय तक बना रह सकता है। इसलिए कचरे को शुरुआत से ही अलग-अलग रखना चाहिए। फल और सब्ज़ियों के छिलके तथा कुछ बगीचे का कचरा अलग इकट्ठा किया जा सकता है। सही तरीके से प्रबंधन करने पर ऐसे जैविक कचरे से खाद बनाई जा सकती है। लेकिन बैटरी, मोबाइल, चार्जर, तेल, पेंट और रसायनों को खाद में कभी न मिलाएँ। काँच, धातु और प्लास्टिक को भी जैविक कचरे से अलग रखें। जो सामान मरम्मत करके चल सकता है, उसे जल्दबाज़ी में न फेंकें। उपयोगी वस्तुओं की मरम्मत और दोबारा इस्तेमाल से कचरा कम हो सकता है। अपने घर और कॉलेज में कचरा सही डिब्बे में डालें और दूसरों को भी ऐसा करने के लिए प्रेरित करें। साफ मिट्टी भोजन, पौधों और पर्यावरण के लिए महत्वपूर्ण है।",
    "fresh-air": "ताज़ी और साफ हवा हमारे स्वास्थ्य, पेड़-पौधों और आसपास के वातावरण के लिए ज़रूरी है। हवा में धुआँ और प्रदूषण गाड़ियों, उद्योगों, धूल और कचरा जलाने से आ सकता है। प्लास्टिक, तार, बैटरी या इलेक्ट्रॉनिक सामान को खुले में जलाने से खतरनाक धुआँ निकल सकता है। इसलिए कचरे को कभी न जलाएँ और इलेक्ट्रॉनिक सामान को घर पर तोड़ने या गर्म करने की कोशिश न करें। जो उपकरण ठीक हो सकता है, उसकी मरम्मत करवाएँ। काम करने वाले सामान का दोबारा इस्तेमाल करें। खराब इलेक्ट्रॉनिक उपकरणों को अधिकृत ई-वेस्ट संग्रह केंद्र या रिसाइक्लर तक पहुँचाएँ। कचरे को सही डिब्बे में रखें और स्थानीय कलेक्शन नियमों का पालन करें। जहाँ सुरक्षित और व्यावहारिक हो, छोटी दूरी के लिए पैदल चलना, साइकिल चलाना या साझा वाहन का उपयोग करना मददगार हो सकता है। पेड़ और हरियाली छाया देते हैं तथा स्थानीय जीव-जंतुओं को सहारा देते हैं, लेकिन प्रदूषण को उसके स्रोत पर रोकना भी ज़रूरी है। अगर कहीं कचरा जल रहा हो या जहरीला धुआँ निकल रहा हो, तो उससे दूर रहें और संबंधित स्थानीय सेवा को सूचित करें। साफ हवा के लिए सबसे अच्छा कदम है—कचरा न जलाना, कम कचरा पैदा करना और सही तरीके से पुनः उपयोग तथा रिसाइक्लिंग करना।"
  };
  const status = document.querySelectorAll('.audio-guide-status');
  const stopButtons = document.querySelectorAll('.hindi-audio-stop');
  let active = false;
  let runId = 0;

  function setStatus(message) {
    status.forEach(el => el.textContent = message);
  }

  function showStopButtons(show) {
    stopButtons.forEach(button => button.hidden = !show);
  }

  function stopAudio(message = 'ऑडियो रोक दिया गया।') {
    runId++;
    active = false;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    showStopButtons(false);
    setStatus(message);
  }

  function waitForVoices() {
    return new Promise(resolve => {
      const synth = window.speechSynthesis;
      let voices = synth.getVoices();
      if (voices.length) return resolve(voices);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        synth.removeEventListener('voiceschanged', onChanged);
        resolve(synth.getVoices());
      };
      const onChanged = () => finish();
      synth.addEventListener('voiceschanged', onChanged);
      // Some Chrome/OS combinations do not fire voiceschanged reliably.
      window.setTimeout(finish, 1200);
    });
  }

  function splitHindiText(text, maxLength = 170) {
    // Short utterances are more reliable than one long Chrome utterance.
    const sentences = text.match(/[^।!?]+[।!?]?/g) || [text];
    const chunks = [];
    let current = '';
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      if ((current + ' ' + sentence).trim().length <= maxLength) {
        current = (current + ' ' + sentence).trim();
      } else {
        if (current) chunks.push(current);
        if (sentence.length <= maxLength) {
          current = sentence;
        } else {
          // Preserve words while splitting any unusually long sentence.
          const words = sentence.split(/\s+/);
          current = '';
          for (const word of words) {
            if ((current + ' ' + word).trim().length > maxLength && current) {
              chunks.push(current);
              current = word;
            } else current = (current + ' ' + word).trim();
          }
        }
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  function chooseHindiVoice(voices) {
    const hindi = voices.filter(voice => /^hi(?:[-_]|$)/i.test(voice.lang) || /hindi|हिन्दी|हिंदी/i.test(voice.name));
    // Prefer an explicitly Indian Hindi voice when several are installed.
    return hindi.find(voice => /hi[-_]IN/i.test(voice.lang)) || hindi[0] || null;
  }

  async function playHindiAudio(button) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
      setStatus('इस ब्राउज़र में टेक्स्ट-टू-स्पीच उपलब्ध नहीं है। Chrome को अपडेट करके फिर कोशिश करें।');
      return;
    }

    stopAudio('हिंदी आवाज़ जाँची जा रही है…');
    const thisRun = runId;
    const synth = window.speechSynthesis;
    const voices = await waitForVoices();
    if (thisRun !== runId) return;

    const hindiVoice = chooseHindiVoice(voices);
    if (!hindiVoice) {
      setStatus('इस डिवाइस पर Hindi voice नहीं मिली। सिस्टम की Speech/Accessibility settings में Hindi voice जोड़ें, फिर पेज reload करें।');
      showStopButtons(false);
      return;
    }

    const text = scripts[button.dataset.audio];
    if (!text) {
      setStatus('इस विषय का ऑडियो टेक्स्ट उपलब्ध नहीं है।');
      return;
    }

    synth.cancel();
    active = true;
    showStopButtons(true);
    setStatus('हिंदी में पढ़ा जा रहा है…');
    const chunks = splitHindiText(text);
    let index = 0;

    function speakNext() {
      if (!active || thisRun !== runId) return;
      if (index >= chunks.length) {
        active = false;
        showStopButtons(false);
        setStatus('ऑडियो पूरा हुआ।');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunks[index++]);
      utterance.lang = hindiVoice.lang || 'hi-IN';
      utterance.voice = hindiVoice;
      utterance.rate = 0.82;
      utterance.pitch = 1;
      utterance.onend = () => speakNext();
      utterance.onerror = event => {
        if (event.error === 'canceled' || event.error === 'interrupted') return;
        active = false;
        showStopButtons(false);
        setStatus('ऑडियो रुक गया। Chrome और सिस्टम की Hindi voice settings जाँचें, फिर दोबारा कोशिश करें।');
      };
      synth.speak(utterance);
    }
    speakNext();
  }

  document.querySelectorAll('.hindi-audio-btn').forEach(button => {
    button.addEventListener('click', () => { playHindiAudio(button); });
  });
  stopButtons.forEach(button => button.addEventListener('click', () => stopAudio()));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && active) stopAudio('टैब छिपने पर ऑडियो रोक दिया गया।');
  });
})();

/* ===== Google Maps search (Panipat recyclers) ===== */
// Keyless Google Maps search embed. The Embed API key is optional; if used, restrict it in Google Cloud.
// Never commit a private server/API key into a public hackathon repository.
const GOOGLE_MAPS_EMBED_KEY = "";
function googleMapEmbedUrl(q) {
  const enc = encodeURIComponent(q);
  return GOOGLE_MAPS_EMBED_KEY
    ? `https://www.google.com/maps/embed/v1/search?key=${encodeURIComponent(GOOGLE_MAPS_EMBED_KEY)}&q=${enc}&zoom=12`
    : `https://www.google.com/maps?q=${enc}&z=12&output=embed`;
}
function showOnGoogleMap(q) {
  const frame = document.getElementById("googleMap");
  if (!frame || !q) return;
  frame.src = googleMapEmbedUrl(q);
  const openLink = document.getElementById("googleMapOpen");
  if (openLink) openLink.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  document.querySelectorAll(".map-chip").forEach(b => b.classList.toggle("active", b.dataset.mapQ === q));
  frame.scrollIntoView({ behavior: "smooth", block: "center" });
}
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-map-q]");
  if (btn) showOnGoogleMap(btn.dataset.mapQ);
});
const initialMap = document.getElementById("googleMap");
if (initialMap) initialMap.src = googleMapEmbedUrl("recycling centre in Panipat Haryana");

/* ===== Clean up the old install-as-app files, if this browser still has them ===== */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
}
if ("caches" in window) {
  caches.keys().then(ks => ks.forEach(k => { if (k.startsWith("waste2power-")) caches.delete(k); })).catch(() => {});
}

/* ===== Eco score, badges, impact card and projection ===== */
const ECO_LEVELS = [
  { min: 0, name: "Seedling", emoji: "🌱" },
  { min: 50, name: "Sprout", emoji: "🌿" },
  { min: 150, name: "Green Guardian", emoji: "🛡️" },
  { min: 300, name: "Eco Hero", emoji: "🏆" },
  { min: 600, name: "Planet Champion", emoji: "🌍" }
];
function ecoPoints() { return Math.round(totalWeight() * 10 + entries.length * 5); }
function ecoLevelFor(points) {
  let idx = 0;
  ECO_LEVELS.forEach((l, i) => { if (points >= l.min) idx = i; });
  return { idx, level: ECO_LEVELS[idx], next: ECO_LEVELS[idx + 1] || null };
}
function weightOf(cat) { return entries.filter(e => e.category === cat).reduce((s, e) => s + Number(e.weight || 0), 0); }
function badgeList() {
  const kinds = new Set(entries.map(e => e.category)).size;
  return [
    { ico: "🌱", name: "First Scan", desc: "Log your first item", earned: entries.length >= 1 },
    { ico: "♻️", name: "10 kg Club", desc: "Track 10 kg of waste", earned: totalWeight() >= 10 },
    { ico: "🧴", name: "Plastic Pioneer", desc: "Log 2 kg of plastic", earned: weightOf("Plastic") >= 2 },
    { ico: "🍃", name: "Compost Champion", desc: "Log 3 kg of organic waste", earned: weightOf("Organic") >= 3 },
    { ico: "🔌", name: "E-Waste Responsible", desc: "Log an e-waste item", earned: weightOf("E-waste") > 0 },
    { ico: "🎯", name: "All-rounder", desc: "Log 4 different categories", earned: kinds >= 4 }
  ];
}
function renderEco() {
  if (!document.getElementById("ecoPoints")) return;
  const pts = ecoPoints();
  const { level, next } = ecoLevelFor(pts);
  document.getElementById("ecoPoints").textContent = pts.toLocaleString("en-IN");
  document.getElementById("ecoLevel").textContent = level.name;
  document.getElementById("ecoEmoji").textContent = level.emoji;
  const pct = next ? Math.min(100, ((pts - level.min) / (next.min - level.min)) * 100) : 100;
  document.getElementById("ecoBar").style.width = pct + "%";
  document.getElementById("ecoNext").textContent = next ? `${next.min - pts} points to ${next.name}` : "Top level reached";
  const badges = badgeList();
  document.getElementById("badgeCount").textContent = `${badges.filter(b => b.earned).length} of ${badges.length} earned`;
  document.getElementById("badgeGrid").innerHTML = badges.map(b =>
    `<div class="badge-item ${b.earned ? "earned" : ""}"><span class="b-ico">${b.ico}</span><div><b>${safeText(b.name)}</b><small>${safeText(b.desc)}</small></div></div>`
  ).join("");
}

function renderCalc() {
  if (!document.getElementById("calcPeople")) return;
  const people = Math.max(0, Number(document.getElementById("calcPeople").value) || 0);
  const kg = Math.max(0, Number(document.getElementById("calcKg").value) || 0);
  const part = Math.min(100, Math.max(0, Number(document.getElementById("calcPart").value) || 0));
  const w = totalWeight();
  const note = document.getElementById("calcNote");
  if (w <= 0) {
    ["calcWaste", "calcEnergy", "calcValue", "calcBulb"].forEach(id => document.getElementById(id).textContent = "-");
    note.textContent = "Log at least one waste item first. The projection uses the energy and value per kg from your own logged waste.";
    return;
  }
  const kgYear = people * kg * (part / 100) * 365;
  const energy = kgYear * (totalEnergy() / w);
  const value = kgYear * (totalValue() / w);
  const bulbYears = (energy * 100) / 8760; // 1 kWh runs a 10 W LED bulb for 100 hours
  document.getElementById("calcWaste").textContent = kgYear >= 1000 ? `${fmt(kgYear / 1000, 1)} tonnes` : `${fmt(kgYear, 0)} kg`;
  document.getElementById("calcEnergy").textContent = `${fmt(energy, 0)} kWh`;
  document.getElementById("calcValue").textContent = `₹ ${Math.round(value).toLocaleString("en-IN")}`;
  document.getElementById("calcBulb").textContent = bulbYears >= 1 ? `a 10 W LED bulb for ${fmt(bulbYears, 1)} years` : `a 10 W LED bulb for ${fmt(bulbYears * 365, 0)} days`;
  note.textContent = "Projection only. The inputs are your own assumptions, and the energy and value per kg come from the waste you have logged. It is not a measured result.";
}
["calcPeople", "calcKg", "calcPart"].forEach(id => document.getElementById(id)?.addEventListener("input", renderCalc));

function downloadImpactCard() {
  const W = 1080, H = 1350;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const x = cv.getContext("2d");
  const font = "Manrope, 'DM Sans', Arial, sans-serif";
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#032d26"); g.addColorStop(1, "#0b8c62");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W - 120, 140, 10, W - 120, 140, 460);
  glow.addColorStop(0, "rgba(99,237,139,.38)"); glow.addColorStop(1, "rgba(99,237,139,0)");
  x.fillStyle = glow; x.fillRect(0, 0, W, H);
  x.textBaseline = "alphabetic";
  x.fillStyle = "#63ed8b"; x.beginPath(); x.arc(110, 120, 44, 0, Math.PI * 2); x.fill();
  x.fillStyle = "#032d26"; x.font = `800 52px ${font}`; x.textAlign = "center"; x.fillText("ϟ", 110, 138);
  x.textAlign = "left"; x.fillStyle = "#fff"; x.font = `800 46px ${font}`; x.fillText("Waste2Power", 176, 134);
  const who = currentUser ? `${currentUser}'s impact` : "My impact";
  x.fillStyle = "#c9ecd9"; x.font = `600 34px ${font}`; x.fillText(who, 70, 290);
  const pts = ecoPoints(); const { level } = ecoLevelFor(pts);
  x.fillStyle = "#fff"; x.font = `800 84px ${font}`; x.fillText(`${level.emoji} ${level.name}`, 70, 400);
  x.fillStyle = "#63ed8b"; x.font = `700 40px ${font}`; x.fillText(`${pts.toLocaleString("en-IN")} eco points`, 70, 470);
  const stats = [
    [`${fmt(totalWeight(), 1)} kg`, "waste tracked"],
    [`${fmt(totalEnergy(), 1)} kWh`, "indicative energy potential"],
    [`₹ ${Math.round(totalValue()).toLocaleString("en-IN")}`, "indicative material value"]
  ];
  stats.forEach((s, i) => {
    const y = 560 + i * 190;
    x.fillStyle = "rgba(255,255,255,.1)"; x.beginPath(); x.roundRect(70, y, W - 140, 160, 28); x.fill();
    x.fillStyle = "#fff"; x.font = `800 72px ${font}`; x.fillText(s[0], 105, y + 88);
    x.fillStyle = "#c9ecd9"; x.font = `600 30px ${font}`; x.fillText(s[1], 105, y + 132);
  });
  const earned = badgeList().filter(b => b.earned);
  x.fillStyle = "#fff"; x.font = `700 34px ${font}`; x.fillText(`Badges: ${earned.map(b => b.ico).join(" ") || "none yet"}`, 70, 1190);
  x.fillStyle = "#c9ecd9"; x.font = `600 28px ${font}`; x.fillText("Less Waste. More Energy.", 70, 1260);
  x.fillStyle = "rgba(255,255,255,.65)"; x.font = `500 22px ${font}`; x.fillText("Indicative estimates from a hackathon prototype, not measured results.", 70, 1300);
  cv.toBlob(blob => {
    if (!blob) { showToast("Could not create the image."); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Waste2Power-impact-card.png";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast("Impact card downloaded.");
  }, "image/png");
}
document.getElementById("shareCardBtn")?.addEventListener("click", downloadImpactCard);

const _renderAllEco = renderAll;
renderAll = function () { _renderAllEco(); renderEco(); renderCalc(); };
renderAll();


/* ===== Load shared marketplace listings from the backend ===== */
async function loadRemoteListings() {
  if (!API_BASE) return;
  try {
    const remote = await api("/api/listings");
    const localOnly = listings.filter(l => !l.remote && !l.sample && !String(l.id).startsWith("sample-"));
    listings = [...remote.map(l => ({ ...l, remote: true })), ...localOnly];
    renderMarketplace();
  } catch (e) { console.warn("Backend listings unavailable, using local data", e); }
}
loadRemoteListings();
