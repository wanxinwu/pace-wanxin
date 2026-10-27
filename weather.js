'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const endpoint = new URL('https://api.open-meteo.com/v1/forecast');
  endpoint.search = new URLSearchParams({
    latitude: '24.1796',
    longitude: '120.6495',
    daily: 'precipitation_probability_max',
    forecast_days: '5',
    timezone: 'Asia/Taipei'
  });

  function dateLabel(value, index) {
    if (index === 0) return '今天';
    if (index === 1) return '明天';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    return `${new Intl.DateTimeFormat('zh-TW', {weekday:'short'}).format(date)} ${month}/${day}`;
  }
  function render(data) {
    const dates = data?.daily?.time, values = data?.daily?.precipitation_probability_max;
    if (!Array.isArray(dates) || !Array.isArray(values) || !dates.length) throw new Error('預報資料格式不完整');
    const root = $('rainDays'); root.replaceChildren();
    dates.forEach((date, index) => {
      const value = values[index], known = Number.isFinite(value);
      const card = document.createElement('article'); card.className = 'rain-day';
      const day = document.createElement('span'); day.className = 'rain-day-label'; day.textContent = dateLabel(date, index);
      const percent = document.createElement('strong'); percent.className = 'rain-percent'; percent.textContent = known ? `${Math.round(value)}%` : '—';
      const bar = document.createElement('span'); bar.className = 'rain-bar';
      const fill = document.createElement('i'); fill.style.width = known ? `${Math.max(0, Math.min(100, value))}%` : '0%'; bar.append(fill);
      const caption = document.createElement('small'); caption.textContent = known ? (value >= 60 ? '雨機率高' : value >= 30 ? '留意降雨' : '低機率') : '暫無資料';
      card.append(day, percent, bar, caption); root.append(card);
    });
    const updated = new Intl.DateTimeFormat('zh-TW', {hour:'2-digit',minute:'2-digit',timeZone:'Asia/Taipei'}).format(new Date());
    $('rainStatus').textContent = `更新於 ${updated}`;
    $('retryRainForecast').hidden = true;
  }
  async function load() {
    const button = $('retryRainForecast'); button.hidden = true;
    $('rainStatus').textContent = '正在取得天氣預報…';
    try {
      const response = await fetch(endpoint, {cache:'no-store'});
      if (!response.ok) throw new Error(`天氣服務回應 ${response.status}`);
      render(await response.json());
    } catch {
      $('rainDays').replaceChildren();
      const message = document.createElement('p'); message.className = 'rain-placeholder'; message.textContent = '目前無法取得天氣預報，請稍後再試。'; $('rainDays').append(message);
      $('rainStatus').textContent = '預報暫時無法載入';
      button.hidden = false;
    }
  }
  $('retryRainForecast').addEventListener('click', load);
  load();
})();
