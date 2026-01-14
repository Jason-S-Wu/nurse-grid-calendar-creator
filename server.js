const express = require('express');
const ical = require('node-ical');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

/**
 * Validates that the URL matches the specific NurseGrid pattern:
 * https://app.nursegrid.com/calendars/{ID}/{UUID}
 */
function isValidNurseGridUrl(urlString) {
  if (!urlString) return false;
  try {
    const u = new URL(urlString);

    // 1. Strict Protocol and Host Check
    if (u.protocol !== 'https:') return false;
    if (u.hostname !== 'app.nursegrid.com') return false;

    const pathRegex = /^\/calendars\/[a-zA-Z0-9]+\/[a-fA-F0-9\-]+$/;
    return pathRegex.test(u.pathname);
  } catch (err) {
    return false;
  }
}

app.get('/fetch', async (req, res) => {
  const url = req.query.url;

  // Security: Validate URL against allowlist
  if (!isValidNurseGridUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL. Only app.nursegrid.com calendar URLs are accepted.' });
  }

  try {
    // Security: Add timeout to prevent DoS from hanging requests
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return res.status(502).json({ error: 'Failed to fetch upstream URL' });

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
    console.error('Fetch error:', err.message);
    // Security: Do not leak error details to client
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
