// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBudm3kTAmwHikngh4AlmjekoURZTcXqG4",
  authDomain: "mahjong-web.firebaseapp.com",
  projectId: "mahjong-web",
};

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} catch (e) {
  console.error("Firebase initialization error:", e);
}

const db = firebase.firestore();
const gameDoc = db.collection('games').doc('default');

// Ensure the default game document exists
gameDoc.get().then(doc => {
  if (!doc.exists) {
    console.log("Creating default game document...");
    gameDoc.set({
      players: [],
      rounds: [],
      historyPlayers: [],
      history: []
    });
  } else {
    console.log("Default game document exists:", doc.data());
  }
}).catch(err => {
  console.error("Error fetching default game document:", err);
});

// ---------------- STATE ----------------
const players = [];
const rounds = [];
let currentScores = [];
let historyEditing = false;

let historyPlayers = [];
let historyLog = [];
let masterEditing = false;

// Undo
let undoSnapshot = null;
let isRestoringUndo = false;

// ---------------- DOM ----------------
const newPlayerInput = document.getElementById('newPlayer');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const scoreInputs = document.getElementById('scoreInputs');
const submitBtn = document.getElementById('submitBtn');
const roundNumSpan = document.getElementById('roundNum');
const historyTable = document.getElementById('historyTable');
const appendHistoryBtn = document.getElementById('appendHistoryBtn');
const masterHistoryTable = document.getElementById('masterHistoryTable');
const undoBtn = document.getElementById('undoBtn');

const tabGameBtn = document.getElementById('tabGame');
const tabHistoryBtn = document.getElementById('tabHistory');
const gameTabSection = document.getElementById('gameTab');
const historyTabSection = document.getElementById('historyTab');

const newGameBtn = document.getElementById('newGameBtn');
const resetZoomBtn = document.getElementById('resetZoomBtn');
const editHistoryBtn = document.getElementById('editHistoryBtn');
const saveHistoryBtn = document.getElementById('saveHistoryBtn');
const editMasterBtn = document.getElementById('editMasterBtn');
const saveMasterBtn = document.getElementById('saveMasterBtn');

// ---------------- CHARTS ----------------
const ctx = document.getElementById('chartCanvas')?.getContext('2d');
let chart;

const masterCanvasEl = document.getElementById('masterChartCanvas');
const masterCtx = masterCanvasEl?.getContext('2d');
let masterChart;

// ---------------- REGISTER ZOOM PLUGIN ----------------
if (window.Chart && window.ChartZoom) {
  Chart.register(window.ChartZoom);
}

// ---------------- COLORS ----------------
const PLAYER_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728',
  '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
  '#bcbd22', '#17becf', '#aec7e8', '#ffbb78',
  '#98df8a', '#ff9896', '#c5b0d5',
];

function getPlayerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

// ---------------- EDIT HELPERS ----------------
function setTableEditable(table, editable) {
  if (!table) return;
  table.querySelectorAll('td').forEach(td => {
    if (td.cellIndex === 0) return; // skip Round / Row #
    td.contentEditable = editable;
    td.style.background = editable ? '#fff7ed' : '';
  });
}

function parseTableToArray(table, targetArray) {
  targetArray.length = 0;
  Array.from(table.rows).slice(1).forEach(row => {
    const vals = Array.from(row.cells)
      .slice(1)
      .map(td => Number(td.textContent) || 0);
    targetArray.push(vals);
  });
}

// ---------------- UNDO ----------------
function takeUndoSnapshot() {
  undoSnapshot = {
    players: [...players],
    rounds: rounds.map(r => [...r]),
    currentScores: [...currentScores],
    historyPlayers: [...historyPlayers],
    historyLog: historyLog.map(r => [...r]),
  };
}

function restoreUndoSnapshot() {
  if (!undoSnapshot) return;

  isRestoringUndo = true;

  players.splice(0, players.length, ...undoSnapshot.players);
  rounds.splice(0, rounds.length, ...undoSnapshot.rounds.map(r => [...r]));
  currentScores = [...undoSnapshot.currentScores];

  historyPlayers.splice(0, historyPlayers.length, ...undoSnapshot.historyPlayers);
  historyLog.splice(0, historyLog.length, ...undoSnapshot.historyLog.map(r => [...r]));

  renderAll();
  syncToFirestore();

  undoSnapshot = null;
  setTimeout(() => (isRestoringUndo = false), 0);
}

// ---------------- RENDER ----------------
function renderScoreInputs() {
  if (!scoreInputs) return;
  scoreInputs.innerHTML = '';
  currentScores = players.map(() => 0);

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.innerHTML = `
      <span>${name}</span>
      <input type="number" value="0" data-index="${i}" style="width:4rem;" />
    `;
    scoreInputs.appendChild(row);
  });

  scoreInputs.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      currentScores[e.target.dataset.index] = Number(e.target.value);
    });
  });
}

function updateHistory() {
  if (!historyTable) return;
  historyTable.innerHTML = '';

  const header = historyTable.insertRow();
  header.insertCell().textContent = 'Round';
  players.forEach(p => header.insertCell().textContent = p);

  rounds.forEach((scores, r) => {
    const row = historyTable.insertRow();
    row.insertCell().textContent = r + 1;
    players.forEach((_, i) =>
      row.insertCell().textContent = scores[i] ?? 0
    );
  });
}

function updateMasterHistory() {
  if (!masterHistoryTable) return;
  masterHistoryTable.innerHTML = '';

  const header = masterHistoryTable.insertRow();
  header.insertCell().textContent = 'Row';
  historyPlayers.forEach(p => header.insertCell().textContent = p);

  historyLog.forEach((vals, i) => {
    const row = masterHistoryTable.insertRow();
    row.insertCell().textContent = i + 1;
    historyPlayers.forEach((_, c) =>
      row.insertCell().textContent = vals[c] ?? 0
    );
  });
}

// ---------------- EDIT / SAVE (GAME HISTORY) ----------------
editHistoryBtn?.addEventListener('click', () => {
  historyEditing = true;
  setTableEditable(historyTable, true);
  editHistoryBtn.style.display = 'none';
  saveHistoryBtn.style.display = 'inline-block';
});

saveHistoryBtn?.addEventListener('click', () => {
  historyEditing = false;
  setTableEditable(historyTable, false);

  takeUndoSnapshot();
  parseTableToArray(historyTable, rounds);

  editHistoryBtn.style.display = 'inline-block';
  saveHistoryBtn.style.display = 'none';

  renderAll();
  syncToFirestore();
});

// ---------------- EDIT / SAVE (MASTER HISTORY) ----------------
editMasterBtn?.addEventListener('click', () => {
  masterEditing = true;
  setTableEditable(masterHistoryTable, true);
  editMasterBtn.style.display = 'none';
  saveMasterBtn.style.display = 'inline-block';
});

saveMasterBtn?.addEventListener('click', () => {
  masterEditing = false;
  setTableEditable(masterHistoryTable, false);

  takeUndoSnapshot();
  parseTableToArray(masterHistoryTable, historyLog);

  editMasterBtn.style.display = 'inline-block';
  saveMasterBtn.style.display = 'none';

  renderAll();
  syncToFirestore();
});

// ---------------- SNAPSHOT LISTENER ----------------
gameDoc.onSnapshot(doc => {
  console.log("Firestore snapshot received:", doc.data());
  if (isRestoringUndo || historyEditing || masterEditing) return;

  const d = doc.data();
  if (!d) return;

  players.splice(0, players.length, ...(d.players ?? []));
  rounds.splice(0, rounds.length,
    ...(d.rounds ?? []).map(r => players.map(p => r[p] ?? 0))
  );

  historyPlayers.splice(0, historyPlayers.length, ...(d.historyPlayers ?? []));
  historyLog.splice(0, historyLog.length,
    ...(d.history ?? []).map(r => historyPlayers.map(p => r[p] ?? 0))
  );

  renderAll();
});
