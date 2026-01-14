/* Frontend logic: fetch events, render list and a month calendar, export PNG, download iCal */

let allEvents = [];
let currentMonthDate = new Date();

async function fetchICal(url) {
  const resp = await fetch('/fetch?url=' + encodeURIComponent(url));
  if (!resp.ok) throw new Error('Fetch failed: ' + resp.statusText);
  return resp.json();
}

function eventsForDay(events, date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);
  return events.filter((ev) => {
    if (!ev.start || !ev.end) return false;
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    return !(e < dayStart || s > dayEnd);
  });
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Renders a single month.
 * @param {Date} monthDate - A date within the month to render.
 * @param {Array} events - List of all events.
 * @param {Date} schedStart - Global schedule start.
 * @param {Date} schedEnd - Global schedule end.
 * @param {HTMLElement} container - DOM element to render into.
 * @param {boolean} interactive - Whether to show navigation buttons.
 */
function renderCalendar(monthDate, events, schedStart, schedEnd, container, interactive = true) {
  container.innerHTML = '';

  const monthStart = getMonthStart(monthDate);
  const monthName = monthStart.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const header = document.createElement('div');
  header.className = 'cal-header';

  const title = document.createElement('h2');
  title.textContent = monthName;

  if (interactive) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-btn';
    prevBtn.textContent = '◀';
    prevBtn.addEventListener('click', () => {
      currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
      renderCalendar(currentMonthDate, allEvents, schedStart, schedEnd, container);
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-btn';
    nextBtn.textContent = '▶';
    nextBtn.addEventListener('click', () => {
      currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
      renderCalendar(currentMonthDate, allEvents, schedStart, schedEnd, container);
    });

    header.appendChild(prevBtn);
    header.appendChild(title);
    header.appendChild(nextBtn);
  } else {
    // For export, just center the title
    header.style.justifyContent = 'center';
    header.appendChild(title);
  }

  container.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'calendar-grid';

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const d of days) {
    const dh = document.createElement('div');
    dh.className = 'day-header';
    dh.textContent = d;
    grid.appendChild(dh);
  }

  // Calculate grid start
  const firstDay = new Date(monthStart);
  const startOffset = firstDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);

  // 6 weeks * 7 days = 42 cells
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);

    const cell = document.createElement('div');
    cell.className = 'day-cell';

    // Check if day is outside the current month
    const isMuted = day.getMonth() !== monthStart.getMonth();
    if (isMuted) cell.classList.add('muted');

    // Check if after schedule end -> Unknown status
    const dayEndTimestamp = new Date(day).setHours(23, 59, 59, 999);
    let isUnknown = false;

    // Apply post-schedule style only if not already muted (muted takes precedence in hiding)
    if (schedEnd && dayEndTimestamp > schedEnd.getTime()) {
      cell.classList.add('post-schedule');
      isUnknown = true;
    }

    const dayNum = document.createElement('div');
    dayNum.className = 'day-number';
    dayNum.textContent = day.getDate();
    cell.appendChild(dayNum);

    // ONLY Render events if NOT unknown AND NOT muted (prevents duplication)
    if (!isUnknown && !isMuted) {
      const evs = eventsForDay(events, day);

      if (evs.length > 0) {
        cell.classList.add('has-event');
        const summaries = evs.map((x) => (x.summary || '').toLowerCase()).join('||');

        // Keyword styling
        if (summaries.includes('regular shift')) cell.classList.add('cell-kw-regular-shift');
        else if (summaries.includes('on vacation')) cell.classList.add('cell-kw-on-vacation');
        else if (summaries.includes('educational')) cell.classList.add('cell-kw-educational-event');
        else if (summaries.includes('personal')) cell.classList.add('cell-kw-personal-event');
        else if (summaries.includes('payday')) cell.classList.add('cell-kw-payday');

        // Canonical Label
        let label = null;
        let kwClass = '';
        if (summaries.includes('regular shift')) {
          label = 'Regular Shift';
          kwClass = 'kw-regular-shift';
        } else if (summaries.includes('on vacation')) {
          label = 'On Vacation';
          kwClass = 'kw-on-vacation';
        } else if (summaries.includes('educational')) {
          label = 'Education';
          kwClass = 'kw-educational-event';
        } else if (summaries.includes('personal')) {
          label = 'Personal';
          kwClass = 'kw-personal-event';
        } else if (summaries.includes('payday')) {
          label = 'Payday';
          kwClass = 'kw-payday';
        } else {
          label = evs[0].summary || 'Event';
        }

        const list = document.createElement('div');
        list.className = 'day-events';
        const item = document.createElement('div');
        item.className = 'day-event';
        if (kwClass) item.classList.add(kwClass);
        item.textContent = label;

        list.appendChild(item);
        cell.appendChild(list);
      }
    }

    grid.appendChild(cell);
  }

  container.appendChild(grid);
}

async function doFetchAndRender(url, startVal, endVal) {
  const status = document.getElementById('status');
  if (!url) return (status.textContent = 'Enter an iCal URL');
  status.textContent = 'Fetching...';
  const schedStart = startVal ? new Date(startVal + 'T00:00:00') : null;
  const schedEnd = endVal ? new Date(endVal + 'T23:59:59') : null;
  try {
    const data = await fetchICal(url);
    let events = data.events || [];
    events.sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0));
    allEvents = events;
    try {
      localStorage.setItem('icalUrl', url);
    } catch (e) {}

    // Render current view
    const monthDate = schedStart || new Date();
    currentMonthDate = new Date(monthDate);
    renderCalendar(currentMonthDate, allEvents, schedStart, schedEnd, document.getElementById('calendar'));
    status.textContent = `Loaded ${events.length} events`;
  } catch (err) {
    console.error(err);
    status.textContent = 'Error: ' + err.message;
  }
}

document.getElementById('fetchForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const url = document.getElementById('icalUrl').value.trim();
  const startVal = document.getElementById('startDate').value;
  const endVal = document.getElementById('endDate').value;
  await doFetchAndRender(url, startVal, endVal);
});

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const stored = localStorage.getItem('icalUrl');
    if (stored) {
      document.getElementById('icalUrl').value = stored;
      const startVal = document.getElementById('startDate').value;
      const endVal = document.getElementById('endDate').value;
      await doFetchAndRender(stored, startVal, endVal);
    }
  } catch (e) {
    console.warn('Auto-load failed', e);
  }
});

function updateCalendarFromInputs() {
  const startVal = document.getElementById('startDate').value;
  const endVal = document.getElementById('endDate').value;
  const schedStart = startVal ? new Date(startVal + 'T00:00:00') : null;
  const schedEnd = endVal ? new Date(endVal + 'T23:59:59') : null;
  renderCalendar(currentMonthDate, allEvents, schedStart, schedEnd, document.getElementById('calendar'));
}
document.getElementById('startDate').addEventListener('change', updateCalendarFromInputs);
document.getElementById('endDate').addEventListener('change', updateCalendarFromInputs);

document.getElementById('exportPng').addEventListener('click', async () => {
  const startVal = document.getElementById('startDate').value;
  const endVal = document.getElementById('endDate').value;

  // Create off-screen temp container
  const tempContainer = document.createElement('div');
  tempContainer.className = 'export-container';
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '0';
  document.body.appendChild(tempContainer);

  const s = startVal ? new Date(startVal + 'T00:00:00') : null;
  const e = endVal ? new Date(endVal + 'T23:59:59') : null;

  if (s && e) {
    // Multi-month range
    let iter = new Date(s.getFullYear(), s.getMonth(), 1);
    const endMonth = new Date(e.getFullYear(), e.getMonth(), 1);

    // Loop through every month from start to end
    while (iter <= endMonth) {
      const monthWrapper = document.createElement('div');
      monthWrapper.className = 'export-month-wrapper';
      renderCalendar(new Date(iter), allEvents, s, e, monthWrapper, false);
      tempContainer.appendChild(monthWrapper);

      // Move to next month
      iter.setMonth(iter.getMonth() + 1);
    }
  } else {
    // Fallback: just visible month
    const monthWrapper = document.createElement('div');
    monthWrapper.className = 'export-month-wrapper';
    renderCalendar(currentMonthDate, allEvents, s, e, monthWrapper, false);
    tempContainer.appendChild(monthWrapper);
  }

  try {
    await new Promise((r) => requestAnimationFrame(r));
    const canvas = await html2canvas(tempContainer, {
      backgroundColor: '#fdfbf7',
      scale: 2,
    });

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const date = new Date();
    a.download = 'nurse-schedule-' + date.getTime() + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    console.error(err);
    alert('Export failed: ' + err.message);
  } finally {
    if (tempContainer) {
      document.body.removeChild(tempContainer);
    }
  }
});
