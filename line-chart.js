/* =====================================================================
   Rainfall design system — LineChart component (standalone, vanilla JS)
   ---------------------------------------------------------------------
   Usage:
     Rainfall.renderLineChart(host, series, options)

   Series shape:
     [{ name: string, values: number[], color?: string }, ...]

   Options:
     xLabel(i)       — label for x-axis tick i (index into full series)
     formatValue(v)  — format y values (default: signed integer)
     sortTooltip     — 'desc' | 'asc' | 'none'
     palette         — override color array
     height          — chart height in px (default 280)

   Double-click zoom:
     1st dblclick → ±20 rounds around clicked point (if data allows)
     2nd dblclick → ±5 rounds around clicked point (if data allows)
     3rd dblclick → reset to full view
   ===================================================================== */

(function () {
  const NS = 'http://www.w3.org/2000/svg';

  const DEFAULT_PALETTE = [
    '#728383', '#B86F58', '#C9974A', '#5F7E62', '#6B8AA1',
    '#8A6D90', '#B57878', '#8C8F5C', '#5C6680', '#9C7B92',
  ];

  function svgEl(name, attrs) {
    const el = document.createElementNS(NS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function smoothPath(pts, tension) {
    if (pts.length < 2) return '';
    if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
    const t = tension == null ? 0.5 : tension;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + ((p2.x - p0.x) / 6) * t * 2;
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * t * 2;
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * t * 2;
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * t * 2;
      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }

  function renderLineChart(host, series, opts) {
    if (!host) return;
    host.innerHTML = '';
    const options = opts || {};

    if (!series || !series.length || !series[0].values || !series[0].values.length) {
      host.innerHTML = '<div class="chart-empty">No data to plot.</div>';
      return;
    }

    // Persist full series so zoom re-renders can use original data
    host._chartSeries = series;
    host._chartOpts   = opts;

    const palette  = options.palette || DEFAULT_PALETTE;
    const xLabel   = options.xLabel || ((i) => String(i));
    const fmt      = options.formatValue || ((v) => (v > 0 ? '+' : '') + v);
    const tension  = options.tension == null ? 0.5 : options.tension;
    const sortMode = options.sortTooltip || 'desc';
    const xTitle   = options.xTitle || null;
    const yTitle   = options.yTitle || null;

    // ---- ZOOM STATE (persists across re-renders) ----
    if (!host._zoomState) host._zoomState = { level: 0, centerIdx: 0 };
    const zoom = host._zoomState;

    const fullN       = series[0].values.length;
    const fullLastIdx = fullN - 1;

    // Resolve visible index range for current zoom level
    let loIdx = 0, hiIdx = fullLastIdx;
    if (zoom.level === 1) {
      loIdx = Math.max(0, zoom.centerIdx - 20);
      hiIdx = Math.min(fullLastIdx, zoom.centerIdx + 20);
      if (loIdx === 0 && hiIdx === fullLastIdx) zoom.level = 0; // not enough data
    } else if (zoom.level === 2) {
      loIdx = Math.max(0, zoom.centerIdx - 5);
      hiIdx = Math.min(fullLastIdx, zoom.centerIdx + 5);
      if (loIdx === 0 && hiIdx === fullLastIdx) zoom.level = 0;
    }

    // Build colour-assigned series, sliced to visible range
    const seriesC = series.map((s, i) => ({
      name:   s.name,
      values: s.values.slice(loIdx, hiIdx + 1),
      color:  s.color || palette[i % palette.length],
    }));

    const N       = seriesC[0].values.length;
    const lastIdx = N - 1;

    // xLabel offset so labels show original round numbers when zoomed
    const displayLabel = (i) => xLabel(i + loIdx);

    const hostW = host.clientWidth;
    const W = hostW > 8 ? hostW - 8 : 720;
    const H = options.height || 280;
    const PAD    = { l: 44, r: 20, t: 18, b: 30 };
    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;

    let yMin = 0, yMax = 0;
    seriesC.forEach(s => s.values.forEach(v => {
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }));
    if (yMin === yMax) { yMin -= 5; yMax += 5; }
    const yPad = Math.max(4, Math.round((yMax - yMin) * 0.12));
    yMin -= yPad; yMax += yPad;

    const xScale = (i) => PAD.l + (lastIdx === 0 ? innerW / 2 : (i / lastIdx) * innerW);
    const yScale = (v) => PAD.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

    const yTicks = [];
    for (let i = 0; i < 5; i++) {
      yTicks.push(Math.round(yMin + ((yMax - yMin) * i) / 4));
    }

    const svg = svgEl('svg', {
      viewBox: `0 0 ${W} ${H}`,
      width: '100%',
      height: H,
      role: 'img',
      'aria-label': options.ariaLabel || 'Line chart',
    });

    yTicks.forEach(v => {
      svg.appendChild(svgEl('line', {
        x1: PAD.l, x2: W - PAD.r,
        y1: yScale(v), y2: yScale(v),
        stroke: '#ECEDE8', 'stroke-width': '1',
      }));
      const lbl = svgEl('text', {
        x: PAD.l - 8, y: yScale(v) + 3,
        'text-anchor': 'end',
        fill: '#7E8589',
        'font-size': '11',
        'font-family': 'Nunito Sans, sans-serif',
      });
      lbl.textContent = fmt(v);
      svg.appendChild(lbl);
    });

    if (yMin < 0 && yMax > 0) {
      svg.appendChild(svgEl('line', {
        x1: PAD.l, x2: W - PAD.r,
        y1: yScale(0), y2: yScale(0),
        stroke: '#A5A99B',
        'stroke-width': '1',
        'stroke-dasharray': '3 3',
      }));
    }

    for (let i = 0; i < N; i++) {
      const lbl = svgEl('text', {
        x: xScale(i), y: H - 10,
        'text-anchor': 'middle',
        fill: '#7E8589',
        'font-size': '11',
        'font-family': 'Nunito Sans, sans-serif',
      });
      lbl.textContent = displayLabel(i);
      svg.appendChild(lbl);
    }

    if (yTitle) {
      const t = svgEl('text', {
        x: 14, y: PAD.t + innerH / 2,
        'text-anchor': 'middle',
        transform: `rotate(-90 14 ${PAD.t + innerH / 2})`,
        fill: '#7E8589', 'font-size': '11',
        'font-family': 'Nunito Sans, sans-serif',
      });
      t.textContent = yTitle;
      svg.appendChild(t);
    }
    if (xTitle) {
      const t = svgEl('text', {
        x: PAD.l + innerW / 2, y: H,
        'text-anchor': 'middle',
        fill: '#7E8589', 'font-size': '11',
        'font-family': 'Nunito Sans, sans-serif',
      });
      t.textContent = xTitle;
      svg.appendChild(t);
    }

    // Zoom level badge (top-right corner when zoomed)
    if (zoom.level > 0) {
      const badge = svgEl('text', {
        x: W - PAD.r, y: PAD.t - 4,
        'text-anchor': 'end',
        fill: '#728383',
        'font-size': '10',
        'font-family': 'Nunito Sans, sans-serif',
        opacity: '0.7',
      });
      badge.textContent = zoom.level === 1 ? '±20  ✕ to reset' : '±5  ✕ to reset';
      svg.appendChild(badge);
    }

    const crosshair = svgEl('line', {
      x1: 0, x2: 0,
      y1: PAD.t, y2: PAD.t + innerH,
      stroke: '#728383',
      'stroke-width': '1',
      'stroke-dasharray': '2 3',
      opacity: '0',
    });
    svg.appendChild(crosshair);

    seriesC.forEach(s => {
      const pts = s.values.map((v, i) => ({ x: xScale(i), y: yScale(v) }));
      svg.appendChild(svgEl('path', {
        d: smoothPath(pts, tension),
        fill: 'none',
        stroke: s.color,
        'stroke-width': '2.5',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      }));
      s.values.forEach((v, i) => {
        svg.appendChild(svgEl('circle', {
          cx: xScale(i), cy: yScale(v), r: '3',
          fill: s.color,
        }));
      });
    });

    const rings = seriesC.map(s => {
      const r = svgEl('circle', {
        cx: 0, cy: 0, r: '5.5',
        fill: '#fff', stroke: s.color, 'stroke-width': '2',
        opacity: '0',
      });
      svg.appendChild(r);
      return r;
    });

    const zoneCursor = zoom.level === 2 ? 'zoom-out' : 'zoom-in';
    const zone = svgEl('rect', {
      x: PAD.l - 6, y: PAD.t,
      width: innerW + 12, height: innerH,
      fill: 'transparent',
      style: `cursor: ${zoneCursor};`,
    });
    svg.appendChild(zone);

    host.appendChild(svg);

    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    host.appendChild(tooltip);

    function showHover(i) {
      crosshair.setAttribute('opacity', '0.55');
      crosshair.setAttribute('x1', xScale(i));
      crosshair.setAttribute('x2', xScale(i));

      rings.forEach((ring, idx) => {
        ring.setAttribute('opacity', '1');
        ring.setAttribute('cx', xScale(i));
        ring.setAttribute('cy', yScale(seriesC[idx].values[i]));
      });

      let rows = seriesC.map(s => ({ name: s.name, color: s.color, value: s.values[i] }));
      if (sortMode === 'desc') rows.sort((a, b) => b.value - a.value);
      else if (sortMode === 'asc') rows.sort((a, b) => a.value - b.value);

      tooltip.innerHTML =
        `<div class="chart-tooltip__title">${displayLabel(i)}</div>` +
        rows.map(r => {
          const cls = r.value > 0 ? 'pos' : r.value < 0 ? 'neg' : '';
          return `<div class="chart-tooltip__row">` +
            `<span class="chart-tooltip__name"><span class="chart-tooltip__swatch" style="background:${r.color}"></span>${r.name}</span>` +
            `<span class="chart-tooltip__val ${cls}">${fmt(r.value)}</span>` +
          `</div>`;
        }).join('');

      tooltip.classList.add('chart-tooltip--active');

      const cw = host.clientWidth;
      const ratioX = cw / W;
      const x = Math.max(72, Math.min(cw - 72, xScale(i) * ratioX));
      tooltip.style.left = x + 'px';
      tooltip.style.top = (PAD.t * (host.clientHeight / H)) + 'px';
    }

    function hideHover() {
      crosshair.setAttribute('opacity', '0');
      rings.forEach(r => r.setAttribute('opacity', '0'));
      tooltip.classList.remove('chart-tooltip--active');
    }

    zone.addEventListener('mousemove', (e) => {
      const rect = host.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const ratio = host.clientWidth / W;
      const dataX = mouseX / ratio;
      const t = (dataX - PAD.l) / innerW;
      const idx = Math.max(0, Math.min(lastIdx, Math.round(t * lastIdx)));
      showHover(idx);
    });
    zone.addEventListener('mouseleave', hideHover);

    // ---- DOUBLE-CLICK ZOOM ----
    // Clean up previous listener before re-attaching
    if (host._zoomCleanup) host._zoomCleanup();
    const ac = new AbortController();

    zone.addEventListener('dblclick', (e) => {
      // Suppress text-selection on double-click
      e.preventDefault();

      // Find clicked index in the VISIBLE range, then map to full-data index
      const rect = host.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const ratio = host.clientWidth / W;
      const dataX = mouseX / ratio;
      const t = (dataX - PAD.l) / innerW;
      const visibleIdx   = Math.max(0, Math.min(lastIdx, Math.round(t * lastIdx)));
      const clickedFull  = loIdx + visibleIdx;

      // Level 2 → always reset to full view
      if (zoom.level === 2) {
        zoom.level = 0;
        renderLineChart(host, host._chartSeries, host._chartOpts);
        return;
      }

      // Level 0 → try ±20 first, fall back to ±5 if dataset is too small
      // Level 1 → try ±5
      const levelsToTry = zoom.level === 0 ? [1, 2] : [2];

      for (const lvl of levelsToTry) {
        const range = lvl === 1 ? 20 : 5;
        const lo = Math.max(0, clickedFull - range);
        const hi = Math.min(fullLastIdx, clickedFull + range);
        if (lo === 0 && hi === fullLastIdx) continue; // would show all data — try smaller range
        zoom.level     = lvl;
        zoom.centerIdx = clickedFull;
        renderLineChart(host, host._chartSeries, host._chartOpts);
        return;
      }
      // No level could reduce the view; reset if we were zoomed in
      if (zoom.level > 0) {
        zoom.level = 0;
        renderLineChart(host, host._chartSeries, host._chartOpts);
      }
    }, { signal: ac.signal });

    host._zoomCleanup = () => ac.abort();
  }

  window.Rainfall = window.Rainfall || {};
  window.Rainfall.renderLineChart = renderLineChart;
  window.Rainfall.CHART_PALETTE = DEFAULT_PALETTE.slice();
})();
