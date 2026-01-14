# NurseGrid iCal Range Viewer

Simple local app that fetches an iCal URL, parses events, and shows events within a user-specified date range. Includes an optional text filter and a toggle to include outside-range events (greyed).

Requirements

- Node.js (14+)

Install & run

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser. The iCal URL is pre-filled with the provided NurseGrid calendar.

Notes

- If the iCal host blocks requests or requires authentication, a proxy or credentials will be needed. This server fetches the iCal on your behalf to avoid CORS issues.
