// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyBudm3kTAmwHikngh4AlmjekoURZTcXqG4",
  authDomain: "mahjong-web.firebaseapp.com",
  projectId: "mahjong-web",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const gameDoc = db.collection("games").doc("default");

// ---------------- STATE ----------------
let players = [];
let rounds = [];
let currentScores = [];

let historyPlayers = [];
let historyLog = [];

let historyEditing = false;
let masterEditing = false;

let undoSnapshot = null;
let isRestoringUndo = false;

// ---------------- COLORS ----------------
const PLAYER_COLORS = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728",
  "#9467bd", "#8c564b", "#e377c2", "#7f7f7f",
  "#bcbd22", "#17becf"
];
const getPlayerColor = i => PLAYER_COLORS[i % PLAYER_COLORS.length];

// ---------------- DOM READY ----------------
document.addEventListener("DOMContentLoaded", () => {

  // ----- DOM -----
  const $ = id => document.getElementById(id);

  const historyTable = $("historyTable");
  const masterHistoryTable = $("masterHistoryTable");

  const editHistoryBtn = $("editHistoryBtn");
  const saveHistoryBtn = $("saveHistoryBtn");
  const editMasterBtn = $("editMasterBtn");
  const saveMasterBtn = $("saveMasterBtn");

  const tabGameBtn = $("tabGame");
  const tabHistoryBtn = $("tabHistory");
  const gameTab = $("gameTab");
  const historyTab = $("historyTab");

  const resetZoomBtn = $("resetZoomBtn");

  // ---------------- EDIT HELPERS ----------------
  function setTableEditable(table, editable) {
    if (!table) return;
    table.querySelectorAll("td").forEach(td => {
      if (td.cellIndex === 0) return;
      td.contentEditable = editable;
      td.style.background = editable ? "#fff7ed" : "";
    });
  }

  // ---------------- EDIT BUTTONS ----------------
  editHistoryBtn.onclick = () => {
    historyEditing = true;
    setTableEditable(historyTable, true);
    editHistoryBtn.style.display = "none";
    saveHistoryBtn.style.display = "inline-block";
  };

  saveHistoryBtn.onclick = () => {
    historyEditing = false;
    setTableEditable(historyTable, false);
    editHistoryBtn.style.display = "inline-block";
    saveHistoryBtn.style.display = "none";
  };

  editMasterBtn.onclick = () => {
    masterEditing = true;
    setTableEditable(masterHistoryTable, true);
    editMasterBtn.style.display = "none";
    saveMasterBtn.style.display = "inline-block";
  };

  saveMasterBtn.onclick = () => {
    masterEditing = false;
    setTableEditable(masterHistoryTable, false);
    editMasterBtn.style.display = "inline-block";
    saveMasterBtn.style.display = "none";
  };

  // ---------------- TABS ----------------
  tabGameBtn.onclick = () => {
    gameTab.style.display = "block";
    historyTab.style.display = "none";
  };

  tabHistoryBtn.onclick = () => {
    gameTab.style.display = "none";
    historyTab.style.display = "block";
    masterChart?.resetZoom?.();
  };

  // ---------------- CHART ----------------
  const ctx = $("masterChartCanvas")?.getContext("2d");
  let masterChart;

  function renderMasterChart() {
    if (!ctx) return;

    const datasets = historyPlayers.map((p, i) => {
      let sum = 0;
      return {
        label: p,
        data: historyLog.map((r, idx) => {
          sum += r[i] || 0;
          return { x: idx + 1, y: sum };
        }),
        borderColor: getPlayerColor(i),
        tension: 0.3
      };
    });

    masterChart?.destroy();
    masterChart = new Chart(ctx, {
      type: "line",
      data: { datasets },
      options: {
        scales: {
          x: { type: "linear", min: 1, max: Math.max(1, historyLog.length) },
          y: { beginAtZero: true }
        },
        plugins: {
          zoom: {
            pan: { enabled: true, mode: "xy" },
            zoom: { wheel: { enabled: true }, mode: "xy" }
          }
        }
      }
    });
  }

  resetZoomBtn.onclick = () => masterChart?.resetZoom?.();

  // ---------------- RENDER TABLES ----------------
  function renderTables() {
    if (!historyEditing) {
      historyTable.innerHTML = "";
      historyLog.forEach((r, i) => {
        const row = historyTable.insertRow();
        row.insertCell().textContent = i + 1;
        r.forEach(v => row.insertCell().textContent = v);
      });
    }

    if (!masterEditing) {
      masterHistoryTable.innerHTML = "";
      historyLog.forEach((r, i) => {
        const row = masterHistoryTable.insertRow();
        row.insertCell().textContent = i + 1;
        r.forEach(v => row.insertCell().textContent = v);
      });
    }
  }

  // ---------------- FIRESTORE ----------------
  gameDoc.onSnapshot(doc => {
    if (isRestoringUndo || historyEditing || masterEditing) return;
    const d = doc.data();
    if (!d) return;

    players = d.players || [];
    historyPlayers = d.historyPlayers || [];
    historyLog = (d.history || []).map(r =>
      historyPlayers.map(p => r[p] || 0)
    );

    renderTables();
    renderMasterChart();
  });
});
