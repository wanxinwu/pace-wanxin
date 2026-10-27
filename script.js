'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const base = { lat: 24.1796, lng: 120.6495 };
  function renderStats(result) {
    const distances = result.groups.map(group => {
      let meters = 0;
      for (let i = 1; i < group.length; i++) meters += MoveCore.distance({lat: group[i-1][0], lng: group[i-1][1]}, {lat: group[i][0], lng: group[i][1]});
      return meters;
    });
    $('fastestSpeed').textContent = result.fastest.toFixed(2);
    $('segmentCount').textContent = String(distances.length);
    const bars = $('segmentDistances'); bars.replaceChildren();
    if (!distances.length) { bars.textContent = '沒有有效軌跡段'; return; }
    const max = Math.max(...distances, 1);
    distances.forEach((meters, i) => {
      const row = document.createElement('div'); row.className = 'distance-row';
      const label = document.createElement('span'); label.textContent = `第 ${i + 1} 段 · ${meters.toFixed(1)} m`;
      const bar = document.createElement('i'); bar.style.width = `${Math.max(5, meters / max * 100)}%`;
      row.append(label, bar); bars.append(row);
    });
    $('trackWarning').textContent = result.rejected.length
      ? `${result.rejected.length} 個點因速度超過 8 m/s 或 GPS 品質不佳而標記無效，未納入軌跡。`
      : '所有相鄰點均通過 8 m/s 速度上限。';
  }

  $('loadSampleTrack').addEventListener('click', async () => {
    if (!window.PaceTrackDemo) { $('trackWarning').textContent = '軌跡工具尚未載入，請重新整理頁面。'; return; }
    let sample;
    try {
      const response = await fetch('sample-track.json', {cache: 'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const raw = await response.json(), origin = Date.now();
      sample = raw.map(point => ({lat: base.lat + point.north, lng: base.lng + point.east, accuracy: point.accuracy, t: origin + point.seconds * 1000}));
    } catch { $('trackWarning').textContent = '模擬 JSON 載入失敗，請以本機伺服器開啟網站後重試。'; return; }
    const analysis = window.PaceTrackDemo.show(sample);
    renderStats(analysis);
    const meters = analysis.groups.flat().reduce((sum, point, index, all) => index ? sum + MoveCore.distance({lat:all[index-1][0],lng:all[index-1][1]},{lat:point[0],lng:point[1]}) : sum, 0);
    window.dispatchEvent(new CustomEvent('pace:track-loaded',{detail:{id:`sample-${Date.now()}`,title:'模擬 GPS 軌跡',date:new Date().toISOString(),seconds:35,meters,met:4.8,weight:60,points:analysis.accepted}}));
  });

  const toggle = $('themeToggle'), key = 'pace-theme';
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    toggle.textContent = theme === 'dark' ? '☀' : '☾';
    toggle.setAttribute('aria-pressed', String(theme === 'dark'));
    toggle.setAttribute('aria-label', theme === 'dark' ? '切換日間模式' : '切換夜間模式');
    try { localStorage.setItem(key, theme); } catch {}
  }
  let saved = 'light'; try { saved = localStorage.getItem(key) || 'light'; } catch {}
  setTheme(saved === 'dark' ? 'dark' : 'light');
  toggle.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
})();
