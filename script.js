// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBudm3kTAmwHikngh4AlmjekoURZTcXqG4",
  authDomain: "mahjong-web.firebaseapp.com",
  projectId: "mahjong-web",
};
// Initialize Firebase and Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const gameDoc = db.collection('games').doc('default');

// In-memory state
const players = [];
const rounds = [];
let currentScores = [];

// DOM elements
const newPlayerInput = document.getElementById('newPlayer');
const addPlayerBtn   = document.getElementById('addPlayerBtn');
const scoreInputs    = document.getElementById('scoreInputs');
const submitBtn      = document.getElementById('submitBtn');
const resetBtn       = document.getElementById('resetBtn');
const roundNumSpan   = document.getElementById('roundNum');
const historyTable   = document.getElementById('historyTable');
const ctx            = document.getElementById('chartCanvas').getContext('2d');
let chart;

// Render the score input fields
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
  // Wire up inputs to state
  scoreInputs.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      currentScores[e.target.dataset.index] = Number(e.target.value);
    });
  });
}

// Update the historical rounds table
function updateHistory() {
  historyTable.innerHTML = '';
  const header = historyTable.insertRow();
  header.insertCell().textContent = 'Round';
  players.forEach(p => header.insertCell().textContent = p);

  rounds.forEach((scores, r) => {
    const row = historyTable.insertRow();
    row.insertCell().textContent = String(r + 1);
    players.forEach((_, i) => {
      const val = (scores[i] !== undefined ? scores[i] : 0);
      row.insertCell().textContent = String(val);
    });
  });

  const totalRow = historyTable.insertRow();
  totalRow.insertCell().textContent = 'Total';
  players.forEach((_, i) => {
    const sum = rounds.reduce((acc, sc) => acc + (sc[i] !== undefined ? sc[i] : 0), 0);
    totalRow.insertCell().textContent = String(sum);
  });
}

// Update the Chart.js line chart
function updateChart() {
  const dataSets = players.map((name, i) => {
    let cum = 0;
    return {
      label: name,
      data: rounds.map((sc, r) => {
        const delta = sc[i] !== undefined ? sc[i] : 0;
        cum += delta;
        return { x: r + 1, y: cum };
      }),
      fill: false
    };
  });
  const config = {
    type: 'line',
    data: { datasets: dataSets },
    options: {
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Rounds' }, ticks: { stepSize: 1 } },
        y: { title: { display: true, text: 'Cumulative Points' } }
      }
    }
  };
  if (chart) chart.destroy();
  chart = new Chart(ctx, config);
}

// Sync local state to Firestore
function syncToFirestore() {
  gameDoc.set({ players, rounds }).catch(console.error);
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
  updateHistory();
  updateChart();
  syncToFirestore();
};

// Real‑time listener (fires on initial load and any changes)
gameDoc.onSnapshot(doc => {
  const data = doc.data() || { players: [], rounds: [] };
  console.log('Firestore snapshot:', data);
  players.splice(0, players.length, ...data.players);
  rounds.splice(0, rounds.length, ...data.rounds);
  renderScoreInputs();
  roundNumSpan.textContent = String(rounds.length + 1);
  updateHistory();
  updateChart();
}, console.error);
