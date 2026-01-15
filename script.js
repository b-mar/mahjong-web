// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBudm3kTAmwHikngh4AlmjekoURZTcXqG4",
  authDomain: "mahjong-web.firebaseapp.com",
  projectId: "mahjong-web",
};

try { firebase.initializeApp(firebaseConfig); } catch {}
const db = firebase.firestore();
const gameDoc = db.collection('games').doc('default');

// ---------------- STATE ----------------
const players = [];
const rounds = [];
let currentScores = [];

let historyPlayers = [];
let historyLog = [];

let historyEditing = false;
let masterEditing = false;

// ---------------- DOM ----------------
const newPlayerInput = document.getElementById('newPlayer');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const scoreInputs = document.getElementById('scoreInputs');
const submitBtn = document.getElementById('submitBtn');
const roundNumSpan = document.getElementById('roundNum');
const historyTable = document.getElementById('historyTable');
const masterHistoryTable = document.getElementById('masterHistoryTable');

const editHistoryBtn = document.getElementById('editHistoryBtn');
const saveHistoryBtn = document.getElementById('saveHistoryBtn');
const editMasterBtn = document.getElementById('editMasterBtn');
const saveMasterBtn = document.getElementById('saveMasterBtn');

const tabGameBtn = document.getElementById('tabGame');
const tabHistoryBtn = document.getElementById('tabHistory');
const gameTabSection = document.getElementById('gameTab');
const historyTabSection = document.getElementById('historyTab');

const resetZoomBtn = document.getElementById('resetZoomBtn');

// ---------------- CHARTS ----------------
const ctx = document.getElementById('chartCanvas')?.getContext('2d');
const masterCtx = document.getElementById('masterChartCanvas')?.getContext('2d');

let chart;
let masterChart;

// ---------------- HELPERS ----------------
function setTableEditable(table, editable) {
  if (!table) return;
  table.querySelectorAll('td').forEach(td => {
    if (td.cellIndex === 0) return; // skip round / row number
    td.contentEditable = editable ? "true" : "false";
    td.style.background = editable ? "#fff7ed" : "";
  });
}

// ---------------- RENDER ----------------
function renderScoreInputs() {
  if (!scoreInputs) return;
  scoreInputs.innerHTML = '';
  currentScores = players.map(() => 0);

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.innerHTML = `
      <span>${name}</span>
      <input type="number" value="0" data-index="${i}" />
    `;
    scoreInputs.appendChild(row);
  });

  scoreInputs.querySelectorAll('input').forEach(inp => {
    inp.oninput = e => {
      currentScores[e.target.dataset.index] = Number(e.target.value);
    };
  });
}

function updateHistory() {
  historyTable.innerHTML = '';
  const header = historyTable.insertRow();
  header.insertCell().textContent = 'Round';
  players.forEach(p => header.insertCell().textContent = p);

  rounds.forEach((scores, r) => {
    const row = historyTable.insertRow();
    row.insertCell().textContent = r + 1;
    players.forEach((_, i) => {
      row.insertCell().textContent = scores[i] ?? 0;
    });
  });
}

function updateMasterHistory() {
  masterHistoryTable.innerHTML = '';
  const header = masterHistoryTable.insertRow();
  header.insertCell().textContent = 'Row';
  historyPlayers.forEach(p => header.insertCell().textContent = p);

  historyLog.forEach((vals, i) => {
    const row = masterHistoryTable.insertRow();
    row.insertCell().textContent = i + 1;
    historyPlayers.forEach((_, c) => {
      row.insertCell().textContent = vals[c] ?? 0;
    });
  });
}

function updateMasterChart() {
  if (!masterCtx) return;

  const datasets = historyPlayers.map((name, c) => {
    let sum = 0;
    return {
      label: name,
      data: historyLog.map((r, i) => {
        sum += r[c] ?? 0;
        return { x: i + 1, y: sum };
      }),
    };
  });

  if (masterChart) masterChart.destroy();
  masterChart = new Chart(masterCtx, {
    type: 'line',
    data: { datasets },
    options: {
      scales: {
        x: {
          type: 'linear',
          min: 1,
          max: Math.max(1, historyLog.length),
        },
      },
      plugins: {
        zoom: {
          pan: { enabled: true, mode: 'xy' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' },
        },
      },
    },
  });
}

// ---------------- EDIT HANDLERS ----------------

// GAME TAB EDIT
editHistoryBtn.onclick = () => {
  historyEditing = true;
  setTableEditable(historyTable, true);
  editHistoryBtn.style.display = 'none';
  saveHistoryBtn.style.display = 'inline-block';
};

saveHistoryBtn.onclick = () => {
  historyEditing = false;
  setTableEditable(historyTable, false);
  editHistoryBtn.style.display = 'inline-block';
  saveHistoryBtn.style.display = 'none';
};

// HISTORY TAB EDIT
editMasterBtn.onclick = () => {
  masterEditing = true;
  setTableEditable(masterHistoryTable, true);
  editMasterBtn.style.display = 'none';
  saveMasterBtn.style.display = 'inline-block';
};

saveMasterBtn.onclick = () => {
  masterEditing = false;
  setTableEditable(masterHistoryTable, false);
  editMasterBtn.style.display = 'inline-block';
  saveMasterBtn.style.display = 'none';
};

// ---------------- TABS ----------------
tabGameBtn.onclick = () => {
  gameTabSection.style.display = 'block';
  historyTabSection.style.display = 'none';
};

tabHistoryBtn.onclick = () => {
  gameTabSection.style.display = 'none';
  historyTabSection.style.display = 'block';
  updateMasterChart();
  masterChart?.resetZoom?.();
};

// ---------------- RESET ZOOM ----------------
resetZoomBtn.onclick = () => masterChart?.resetZoom?.();
