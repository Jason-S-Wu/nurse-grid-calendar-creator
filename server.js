const express = require('express');
const ical = require('node-ical');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/fetch', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'missing url param' });
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: 'failed to fetch url' });
    const text = await response.text();
    const data = ical.parseICS(text);
    const events = [];
    for (const k in data) {
      const e = data[k];
      if (e.type === 'VEVENT') {
        events.push({
          id: e.uid || k,
          summary: e.summary || '',
          description: e.description || '',
          start: e.start ? e.start.toISOString() : null,
          end: e.end ? e.end.toISOString() : null,
          organizer: e.organizer ? e.organizer.val || e.organizer : null,
          location: e.location || null,
          transparency: e.transparency || null,
          raw: e,
        });
      }
    }
    res.json({ events });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'parse error', details: String(err) });
  }
});

// Download raw iCal as a file named nursegrid.ics
app.get('/download', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('missing url');
  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(502).send('failed to fetch url');
    const text = await response.text();
    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', 'attachment; filename="nursegrid.ics"');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).send('error fetching iCal');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
