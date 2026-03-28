// 1. CONFIGURATION & STATE
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9nE9pp-Lk2y4nS7WFocx5P8tW2pJjw6m9t95n78accs0-9GymgaoG3d0Mfg4hiS8x3LFoYhkqVS7C/pub?output=csv";

let master = {}; // Full student lists: { "10-A": ["Name 1", "Name 2"] }
let history = JSON.parse(localStorage.getItem("selector_history")) || [];

/**
 * 2. DATA SYNC (GOOGLE SHEETS -> LOCAL)
 */
async function loadFromSheets() {
  const status = document.getElementById('status');
  if (status) status.textContent = "Syncing with Google...";

  try {
    const res = await fetch(CSV_URL);
    const text = await res.text();
    const rows = text.split('\n').slice(1); // Skip header

    master = {}; 
    rows.forEach(r => {
      const c = r.split(',').map(v => v.replace(/"/g, "").trim());
      if (c.length >= 3) {
        const fullName = `${c[1]} ${c[0]}`; // First Last
        const sectionName = c[2];
        if (!master[sectionName]) master[sectionName] = [];
        master[sectionName].push(fullName);
      }
    });

    // Save master lists to localStorage for offline reliability
    Object.keys(master).forEach(k => {
      localStorage.setItem(k + "_m", JSON.stringify(master[k]));
    });

    render();
    if (status) status.textContent = "Synced: " + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  } catch (e) {
    console.warn("Network issue. Using cached data.");
    loadLocal();
  }
}

function loadLocal() {
  Object.keys(localStorage).forEach(k => {
    if (k.endsWith("_m")) {
      master[k.replace("_m", "")] = JSON.parse(localStorage.getItem(k));
    }
  });
  render();
}

/**
 * 3. UI RENDERING & DROPDOWNS
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
        updateStats(id, s); // Show stats immediately on selection
      };
      opt.appendChild(d);
    });

    const saved = localStorage.getItem(id) || Object.keys(master)[0];
    if (saved) {
      document.getElementById(id).textContent = saved;
      updateStats(id, saved);
    }
  });
  updateHistoryUI();
}

/**
 * 4. SELECTION & HISTORY LOGIC
 */
function nextStudent(id) {
  const sec = document.getElementById(id).textContent;
  if (!master[sec]) return;

  const poolKey = sec + "_p";
  let pool = JSON.parse(localStorage.getItem(poolKey)) || [];
  if (pool.length === 0) pool = [...master[sec]];

  const idx = Math.floor(Math.random() * pool.length);
  const picked = pool.splice(idx, 1)[0];

  localStorage.setItem(poolKey, JSON.stringify(pool));

  // Visual Update
  const box = document.getElementById("student" + id.slice(-1));
  box.textContent = picked;
  box.classList.remove("pop-in");
  void box.offsetWidth; 
  box.classList.add("pop-in");

  // Update History
  const entry = { 
    name: picked, 
    section: sec, 
    time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
  };
  history.unshift(entry);
  if (history.length > 5) history.pop();
  localStorage.setItem("selector_history", JSON.stringify(history));
  
  updateHistoryUI();
  updateStats(id, sec);
}

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

/**
 * 5. STATISTICS & CLASS MANAGEMENT
 */
function updateStats(selectorId, sectionName) {
  if (!master[sectionName]) return;
  
  const pool = JSON.parse(localStorage.getItem(sectionName + "_p")) || [];
  const total = master[sectionName].length;
  const remaining = pool.length === 0 ? 0 : pool.length;
  const called = total - remaining;
  const percent = Math.round((called / total) * 100);

  // You can add a small div in your HTML for this, or just log it to status
  console.log(`${sectionName}: ${called}/${total} called (${percent}%)`);
}

function absent(id) {
  const name = document.getElementById("student" + id.slice(-1)).textContent;
  const sec = document.getElementById(id).textContent;
  if (name === "---" || !confirm(`Mark ${name} as absent?`)) return;

  // Remove from session and storage pool
  master[sec] = master[sec].filter(s => s !== name);
  let p = JSON.parse(localStorage.getItem(sec + "_p")) || [];
  localStorage.setItem(sec + "_p", JSON.stringify(p.filter(s => s !== name)));
  
  document.getElementById("student" + id.slice(-1)).textContent = "---";
  updateStats(id, sec);
}

function resetPool(id) {
  const sec = document.getElementById(id).textContent;
  if (confirm(`Reset pool for ${sec}? Everyone will be eligible again.`)) {
    localStorage.removeItem(sec + "_p");
    document.getElementById("student" + id.slice(-1)).textContent = "Reset!";
    updateStats(id, sec);
  }
}

function toggle(id) {
  const el = document.getElementById(id);
  const isVisible = el.style.display === 'block';
  document.querySelectorAll('.custom-options').forEach(d => d.style.display = 'none');
  el.style.display = isVisible ? 'none' : 'block';
}

/**
 * 6. SERVICE WORKER & STARTUP
 */
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js")
    .then(() => console.log("SW: Registered"))
    .catch(err => console.error("SW: Failed", err));
}

// Kickoff
loadFromSheets();
