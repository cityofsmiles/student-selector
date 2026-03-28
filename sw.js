// Configuration
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9nE9pp-Lk2y4nS7WFocx5P8tW2pJjw6m9t95n78accs0-9GymgaoG3d0Mfg4hiS8x3LFoYhkqVS7C/pub?output=csv";

// State Management
let master = {}; // The full list from Google Sheets
let history = JSON.parse(localStorage.getItem("selector_history")) || []; // Last 5 picks

/**
 * 1. DATA SYNCHRONIZATION
 * Fetches the published CSV from Google Sheets and parses it by Section (Column C).
 */
async function loadFromSheets() {
  const status = document.getElementById('status');
  if (status) status.textContent = "Syncing...";

  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const rows = text.split('\n').slice(1); // Skip Header Row

    master = {}; // Clear current memory
    rows.forEach(r => {
      // Split by comma and remove quotes/extra spaces
      const c = r.split(',').map(v => v.replace(/"/g, "").trim());
      if (c.length >= 3) {
        const fullName = `${c[1]} ${c[0]}`; // "First Last"
        const sectionName = c[2];
        if (!master[sectionName]) master[sectionName] = [];
        master[sectionName].push(fullName);
      }
    });

    // Save master lists to localStorage for offline fallback
    Object.keys(master).forEach(k => {
      localStorage.setItem(k + "_m", JSON.stringify(master[k]));
    });

    render();
    if (status) status.textContent = "Synced: " + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  } catch (e) {
    console.warn("Offline: Loading from LocalStorage");
    loadLocal();
  }
}

/**
 * 2. OFFLINE FALLBACK
 * Loads the last successful sync data from the browser's storage.
 */
function loadLocal() {
  Object.keys(localStorage).forEach(k => {
    if (k.endsWith("_m")) {
      master[k.replace("_m", "")] = JSON.parse(localStorage.getItem(k));
    }
  });
  render();
}

/**
 * 3. UI RENDERING
 * Builds the section dropdowns and restores the last selected section for each box.
 */
function render() {
  ["section1", "section2"].forEach(id => {
    const opt = document.getElementById(id + "-options");
    if (!opt) return;

    opt.innerHTML = "";
    Object.keys(master).sort().forEach(s => {
      const d = document.createElement('div');
      d.className = 'custom-option';
      d.textContent = s;
      d.onclick = () => {
        document.getElementById(id).textContent = s;
        opt.style.display = 'none';
        localStorage.setItem(id, s);
      };
      opt.appendChild(d);
    });

    // Restore previously selected section
    const saved = localStorage.getItem(id) || Object.keys(master)[0];
    if (saved) document.getElementById(id).textContent = saved;
  });
  updateHistoryUI();
}

/**
 * 4. SELECTION LOGIC
 * Picks a random student from the section pool and updates the history log.
 */
function nextStudent(id) {
  const sec = document.getElementById(id).textContent;
  if (!master[sec]) return;

  // Retrieve current pool or create new one from master
  const poolKey = sec + "_p";
  let pool = JSON.parse(localStorage.getItem(poolKey)) || [];
  if (pool.length === 0) pool = [...master[sec]];

  // Random Selection
  const idx = Math.floor(Math.random() * pool.length);
  const picked = pool.splice(idx, 1)[0];

  // Persist the updated pool
  localStorage.setItem(poolKey, JSON.stringify(pool));

  // Visual Update
  const box = document.getElementById("student" + id.slice(-1));
  box.textContent = picked;
  box.classList.remove("pop-in");
  void box.offsetWidth; // Force CSS animation restart
  box.classList.add("pop-in");

  // History Management
  const entry = { 
    name: picked, 
    section: sec, 
    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
  };
  history.unshift(entry);
  if (history.length > 5) history.pop(); // Keep only last 5
  localStorage.setItem("selector_history", JSON.stringify(history));
  updateHistoryUI();
}

/**
 * 5. UTILITY FUNCTIONS
 */
function updateHistoryUI() {
  const log = document.getElementById("history-log");
  if (!log || history.length === 0) return;
  
  log.innerHTML = history.map(h => `
    <div class="history-item">
      <span>${h.name} <span class="history-tag">(${h.section})</span></span>
      <span style="color:#999; font-size:3vw">${h.time}</span>
    </div>
  `).join('');
}

function absent(id) {
  const name = document.getElementById("student" + id.slice(-1)).textContent;
  const sec = document.getElementById(id).textContent;
  if (name === "---" || name === "Ready" || !confirm(`Remove ${name} from ${sec} for this session?`)) return;

  // Remove from master (in-memory) and current pool (storage)
  master[sec] = master[sec].filter(s => s !== name);
  let p = JSON.parse(localStorage.getItem(sec + "_p")) || [];
  localStorage.setItem(sec + "_p", JSON.stringify(p.filter(s => s !== name)));
  
  document.getElementById("student" + id.slice(-1)).textContent = "---";
}

function resetPool(id) {
  const sec = document.getElementById(id).textContent;
  if (confirm(`Reset picking pool for ${sec}? Everyone will be eligible again.`)) {
    localStorage.removeItem(sec + "_p");
    document.getElementById("student" + id.slice(-1)).textContent = "Reset!";
  }
}

function toggle(id) {
  const el = document.getElementById(id);
  const isVisible = el.style.display === 'block';
  document.querySelectorAll('.custom-options').forEach(d => d.style.display = 'none');
  el.style.display = isVisible ? 'none' : 'block';
}

// 6. INITIALIZATION
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(e => console.error("SW Error:", e));
}

// Start the app
loadFromSheets();
