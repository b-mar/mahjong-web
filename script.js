// =====================================================================
// Mahjong Scorer — script.js
// Charts: Rainfall.renderLineChart (line-chart.js)
// Styles: components.css
// =====================================================================

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBudm3kTAmwHikngh4AlmjekoURZTcXqG4",
  authDomain: "mahjong-web.firebaseapp.com",
  projectId: "mahjong-web",
};

try { firebase.initializeApp(firebaseConfig); } catch {}
const db = firebase.firestore();
if (location.hostname === 'localhost') {
  db.useEmulator('localhost', 8080);
}
const gameDoc = db.collection('games').doc('default');

// ---------------- STATE ----------------
const players = [];
const rounds = [];
let currentScores = [];
let historyEditing = false;

let historyPlayers = [];
let historyLog = [];
let historyTimestamps = []; // ms epoch per round, parallel to historyLog
let masterEditing = false;

let undoSnapshot = null;
let isRestoringUndo = false;
let masterTableExpanded = false;

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
const editHistoryBtn = document.getElementById('editHistoryBtn');
const saveHistoryBtn = document.getElementById('saveHistoryBtn');
const editMasterBtn = document.getElementById('editMasterBtn');
const saveMasterBtn = document.getElementById('saveMasterBtn');
const gameStatsTable = document.getElementById('gameStatsTable');
const masterStatsTable = document.getElementById('masterStatsTable');

const chartHost = document.getElementById('chartCanvas');
const masterChartHost = document.getElementById('masterChartCanvas');

// ---------------- UNDO ----------------
function takeUndoSnapshot() {
  undoSnapshot = {
    players: [...players],
    rounds: rounds.map(r => [...r]),
    currentScores: [...currentScores],
    historyPlayers: [...historyPlayers],
    historyLog: historyLog.map(r => [...r]),
    historyTimestamps: [...historyTimestamps],
  };
}

function restoreUndoSnapshot() {
  if (!undoSnapshot) return alert("Nothing to undo");

  isRestoringUndo = true;
  historyEditing = false;
  masterEditing = false;
  undoBtn.disabled = false;

  players.splice(0, players.length, ...undoSnapshot.players);
  rounds.splice(0, rounds.length, ...undoSnapshot.rounds.map(r => [...r]));
  currentScores = [...undoSnapshot.currentScores];

  historyPlayers.splice(0, historyPlayers.length, ...undoSnapshot.historyPlayers);
  historyLog.splice(0, historyLog.length, ...undoSnapshot.historyLog.map(r => [...r]));
  historyTimestamps.splice(0, historyTimestamps.length, ...(undoSnapshot.historyTimestamps ?? []));

  renderAll();
  syncToFirestore();

  undoSnapshot = null;
  setTimeout(() => { isRestoringUndo = false; }, 0);
}

// ---------------- INLINE EDIT HELPER ----------------
function makeEditableCell(cell, value, onChangeCallback) {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value ?? 0;
  input.style.width = '4rem';

  input.addEventListener('focus', () => {
    if (!undoSnapshot) takeUndoSnapshot();
  });

  input.addEventListener('change', () => {
    onChangeCallback(Number(input.value));
    renderAll();
  });

  cell.innerHTML = '';
  cell.appendChild(input);
}

// ---------------- SCORE ENTRY ----------------
function renderScoreInputs() {
  if (!scoreInputs) return;
  scoreInputs.innerHTML = '';
  currentScores = players.map(() => 0);

  players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'score-row';
    row.innerHTML = `
      <span class="score-row__name">${name}</span>
      <input type="number" value="0" data-index="${i}" class="score-row__input" />
    `;
    scoreInputs.appendChild(row);

    const inp = row.querySelector('input');
    inp.addEventListener('input', (e) => {
      const v = Number(e.target.value) || 0;
      currentScores[e.target.dataset.index] = v;
      row.classList.toggle('score-row--pos', v > 0);
      row.classList.toggle('score-row--neg', v < 0);
    });
  });
}

// ---------------- ROUND TABLES ----------------
function applyCellTint(cell, value) {
  if (value > 0) cell.classList.add('val-pos');
  else if (value < 0) cell.classList.add('val-neg');
}

function updateHistory() {
  if (!historyTable) return;
  historyTable.innerHTML = '';

  const header = historyTable.insertRow();
  header.insertCell().textContent = 'Round';
  players.forEach(p => header.insertCell().textContent = p);

  const totalScores = players.map(() => 0);

  rounds.forEach((scores, r) => {
    const row = historyTable.insertRow();
    row.insertCell().textContent = r + 1;
    players.forEach((_, i) => {
      const cell = row.insertCell();
      const value = scores[i] ?? 0;

      if (historyEditing) {
        makeEditableCell(cell, value, newVal => {
          rounds[r][i] = newVal;
          totalScores[i] += newVal;
        });
      } else {
        cell.textContent = (value > 0 ? '+' : '') + value;
        applyCellTint(cell, value);
      }
      totalScores[i] += value;
    });
  });

  const totalRow = historyTable.insertRow();
  totalRow.insertCell().textContent = 'Total';
  totalScores.forEach(sum => {
    const cell = totalRow.insertCell();
    cell.textContent = (sum > 0 ? '+' : '') + sum;
  });
}

function updateMasterHistory() {
  if (!masterHistoryTable) return;
  masterHistoryTable.innerHTML = '';

  const header = masterHistoryTable.insertRow();
  header.insertCell().textContent = 'Row';
  historyPlayers.forEach(p => header.insertCell().textContent = p);

  historyLog.forEach((rowVals, r) => {
    const row = masterHistoryTable.insertRow();
    row.insertCell().textContent = r + 1;

    historyPlayers.forEach((_, c) => {
      const cell = row.insertCell();
      const value = rowVals[c] ?? 0;

      if (masterEditing) {
        makeEditableCell(cell, value, newVal => {
          historyLog[r][c] = newVal;
        });
      } else {
        cell.textContent = (value > 0 ? '+' : '') + value;
        applyCellTint(cell, value);
      }
    });
  });

  const summaryRow = masterHistoryTable.insertRow();
  summaryRow.insertCell().textContent = 'Total';
  historyPlayers.forEach((_, c) => {
    const total = historyLog.reduce((sum, row) => sum + (row[c] ?? 0), 0);
    const cell = summaryRow.insertCell();
    cell.textContent = (total > 0 ? '+' : '') + total;
  });

  applyMasterTableState();
}

// ---------------- CHARTS ----------------
function buildCumulativeSeries(playerList, roundList) {
  return playerList.map((name, i) => {
    let cum = 0;
    const values = [0];
    roundList.forEach(r => {
      cum += r[i] ?? 0;
      values.push(cum);
    });
    return { name, values };
  });
}

function updateChart() {
  if (!chartHost) return;
  if (!players.length) {
    chartHost.innerHTML = '<div class="chart-empty">Add players to start a chart.</div>';
    return;
  }
  Rainfall.renderLineChart(
    chartHost,
    buildCumulativeSeries(players, rounds),
    { xLabel: i => i === 0 ? 'Start' : 'R' + i, sortTooltip: 'desc', ariaLabel: 'Cumulative score by round' }
  );
}

function updateMasterChart() {
  if (!masterChartHost) return;
  if (!historyPlayers.length) {
    masterChartHost.innerHTML = '<div class="chart-empty">No history yet.</div>';
    return;
  }
  Rainfall.renderLineChart(
    masterChartHost,
    buildCumulativeSeries(historyPlayers, historyLog),
    { xLabel: i => i === 0 ? 'Start' : 'R' + i, sortTooltip: 'desc', ariaLabel: 'Cumulative score across all games' }
  );
}

// ---------------- DATALIST ----------------
function updatePlayerDatalist() {
  const datalist = document.getElementById('playerSuggestions');
  if (!datalist) return;
  datalist.innerHTML = '';
  historyPlayers
    .filter(p => !players.includes(p))
    .forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      datalist.appendChild(opt);
    });
}

// ---------------- MASTER TABLE COLLAPSE ----------------
function applyMasterTableState() {
  const table = masterHistoryTable;
  if (!table) return;
  const wrap = table.closest('.table-scroll-wrap');
  const rows = Array.from(table.rows);
  const toggleBtn = document.getElementById('masterTableToggleBtn');
  const dataRowCount = Math.max(0, rows.length - 2);

  if (rows.length <= 2) {
    if (toggleBtn) toggleBtn.style.display = 'none';
    return;
  }
  if (toggleBtn) toggleBtn.style.display = '';

  if (masterTableExpanded) {
    rows.forEach(r => r.style.display = '');
    wrap?.classList.add('is-expanded');
    if (toggleBtn) toggleBtn.textContent = 'Collapse ↑';
  } else {
    rows.forEach((r, i) => {
      r.style.display = (i === 0 || i === rows.length - 1) ? '' : 'none';
    });
    wrap?.classList.remove('is-expanded');
    if (toggleBtn) toggleBtn.textContent = `Show all ${dataRowCount} rounds ↓`;
  }
}

// ---------------- HISTORY STAT CARDS ----------------
function computeHistoryStats() {
  if (!historyPlayers.length || !historyLog.length) return null;

  // Most wins: player with the highest count of rounds where score > 0
  let mostWinsCount = 0, mostWinsPlayer = '';
  historyPlayers.forEach((name, i) => {
    const wins = historyLog.filter(r => (r[i] ?? 0) > 0).length;
    if (wins > mostWinsCount) { mostWinsCount = wins; mostWinsPlayer = name; }
  });

  // Biggest hand: highest single-round winning value.
  // Self-draw (1 winner, 3 losers) → divide winner's score by 3 and round,
  // because the winner collected the same base amount from each of the 3 players.
  let biggestHandValue = 0, biggestHandPlayer = '';
  historyLog.forEach(r => {
    const winnerEntries = r.map((s, i) => ({ s: s ?? 0, i })).filter(x => x.s > 0);
    if (winnerEntries.length !== 1) return;
    const { s: winnerScore, i: winnerIdx } = winnerEntries[0];
    const negatives = r.filter(s => (s ?? 0) < 0).length;
    const handValue = negatives === 3 ? Math.round(winnerScore / 3) : winnerScore;
    if (handValue > biggestHandValue) {
      biggestHandValue = handValue;
      biggestHandPlayer = historyPlayers[winnerIdx];
    }
  });

  // Most consecutive wins: longest streak of the same player winning back-to-back.
  // Requires exactly 1 positive score per round to extend a streak.
  let maxStreak = 0, maxStreakPlayer = '';
  let streak = 0, streakPlayer = '';
  historyLog.forEach(r => {
    const winners = r.map((s, i) => ({ s: s ?? 0, i })).filter(x => x.s > 0);
    if (winners.length !== 1) { streak = 0; streakPlayer = ''; return; }
    const name = historyPlayers[winners[0].i];
    streak = name === streakPlayer ? streak + 1 : 1;
    streakPlayer = name;
    if (streak > maxStreak) { maxStreak = streak; maxStreakPlayer = name; }
  });

  return {
    mostWins:   { value: mostWinsCount,    player: mostWinsPlayer },
    biggestHand:{ value: biggestHandValue, player: biggestHandPlayer },
    consecWins: { value: maxStreak,        player: maxStreakPlayer },
  };
}

function updateHistoryStatCards() {
  const stats = computeHistoryStats();
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  if (!stats) {
    ['statMostWinsValue','statMostWinsName','statBiggestHandValue',
     'statBiggestHandName','statConsecWinsValue','statConsecWinsName'].forEach(id => set(id, '—'));
    return;
  }
  set('statMostWinsValue',    stats.mostWins.value    || '—');
  set('statMostWinsName',     stats.mostWins.player   || '—');
  set('statBiggestHandValue', stats.biggestHand.value || '—');
  set('statBiggestHandName',  stats.biggestHand.player|| '—');
  set('statConsecWinsValue',  stats.consecWins.value  || '—');
  set('statConsecWinsName',   stats.consecWins.player || '—');
}

function renderAll() {
  renderScoreInputs();
  updatePlayerDatalist();
  if (roundNumSpan) roundNumSpan.textContent = rounds.length + 1;
  updateHistory();
  updateMasterHistory();
  renderStatsTable(gameStatsTable, players, rounds, true);
  renderStatsTable(masterStatsTable, historyPlayers, historyLog);
  updateHistoryStatCards();
  try { updateChart(); } catch (e) { console.error('chart error:', e); }
  try { updateMasterChart(); } catch (e) { console.error('masterChart error:', e); }
}

// ---------------- STATISTICS ----------------
function computeStats(playerList, roundList) {
  return playerList.map((_, i) => {
    let wins = 0, selfDraws = 0, losses = 0;
    roundList.forEach(r => {
      const score = r[i] ?? 0;
      if (score === 0) return;
      const positives = r.filter(s => (s ?? 0) > 0).length;
      const negatives = r.filter(s => (s ?? 0) < 0).length;
      if (score > 0) {
        wins++;
        if (positives === 1 && negatives === 3) selfDraws++;
      } else {
        losses++;
      }
    });
    return { wins, selfDraws, losses };
  });
}


function renderStatsTable(tableEl, playerList, roundList, showWinLossPct) {
  if (!tableEl) return;
  tableEl.innerHTML = '';
  if (!playerList.length) return;

  const header = tableEl.insertRow();
  ['Player', 'Wins', 'Self-Draws', 'Losses'].forEach((label, i) => {
    const th = document.createElement('th');
    th.textContent = label;
    if (i === 0) th.style.textAlign = 'left';
    header.appendChild(th);
  });

  const totalRounds = roundList.length;

  computeStats(playerList, roundList).forEach((s, i) => {
    if (s.wins === 0 && s.selfDraws === 0 && s.losses === 0) return;
    const row = tableEl.insertRow();
    const nameCell = row.insertCell();
    nameCell.textContent = playerList[i];
    nameCell.style.textAlign = 'left';

    if (showWinLossPct && totalRounds > 0) {
      const winPct  = Math.round((s.wins   / totalRounds) * 100);
      const lossPct = Math.round((s.losses / totalRounds) * 100);
      row.insertCell().textContent = `${s.wins} (${winPct}%)`;
      const sdPct = s.wins > 0 ? Math.round((s.selfDraws / s.wins) * 100) : 0;
      row.insertCell().textContent = `${s.selfDraws} (${sdPct}%)`;
      row.insertCell().textContent = `${s.losses} (${lossPct}%)`;
    } else {
      row.insertCell().textContent = s.wins;
      const sdPct = s.wins > 0 ? Math.round((s.selfDraws / s.wins) * 100) : 0;
      row.insertCell().textContent = `${s.selfDraws} (${sdPct}%)`;
      row.insertCell().textContent = s.losses;
    }
  });
}

// ---------------- SELF-DRAW ANIMATION ----------------
function playSelfDrawAnimation(btn) {
  const rect = btn.getBoundingClientRect();
  const ox = rect.left + rect.width / 2;
  const oy = rect.top + rect.height / 2;

  const TILES = [
    '🀇','🀈','🀉','🀊','🀋','🀌','🀍','🀎','🀏',
    '🀐','🀑','🀒','🀓','🀔','🀕','🀖','🀗','🀘',
    '🀙','🀚','🀛','🀜','🀝','🀞','🀟','🀠','🀡',
    '🀀','🀁','🀂','🀃','🀄','🀅','🀆',
  ];
  const LABELS = ['自摸!', 'Self Draw!'];

  btn.classList.add('sd-btn-flash');
  btn.addEventListener('animationend', () => btn.classList.remove('sd-btn-flash'), { once: true });

  for (let i = 0; i < 55; i++) {
    const isLabel = i % 5 === 0;
    const el = document.createElement('span');
    el.className = 'sd-particle' + (isLabel ? ' is-label' : '');
    el.textContent = isLabel
      ? LABELS[Math.floor(Math.random() * LABELS.length)]
      : TILES[Math.floor(Math.random() * TILES.length)];

    const angle = Math.random() * 2 * Math.PI;
    const dist  = 100 + Math.random() * 380;
    const dx    = (Math.cos(angle) * dist).toFixed(1);
    const dy    = (Math.sin(angle) * dist).toFixed(1);
    const rot   = ((Math.random() - 0.5) * 900).toFixed(0);
    const dur   = ((0.85 + Math.random() * 0.6) / 0.75).toFixed(2);
    const delay = (Math.random() * 0.1).toFixed(3);
    const size  = isLabel
      ? (Math.random() < 0.4 ? 26 + Math.random() * 14 : 13 + Math.random() * 9).toFixed(0) + 'px'
      : (24 + Math.random() * 16).toFixed(0) + 'px';

    el.style.cssText = `left:${ox}px;top:${oy}px;--dx:${dx}px;--dy:${dy}px;--rot:${rot}deg;--dur:${dur}s;--delay:${delay}s;--size:${size};`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), (parseFloat(dur) + parseFloat(delay) + 0.1) * 1000);
  }
}

// ---------------- HELPERS ----------------
function appendCurrentRoundsToHistory() {
  players.forEach(p => {
    if (!historyPlayers.includes(p)) {
      historyPlayers.push(p);
      historyLog.forEach(r => r.push(0));
    }
  });

  const sessionTs = Date.now();
  rounds.forEach(r => {
    const row = historyPlayers.map(() => 0);
    players.forEach((p, i) => {
      row[historyPlayers.indexOf(p)] = r[i] ?? 0;
    });
    historyLog.push(row);
    historyTimestamps.push(sessionTs);
  });
}

// ---------------- FIRESTORE ----------------
function syncToFirestore() {
  try {
    gameDoc.set({
      players,
      rounds: rounds.map(r => Object.fromEntries(players.map((p, i) => [p, r[i] ?? 0]))),
      historyPlayers,
      history: historyLog.map(r => Object.fromEntries(historyPlayers.map((p, i) => [p, r[i] ?? 0]))),
      historyTimestamps: [...historyTimestamps]
    }, { merge: true });
  } catch (err) {
    console.error("Error syncing to Firestore:", err);
  }
}

// ---------------- BUTTON HANDLERS ----------------
addPlayerBtn?.addEventListener('click', () => {
  const name = newPlayerInput.value.trim();
  if (!name) return;
  takeUndoSnapshot();
  players.push(name);
  newPlayerInput.value = '';
  renderAll();
  syncToFirestore();
});

submitBtn?.addEventListener('click', () => {
  const sum = currentScores.reduce((a, b) => a + b, 0);
  if (sum !== 0) return alert('Scores must sum to zero');
  takeUndoSnapshot();

  const positives = currentScores.filter(s => s > 0).length;
  const negatives = currentScores.filter(s => s < 0).length;
  const selfDraw  = positives === 1 && negatives === 3;

  rounds.push([...currentScores]);
  renderAll();
  syncToFirestore();

  if (selfDraw) playSelfDrawAnimation(submitBtn);
});

newGameBtn?.addEventListener('click', () => {
  if (!confirm('Start a new game? This will clear all current players and rounds.\n\nUse "Add to History" first if you want to save this game.')) return;
  takeUndoSnapshot();
  players.length = 0;
  rounds.length = 0;
  currentScores = [];
  renderAll();
  syncToFirestore();
});

appendHistoryBtn?.addEventListener('click', () => {
  if (!rounds.length) return alert('No rounds to add');
  if (!confirm('Add this game to all-time history? This will move all current rounds to history and cannot be undone.')) return;
  takeUndoSnapshot();
  appendCurrentRoundsToHistory();
  rounds.length = 0;
  renderAll();
  syncToFirestore();
});

undoBtn?.addEventListener('click', restoreUndoSnapshot);

// ---------------- TAB SWITCHING ----------------
tabGameBtn?.addEventListener('click', () => {
  gameTabSection.style.display = 'block';
  historyTabSection.style.display = 'none';
  renderAll();
});

tabHistoryBtn?.addEventListener('click', () => {
  gameTabSection.style.display = 'none';
  historyTabSection.style.display = 'block';
  renderAll();
});

// ---------------- EDIT / SAVE ----------------
editHistoryBtn?.addEventListener('click', () => { historyEditing = true; undoBtn.disabled = true; editHistoryBtn.style.display = 'none'; saveHistoryBtn.style.display = 'inline-block'; renderAll(); });
saveHistoryBtn?.addEventListener('click', () => { historyEditing = false; undoBtn.disabled = false; editHistoryBtn.style.display = 'inline-block'; saveHistoryBtn.style.display = 'none'; renderAll(); syncToFirestore(); });

editMasterBtn?.addEventListener('click', () => { masterEditing = true; undoBtn.disabled = true; editMasterBtn.style.display = 'none'; saveMasterBtn.style.display = 'inline-block'; renderAll(); });
saveMasterBtn?.addEventListener('click', () => { masterEditing = false; undoBtn.disabled = false; editMasterBtn.style.display = 'inline-block'; saveMasterBtn.style.display = 'none'; renderAll(); syncToFirestore(); });

document.getElementById('masterTableToggleBtn')?.addEventListener('click', () => {
  masterTableExpanded = !masterTableExpanded;
  applyMasterTableState();
});

// ---------------- FIRESTORE SNAPSHOT ----------------
gameDoc.onSnapshot(doc => {
  if (isRestoringUndo) return;

  const d = doc.data();
  if (!d) return;

  if ((historyEditing || masterEditing) && undoSnapshot) return;

  players.splice(0, players.length, ...(d.players ?? []));
  rounds.splice(0, rounds.length,
    ...(d.rounds ?? []).map(obj => players.map(p => (obj && p in obj ? Number(obj[p]) : 0)))
  );
  currentScores = players.map(() => 0);

  historyPlayers.splice(0, historyPlayers.length, ...(d.historyPlayers ?? []));
  historyLog.splice(0, historyLog.length,
    ...(d.history ?? []).map(obj => historyPlayers.map(p => (obj && p in obj ? Number(obj[p]) : 0)))
  );
  historyTimestamps.splice(0, historyTimestamps.length, ...(d.historyTimestamps ?? []));

  renderAll();
});

// Re-render charts on resize (debounced)
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    try { updateChart(); } catch {}
    try { updateMasterChart(); } catch {}
  }, 120);
});
