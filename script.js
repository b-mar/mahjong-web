// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBudm3kTAmwHikngh4AlmjekoURZTcXqG4",
  authDomain: "mahjong-web.firebaseapp.com",
  projectId: "mahjong-web",
};
// Initialize Firebase and Firestore
try { firebase.initializeApp(firebaseConfig); } catch {}
const db = firebase.firestore();
const gameDoc = db.collection('games').doc('default');

// In-memory state
const players = [];          // current game players (columns in game table & chart)
const rounds = [];           // current game rounds (array of arrays aligned to `players`)
let currentScores = [];
let historyEditing = false;

let historyPlayers = [];     // ALL-TIME columns (stable order for History tab)
let historyLog = [];         // ALL-TIME rows (array of arrays aligned to `historyPlayers`)
let masterEditing = false;   // edit mode for History tab

// DOM elements
const newPlayerInput = document.getElementById('newPlayer');
const addPlayerBtn   = document.getElementById('addPlayerBtn');
const scoreInputs    = document.getElementById('scoreInputs');
const submitBtn      = document.getElementById('submitBtn');
const roundNumSpan   = document.getElementById('roundNum');
const historyTable   = document.getElementById('historyTable');
const editHistoryBtn = document.getElementById('editHistoryBtn');
const saveHistoryBtn = document.getElementById('saveHistoryBtn');
const appendHistoryBtn = document.getElementById('appendHistoryBtn');
const masterHistoryTable = document.getElementById('masterHistoryTable');
// tabs (if present)
const tabGameBtn = document.getElementById('tabGame');
const tabHistoryBtn = document.getElementById('tabHistory');
const gameTabSection = document.getElementById('gameTab');
const historyTabSection = document.getElementById('historyTab');
// New Game button
const newGameBtn = document.getElementById('newGameBtn');
// History tab edit/save buttons
const editMasterBtn = document.getElementById('editMasterBtn');
const saveMasterBtn = document.getElementById('saveMasterBtn');

// Charts
const ctx = document.getElementById('chartCanvas').getContext('2d');
let chart;

const masterCanvasEl = document.getElementById('masterChartCanvas');
const masterCtx = masterCanvasEl ? masterCanvasEl.getContext('2d') : null;
let masterChart;

// ---------------- RENDERING ----------------
function renderScoreInputs() {
  scoreInputs.innerHTML = '';
  currentScores = players.map(() => 0);
  players.forEach((name, i) => {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.justifyContent = 'space-between';
    div.style.marginBottom = '0.5rem';
    div.innerHTML = `
      <span>${name}</span>
      <input type="number" value="0" style="width:4rem;" data-index="${i}" />
    `;
    scoreInputs.appendChild(div);
  });
  scoreInputs.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      currentScores[e.target.dataset.index] = Number(e.target.value);
    });
  });
}

function updateHistory() {
  historyTable.innerHTML = '';
  const header = historyTable.insertRow();
  header.insertCell().textContent = 'Round';
  players.forEach(p => header.insertCell().textContent = p);

  rounds.forEach((scores, r) => {
    const row = historyTable.insertRow();
    row.insertCell().textContent = String(r + 1);
    players.forEach((_, i) => {
      const cell = row.insertCell();
      const val = (scores[i] !== undefined ? scores[i] : 0);
      if (historyEditing) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = val;
        inp.style.width = '4rem';
        inp.dataset.round = r;
        inp.dataset.player = i;
        inp.addEventListener('input', e => {
          const rIdx = Number(e.target.dataset.round);
          const pIdx = Number(e.target.dataset.player);
          rounds[rIdx][pIdx] = Number(e.target.value);
          updateChart();
        });
        cell.appendChild(inp);
      } else {
        cell.textContent = String(val);
      }
    });
  });

  const totalRow = historyTable.insertRow();
  totalRow.insertCell().textContent = 'Total';
  players.forEach((_, i) => {
    const sum = rounds.reduce((acc, sc) => acc + (sc[i] !== undefined ? sc[i] : 0), 0);
    totalRow.insertCell().textContent = String(sum);
  });

  if (editHistoryBtn && saveHistoryBtn) {
    editHistoryBtn.style.display = historyEditing ? 'none' : 'inline-block';
    saveHistoryBtn.style.display = historyEditing ? 'inline-block' : 'none';
  }
}

// Game chart
function updateChart() {
  const dataSets = players.map((name, i) => {
    let cum = 0;
    const data = [{ x: 0, y: 0 }].concat(
      rounds.map((sc, r) => {
        cum += sc[i] !== undefined ? sc[i] : 0;
        return { x: r + 1, y: cum };
      })
    );
    return { label: name, data, fill: false };
  });
  const config = {
    type: 'line',
    data: { datasets: dataSets },
    options: {
      scales: {
        x: { type: 'linear', min: 0, title: { display: true, text: 'Rounds' }, ticks: { stepSize: 1 } },
        y: { title: { display: true, text: 'Cumulative Points' } }
      }
    }
  };
  if (chart) chart.destroy();
  chart = new Chart(ctx, config);
}

// History (All-time) editable table
function updateMasterHistory() {
  if (!masterHistoryTable) return;
  masterHistoryTable.innerHTML = '';

  // Header
  const header = masterHistoryTable.insertRow();
  header.insertCell().textContent = 'Row';
  historyPlayers.forEach(p => header.insertCell().textContent = p);

  // Body rows
  historyLog.forEach((rowVals, idx) => {
    const row = masterHistoryTable.insertRow();
    row.insertCell().textContent = String(idx + 1);

    historyPlayers.forEach((_, i) => {
      const cell = row.insertCell();
      const val = rowVals[i] !== undefined ? rowVals[i] : 0;

      if (masterEditing) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = val;
        inp.style.width = '4rem';
        inp.dataset.row = idx;
        inp.dataset.col = i;
        inp.addEventListener('input', e => {
          const r = Number(e.target.dataset.row);
          const c = Number(e.target.dataset.col);
          historyLog[r][c] = Number(e.target.value);
          // (Optional) live totals update:
          // we keep totals static during edit to avoid re-rendering inputs.
          // Totals will refresh on Save.
        });
        cell.appendChild(inp);
      } else {
        cell.textContent = String(val);
      }
    });
  });

  // Totals row (always read-only)
  const totalRow = masterHistoryTable.insertRow();
  const labelCell = totalRow.insertCell();
  labelCell.textContent = 'Total';
  historyPlayers.forEach((_, i) => {
    const sum = historyLog.reduce((acc, r) => acc + (r[i] !== undefined ? r[i] : 0), 0);
    totalRow.insertCell().textContent = String(sum);
  });

  // Toggle History-tab edit/save buttons
  if (editMasterBtn && saveMasterBtn) {
    editMasterBtn.style.display = masterEditing ? 'none' : 'inline-block';
    saveMasterBtn.style.display = masterEditing ? 'inline-block' : 'none';
  }
}


// ---------------- HELPERS (HISTORY) ----------------
function ensureHistoryColumns(currPlayers) {
  // Add any new players; backfill zero for existing rows
  currPlayers.forEach(p => {
    if (!historyPlayers.includes(p)) {
      historyPlayers.push(p);
      historyLog.forEach(r => r.push(0));
    }
  });
}

function appendCurrentRoundsToHistory() {
  if (rounds.length === 0) return;
  ensureHistoryColumns(players);

  rounds.forEach(roundRow => {
    const histRow = historyPlayers.map(() => 0);
    players.forEach((p, i) => {
      const col = historyPlayers.indexOf(p);
      const v = roundRow[i] !== undefined ? roundRow[i] : 0;
      histRow[col] = v;
    });
    historyLog.push(histRow);
  });
}

// ---------------- FIRESTORE TRANSFORMS ----------------
function roundsToFirestore() {
  return rounds.map(scores => {
    const map = {};
    players.forEach((player, i) => { map[player] = (scores[i] !== undefined ? scores[i] : 0); });
    return map;
  });
}
function roundsFromFirestore(fsRounds) {
  return fsRounds.map(map => players.map(p => Number(map[p] !== undefined ? map[p] : 0)));
}

function historyToFirestore() {
  return historyLog.map(rowArr => {
    const map = {};
    historyPlayers.forEach((name, i) => { map[name] = (rowArr[i] !== undefined ? rowArr[i] : 0); });
    return map;
  });
}
function historyFromFirestore(fsHist) {
  return fsHist.map(rowMap =>
    historyPlayers.map(name => Number(rowMap[name] !== undefined ? rowMap[name] : 0))
  );
}
function deriveHistoryPlayersFromMaps(fsHist) {
  const seen = new Set();
  const order = [];
  fsHist.forEach(m => {
    Object.keys(m || {}).forEach(k => {
      if (!seen.has(k)) { seen.add(k); order.push(k); }
    });
  });
  return order;
}

// ---------------- SYNC ----------------
function syncToFirestore() {
  gameDoc.set({
    players,
    rounds: roundsToFirestore(),
    historyPlayers,
    history: historyToFirestore()
  }, { merge: true }).catch(console.error);
}

// ---------------- HANDLERS ----------------
if (addPlayerBtn) addPlayerBtn.onclick = () => {
  const name = newPlayerInput.value.trim();
  if (!name) return;
  players.push(name);
  newPlayerInput.value = '';
  renderScoreInputs();
  roundNumSpan.textContent = String(rounds.length + 1);
  updateHistory();
  updateChart();
  syncToFirestore();
};

if (submitBtn) submitBtn.onclick = () => {
  const total = currentScores.reduce((a, b) => a + b, 0);
  if (total !== 0) {
    alert(`Error: scores must sum to zero! Currently ${total}`);
    return;
  }
  rounds.push([...currentScores]);
  renderScoreInputs();
  roundNumSpan.textContent = String(rounds.length + 1);
  updateHistory();
  updateChart();
  syncToFirestore();
};

// NEW GAME: only clears current game; History is preserved
if (newGameBtn) newGameBtn.onclick = () => {
  players.length = 0;        // clear roster for the new game
  rounds.length = 0;         // clear per-round scores
  currentScores = [];        // clear inputs

  renderScoreInputs();
  roundNumSpan.textContent = '1';
  historyEditing = false;
  updateHistory();
  updateMasterHistory();     // re-render to be safe
  updateChart();
  updateMasterChart();       // history unchanged, but re-render is fine

  // Persist only players + rounds; do NOT touch history/historyPlayers
  gameDoc.set({ players: [], rounds: [] }, { merge: true }).catch(console.error);
};

// Per-game history edit/save
if (editHistoryBtn) editHistoryBtn.onclick = () => { historyEditing = true; updateHistory(); };
if (saveHistoryBtn) saveHistoryBtn.onclick = () => { historyEditing = false; syncToFirestore(); updateHistory(); };

// History tab: Add to History
if (appendHistoryBtn) appendHistoryBtn.onclick = () => {
  if (rounds.length === 0) { alert('No rounds to add.'); return; }
  appendCurrentRoundsToHistory();
  // Optional: clear current game after appending to avoid double-logging
  rounds.length = 0;
  renderScoreInputs();
  roundNumSpan.textContent = '1';
  updateHistory();
  updateMasterHistory();
  updateChart();
  updateMasterChart();   // <— reflect the newly appended rows
  syncToFirestore();
};

// NEW: History tab edit/save handlers
if (editMasterBtn) editMasterBtn.onclick = () => {
  masterEditing = true;
  updateMasterHistory();
};
if (saveMasterBtn) saveMasterBtn.onclick = () => {
  masterEditing = false;
  syncToFirestore();   // persist edited historyLog/historyPlayers
  updateMasterHistory();
  updateMasterChart(); // <— reflect edited values in the chart
};

// Tabs (optional)
function showGame() {
  if (!gameTabSection || !historyTabSection) return;
  gameTabSection.style.display = 'block';
  historyTabSection.style.display = 'none';
}
function showHistory() {
  if (!gameTabSection || !historyTabSection) return;
  gameTabSection.style.display = 'none';
  historyTabSection.style.display = 'block';
  updateMasterChart(); // ensure chart renders when switching to History tab
}
if (tabGameBtn) tabGameBtn.onclick = showGame;
if (tabHistoryBtn) tabHistoryBtn.onclick = showHistory;

// ---------------- SNAPSHOT ----------------
gameDoc.onSnapshot(doc => {
  const data = doc.data() || { players: [], rounds: [], historyPlayers: [], history: [] };

  // Current game
  players.splice(0, players.length, ...data.players);
  const fsRounds = Array.isArray(data.rounds) ? data.rounds : [];
  const newRounds = roundsFromFirestore(fsRounds);
  rounds.splice(0, rounds.length, ...newRounds);

  // All-time history
  const fsHist = Array.isArray(data.history) ? data.history : [];
  const incomingHistPlayers = Array.isArray(data.historyPlayers) && data.historyPlayers.length
    ? data.historyPlayers
    : deriveHistoryPlayersFromMaps(fsHist);

  historyPlayers.splice(0, historyPlayers.length, ...incomingHistPlayers);

  const newHist = historyFromFirestore(fsHist);
  historyLog.splice(0, historyLog.length, ...newHist);

  // Re-render
  renderScoreInputs();
  roundNumSpan.textContent = String(rounds.length + 1);
  historyEditing = false;
  updateHistory();
  updateMasterHistory();
  updateChart();
  updateMasterChart();  // <— keep in sync with DB
}, console.error);
