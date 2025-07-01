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
    scores.forEach(s => row.insertCell().textContent = s);
  });
  const totalRow = historyTable.insertRow();
  totalRow.insertCell().textContent = 'Total';
  players.forEach((_, i) => {
    const sum = rounds.reduce((acc, sc) => acc + sc[i], 0);
    totalRow.insertCell().textContent = sum;
  });
}

function updateChart() {
  const dataSets = players.map((name, i) => {
    let cum = 0;
    return {
      label: name,
      data: rounds.map((sc, r) => {
        cum += sc[i];
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

renderScoreInputs();
updateChart();
