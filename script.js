// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBudm3kTAmwHikngh4AlmjekoURZTcXqG4",
  authDomain: "mahjong-web.firebaseapp.com",
  projectId: "mahjong-web",
  // (copy these from your Firebase console’s Web App settings)
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const gameDoc = db.collection('games').doc('default'); 


// script.js
const players = [];
const rounds = [];
let currentScores = [];

const newPlayerInput = document.getElementById('newPlayer');
const addPlayerBtn   = document.getElementById('addPlayerBtn');
const scoreInputs    = document.getElementById('scoreInputs');
const submitBtn      = document.getElementById('submitBtn');
const resetBtn       = document.getElementById('resetBtn');
const roundNumSpan   = document.getElementById('roundNum');
const historyTable   = document.getElementById('historyTable');
const ctx            = document.getElementById('chartCanvas').getContext('2d');

let chart;  // Chart.js instance

function renderScoreInputs() {
  scoreInputs.innerHTML = '';
  currentScores = players.map(_ => 0);
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
    row.insertCell().textContent = (r + 1).toString();
    // handle missing scores as 0
    players.forEach((_, i) => {
      const val = scores[i] !== undefined ? scores[i] : 0;
      row.insertCell().textContent = val;
    });
  });

  const totalRow = historyTable.insertRow();
  totalRow.insertCell().textContent = 'Total';
  players.forEach((_, i) => {
    // sum treating missing as 0
    const sum = rounds.reduce((acc, sc) => acc + (sc[i] !== undefined ? sc[i] : 0), 0);
    totalRow.insertCell().textContent = sum;
  });
}

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

addPlayerBtn.onclick = () => {
  const name = newPlayerInput.value.trim();
  if (!name) return;
  players.push(name);
  newPlayerInput.value = '';
  renderScoreInputs();
  roundNumSpan.textContent = (rounds.length + 1).toString();
  updateChart();
  updateHistory();
};

submitBtn.onclick = () => {
  // ensure the entered scores sum to zero
  const total = currentScores.reduce((a, b) => a + b, 0);
  if (total !== 0) {
    alert(`Error: scores must sum to zero! (currently ${total})`);
    return;
  }
  rounds.push([...currentScores]);
  renderScoreInputs();
  roundNumSpan.textContent = (rounds.length + 1).toString();
  updateChart();
  updateHistory();
};

resetBtn.onclick = () => {
  players.length = 0;
  rounds.length = 0;
  currentScores = [];
  newPlayerInput.value = '';
  renderScoreInputs();
  roundNumSpan.textContent = '1';
  updateChart();
  historyTable.innerHTML = '';
};

// initial render
renderScoreInputs();
updateChart();
