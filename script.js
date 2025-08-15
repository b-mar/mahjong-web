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
const players = [];
const rounds = [];
let currentScores = [];
let historyEditing = false;

// DOM elements
const newPlayerInput = document.getElementById('newPlayer');
const addPlayerBtn   = document.getElementById('addPlayerBtn');
const scoreInputs    = document.getElementById('scoreInputs');
const submitBtn      = document.getElementById('submitBtn');
const resetBtn       = document.getElementById('resetBtn');
const roundNumSpan   = document.getElementById('roundNum');
const historyTable   = document.getElementById('historyTable');
const editHistoryBtn = document.getElementById('editHistoryBtn');
const saveHistoryBtn = document.getElementById('saveHistoryBtn');
const ctx            = document.getElementById('chartCanvas').getContext('2d');
let chart;

// Render score inputs
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

// Update history table
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
      const val = scores[i] !== undefined ? scores[i] : 0;
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

  // Totals row
  const totalRow = historyTable.insertRow();
  totalRow.insertCell().textContent = 'Total';
  players.forEach((_, i) => {
    const sum = rounds.reduce((acc, sc) => acc + (sc[i] !== undefined ? sc[i] : 0), 0);
    totalRow.insertCell().textContent = String(sum);
  });

  // Toggle buttons
  editHistoryBtn.style.display = historyEditing ? 'none' : 'inline-block';
  saveHistoryBtn.style.display = historyEditing ? 'inline-block' : 'none';
}

// Update chart
function updateChart() {
  const dataSets = players.map((name, i) => {
    let cum = 0;
    // include an initial (0,0) point
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
};
  if (chart) chart.destroy();
  chart = new Chart(ctx, config);
}

// Firestore transforms
function roundsToFirestore() {
  return rounds.map(scores => {
    const map = {};
    players.forEach((player, i) => {
      map[player] = scores[i] !== undefined ? scores[i] : 0;
    });
    return map;
  });
}

function roundsFromFirestore(fsRounds) {
  return fsRounds.map(map =>
    players.map(p => Number(map[p] !== undefined ? map[p] : 0))
  );
}

// Sync to Firestore
function syncToFirestore() {
  gameDoc.set({ players, rounds: roundsToFirestore() }).catch(console.error);
}

// Button handlers
addPlayerBtn.onclick = () => {
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

submitBtn.onclick = () => {
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

resetBtn.onclick = () => {
  players.length = 0;
  rounds.length = 0;
  renderScoreInputs();
  roundNumSpan.textContent = '1';
  historyEditing = false;
  updateHistory();
  updateChart();
  syncToFirestore();
};

editHistoryBtn.onclick = () => {
  historyEditing = true;
  updateHistory();
};

saveHistoryBtn.onclick = () => {
  historyEditing = false;
  syncToFirestore();
  updateHistory();
};

// Real-time listener
gameDoc.onSnapshot(doc => {
  const data = doc.data() || { players: [], rounds: [] };
  players.splice(0, players.length, ...data.players);
  const fs = Array.isArray(data.rounds) ? data.rounds : [];
  const newRounds = roundsFromFirestore(fs);
  rounds.splice(0, rounds.length, ...newRounds);
  renderScoreInputs();
  roundNumSpan.textContent = String(rounds.length + 1);
  historyEditing = false;
  updateHistory();
  updateChart();
}, console.error);
