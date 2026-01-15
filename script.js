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

// ---------------- HELPERS ----------------
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

// ---------------- DOM ELEMENTS ----------------
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

const ctx = document.getElementById('chartCanvas')?.getContext('2d');
let chart;

const masterCanvasEl = document.getElementById('masterChartCanvas');
const masterCtx = masterCanvasEl ? masterCanvasEl.getContext('2d') : null;
let masterChart;

// ---------------- REGISTER ZOOM PLUGIN ----------------
if (window.Chart && window.ChartZoom) {
  Chart.register(window.ChartZoom);
}

// ---------------- RENDER FUNCTIONS ----------------
function renderScoreInputs() {
  if (!scoreInputs) return;
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
  if (!historyTable) return;
  historyTable.innerHTML = '';
  const header = historyTable.insertRow();
  header.insertCell().textContent = 'Round';
  players.forEach(p => header.insertCell().textContent = p);

  rounds.forEach((scores, r) => {
    const row = historyTable.insertRow();
    row.insertCell().textContent = r + 1;
    players.forEach((_, i) => row.insertCell().textContent = scores[i] ?? 0);
  });
}

function updateChart() {
  if (!ctx) return;
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
    options: { 
      scales: { 
        x: {
          type: 'linear',
          min: 0,
          max: rounds.length > 0 ? rounds.length : 1
        } 
      } 
    }
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
    row.insertCell().textContent = i + 1;
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
    options: {
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: historyLog.length > 0 ? historyLog.length : 1,
          title: { display: true, text: 'Rounds' },
          ticks: { stepSize: 1 }
        },
        y: {
          title: { display: true, text: 'Cumulative Points' },
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

function renderAll() {
  renderScoreInputs();
  if (roundNumSpan) roundNumSpan.textContent = rounds.length + 1;
  updateHistory();
  updateMasterHistory();
  updateChart();
  updateMasterChart();
}

// ---------------- EVENT HANDLERS ----------------
document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  if (tabGameBtn && tabHistoryBtn && gameTabSection && historyTabSection) {
    tabGameBtn.onclick = () => {
      gameTabSection.style.display = 'block';
      historyTabSection.style.display = 'none';
    };
    tabHistoryBtn.onclick = () => {
      gameTabSection.style.display = 'none';
      historyTabSection.style.display = 'block';
      updateMasterChart(); // auto-scale chart
    };
  }

  // Undo
  if (undoBtn) undoBtn.onclick = () => restoreUndoSnapshot();

  // Game buttons
  if (addPlayerBtn) addPlayerBtn.onclick = () => {
    const name = newPlayerInput.value.trim();
    if (!name) return;
    takeUndoSnapshot();
    players.push(name);
    newPlayerInput.value = '';
    renderAll();
    syncToFirestore();
  };

  if (submitBtn) submitBtn.onclick = () => {
    if (currentScores.reduce((a,b)=>a+b,0) !== 0) return alert('Scores must sum to zero');
    takeUndoSnapshot();
    rounds.push([...currentScores]);
    renderAll();
    syncToFirestore();
  };

  if (newGameBtn) newGameBtn.onclick = () => {
    takeUndoSnapshot();
    players.length = 0;
    rounds.length = 0;
    currentScores = [];
    renderAll();
    syncToFirestore();
  };

  if (appendHistoryBtn) appendHistoryBtn.onclick = () => {
    if (!rounds.length) return alert('No rounds to add');
    takeUndoSnapshot();
    appendCurrentRoundsToHistory();
    rounds.length = 0;
    renderAll();
    syncToFirestore();
  };

  if (resetZoomBtn) resetZoomBtn.onclick = () => masterChart?.resetZoom?.();

  // Edit / Save buttons
  if (editHistoryBtn && saveHistoryBtn) {
    editHistoryBtn.onclick = () => {
      historyEditing = true;
      historyTable.contentEditable = "true";
      editHistoryBtn.style.display = 'none';
      saveHistoryBtn.style.display = 'inline-block';
    };
    saveHistoryBtn.onclick = () => {
      historyEditing = false;
      historyTable.contentEditable = "false";
      editHistoryBtn.style.display = 'inline-block';
      saveHistoryBtn.style.display = 'none';
    };
  }

  if (editMasterBtn && saveMasterBtn) {
    editMasterBtn.onclick = () => {
      masterEditing = true;
      masterHistoryTable.contentEditable = "true";
      editMasterBtn.style.display = 'none';
      saveMasterBtn.style.display = 'inline-block';
    };
    saveMasterBtn.onclick = () => {
      masterEditing = false;
      masterHistoryTable.contentEditable = "false";
      editMasterBtn.style.display = 'inline-block';
      saveMasterBtn.style.display = 'none';
    };
  }
});

// ---------------- FIRESTORE SNAPSHOT ----------------
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
