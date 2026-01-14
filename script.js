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
const editHistoryBtn = document.getElementById('editHistoryBtn');
const saveHistoryBtn = document.getElementById('saveHistoryBtn');
const appendHistoryBtn = document.getElementById('appendHistoryBtn');
const masterHistoryTable = document.getElementById('masterHistoryTable');
const undoBtn = document.getElementById('undoBtn');

const tabGameBtn = document.getElementById('tabGame');
const tabHistoryBtn = document.getElementById('tabHistory');
const gameTabSection = document.getElementById('gameTab');
const historyTabSection = document.getElementById('historyTab');

const newGameBtn = document.getElementById('newGameBtn');
const editMasterBtn = document.getElementById('editMasterBtn');
const saveMasterBtn = document.getElementById('saveMasterBtn');

// ---------------- CHARTS ----------------
const ctx = document.getElementById('chartCanvas').getContext('2d');
let chart;

const masterCanvasEl = document.getElementById('masterChartCanvas');
const masterCtx = masterCanvasEl ? masterCanvasEl.getContext('2d') : null;
let masterChart;

// ---------------- COLORS ----------------
const PLAYER_COLORS = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // teal
  '#aec7e8', // light blue
  '#ffbb78', // light orange
  '#98df8a', // light green
  '#ff9896', // light red
  '#c5b0d5', // lavender
];
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

  setTimeout(() => { isRestoringUndo = false; }, 0);
}

// ---------------- RENDER ----------------
function renderScoreInputs() {
  scoreInputs.innerHTML = '';
  currentScores = players.map(() => 0);

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.marginBottom = '0.5rem';

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
  historyTable.innerHTML = '';
  const header = historyTable.insertRow();
  header.insertCell().textContent = 'Round';
  players.forEach(p => header.insertCell().textContent = p);

  rounds.forEach((scores, r) => {
    const row = historyTable.insertRow();
    row.insertCell().textContent = String(r + 1);
    players.forEach((_, i) => {
      const cell = row.insertCell();
      cell.textContent = scores[i] ?? 0;
    });
  });

  const totalRow = historyTable.insertRow();
  totalRow.insertCell().textContent = 'Total';
  players.forEach((_, i) => {
    const sum = rounds.reduce((a, r) => a + (r[i] ?? 0), 0);
    totalRow.insertCell().textContent = sum;
  });
}

function updateChart() {
  const datasets = players.map((name, i) => {
    let cum = 0;
    const data = [{ x: 0, y: 0 }].concat(
      rounds.map((r, idx) => {
        cum += r[i] ?? 0;
        return { x: idx + 1, y: cum };
      })
    );
    return {
  label: name,
  data,
  borderColor: getPlayerColor(i),
  backgroundColor: getPlayerColor(i),
  tension: 0.25,
  pointRadius: 3,
};

  });

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: { scales: { x: { type: 'linear' } } }
  });
}

function updateMasterHistory() {
  if (!masterHistoryTable) return;
  masterHistoryTable.innerHTML = '';

  const header = masterHistoryTable.insertRow();
  header.insertCell().textContent = 'Row';
  historyPlayers.forEach(p => header.insertCell().textContent = p);

  historyLog.forEach((rowVals, i) => {
    const row = masterHistoryTable.insertRow();
    row.insertCell().textContent = String(i + 1);
    historyPlayers.forEach((_, c) => {
      row.insertCell().textContent = rowVals[c] ?? 0;
    });
  });
}

function updateMasterChart() {
  if (!masterCtx) return;

  const datasets = historyPlayers.map((name, c) => {
    let cum = 0;
    const data = [{ x: 0, y: 0 }].concat(
      historyLog.map((r, i) => {
        cum += r[c] ?? 0;
        return { x: i + 1, y: cum };
      })
    );
    return {
  label: name,
  data,
  borderColor: getPlayerColor(c),
  backgroundColor: getPlayerColor(c),
  tension: 0.25,
  pointRadius: 2,
};

  });

  if (masterChart) masterChart.destroy();
  masterChart = new Chart(masterCtx, {
    type: 'line',
    data: { datasets },
    options: { scales: { x: { type: 'linear' } } }
  });
}

function renderAll() {
  renderScoreInputs();
  roundNumSpan.textContent = String(rounds.length + 1);
  updateHistory();
  updateMasterHistory();
  updateChart();
  updateMasterChart();
}

// ---------------- HELPERS ----------------
function getPlayerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

function appendCurrentRoundsToHistory() {
  players.forEach(p => {
    if (!historyPlayers.includes(p)) {
      historyPlayers.push(p);
      historyLog.forEach(r => r.push(0));
    }
  });

  rounds.forEach(r => {
    const row = historyPlayers.map(() => 0);
    players.forEach((p, i) => {
      row[historyPlayers.indexOf(p)] = r[i] ?? 0;
    });
    historyLog.push(row);
  });
}

// ---------------- FIRESTORE ----------------
function syncToFirestore() {
  gameDoc.set({
    players,
    rounds: rounds.map(r =>
      Object.fromEntries(players.map((p, i) => [p, r[i] ?? 0]))
    ),
    historyPlayers,
    history: historyLog.map(r =>
      Object.fromEntries(historyPlayers.map((p, i) => [p, r[i] ?? 0]))
    )
  }, { merge: true }).catch(console.error);
}

// ---------------- HANDLERS ----------------
addPlayerBtn.onclick = () => {
  const name = newPlayerInput.value.trim();
  if (!name) return;
  takeUndoSnapshot();
  players.push(name);
  newPlayerInput.value = '';
  renderAll();
  syncToFirestore();
};

submitBtn.onclick = () => {
  const sum = currentScores.reduce((a, b) => a + b, 0);
  if (sum !== 0) return alert('Scores must sum to zero');
  takeUndoSnapshot();
  rounds.push([...currentScores]);
  renderAll();
  syncToFirestore();
};

newGameBtn.onclick = () => {
  takeUndoSnapshot();
  players.length = 0;
  rounds.length = 0;
  currentScores = [];
  renderAll();
  syncToFirestore();
};

appendHistoryBtn.onclick = () => {
  if (!rounds.length) return alert('No rounds to add');
  takeUndoSnapshot();
  appendCurrentRoundsToHistory();
  rounds.length = 0;
  renderAll();
  syncToFirestore();
};

undoBtn.onclick = () => {
  if (!undoSnapshot) return alert('Nothing to undo');
  restoreUndoSnapshot();
};

tabGameBtn.onclick = () => {
  gameTabSection.style.display = 'block';
  historyTabSection.style.display = 'none';
};

tabHistoryBtn.onclick = () => {
  gameTabSection.style.display = 'none';
  historyTabSection.style.display = 'block';
  updateMasterChart();
};

// ---------------- SNAPSHOT LISTENER ----------------
gameDoc.onSnapshot(doc => {
  if (isRestoringUndo) return;

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
