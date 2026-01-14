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
          suggestedMax: historyLog.length > 0 ? historyLog.length + 1 : 1, // dynamic scaling
          title: { display: true, text: 'Rounds' },
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
