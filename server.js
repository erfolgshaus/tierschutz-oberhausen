const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || 'Tierschutz2025';
const MAX = 20;

const DB_PATH = "/data/eintraege.db";
const db = new sqlite3.Database(DB_PATH);

// Datenbank-Tabelle erstellen, wenn sie nicht existiert
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS eintraege (
      id TEXT PRIMARY KEY,
      vorname TEXT,
      nachname TEXT,
      strasse TEXT,
      hausnummer TEXT,
      bezirksnummer TEXT,
      bezirksname TEXT
    )
  `);
});

const bezirke = require('./data/bezirke.json');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.json());

// 🔧 Hilfsfunktionen
function normalize(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/straße|strasse|str\.|str/g, 'straße')
    .replace(/-/g, '')
    .replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü')
    .replace(/[^a-z0-9äöüß\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findeBezirk(strasse, hausnummer) {
  const norm = normalize(strasse);
  const nr = parseInt(hausnummer);
  for (const [id, bezirk] of Object.entries(bezirke)) {
    for (const s of bezirk.straßen) {
      const match = normalize(s.name) === norm;
      const korrekt = (s.typ === 'G' && nr % 2 === 0) || (s.typ === 'U' && nr % 2 === 1);
      if (match && korrekt && nr >= s.von && nr <= s.bis) {
        return { bezirksnummer: id, bezirksname: bezirk.name };
      }
    }
  }
  return null;
}

// 🚀 POST /eintragen
app.post('/eintragen', (req, res) => {
  const { vorname, nachname, strasse, hausnummer } = req.body;
  const bez = findeBezirk(strasse, hausnummer);
  if (!bez) return res.status(400).send("Adresse keinem Bezirk zuordenbar");

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);

  db.all(`SELECT * FROM eintraege`, [], (err, rows) => {
    if (err) return res.status(500).send("DB-Fehler");

    const exists = rows.find(e =>
      normalize(e.vorname) === normalize(vorname) &&
      normalize(e.nachname) === normalize(nachname) &&
      normalize(e.strasse) === normalize(strasse) &&
      parseInt(e.hausnummer) === parseInt(hausnummer)
    );
    if (exists) return res.status(400).send("Diese Person wurde bereits eingetragen.");

    const anzahl = rows.filter(e => e.bezirksnummer === bez.bezirksnummer).length;
    if (anzahl >= MAX) return res.status(400).send("Bezirk voll");

    db.run(`INSERT INTO eintraege VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, vorname, nachname, strasse, hausnummer, bez.bezirksnummer, bez.bezirksname],
      (err) => {
        if (err) return res.status(500).send("Fehler beim Eintragen");
        console.log(`✅ Eingetragen: ${vorname} ${nachname} → ${bez.bezirksname}`);
        res.send(`Eingetragen in ${bez.bezirksname} (Bezirk ${bez.bezirksnummer})`);
      });
  });
});

// 🗑️ POST /api/admin/delete
app.post('/api/admin/delete', (req, res) => {
  const { id } = req.body;
  db.run(`DELETE FROM eintraege WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).send("Fehler beim Löschen.");
    if (this.changes > 0) return res.send("Eintrag gelöscht.");
    res.status(404).send("Eintrag nicht gefunden.");
  });
});

// 📊 GET /api/status
app.get('/api/status', (req, res) => {
  const result = {};
  for (const [id, bezirk] of Object.entries(bezirke)) {
    result[id] = { name: bezirk.name, anzahl: 0 };
  }

  db.all(`SELECT * FROM eintraege`, [], (err, rows) => {
    if (err) return res.status(500).send("DB-Fehler");
    for (const e of rows) {
      if (result[e.bezirksnummer]) result[e.bezirksnummer].anzahl++;
    }
    res.json(result);
  });
});

// 📋 GET /api/eintraege/:bezirk
app.get('/api/eintraege/:bezirk', (req, res) => {
  const bezirk = req.params.bezirk;
  db.all(`SELECT * FROM eintraege WHERE bezirksnummer = ?`, [bezirk], (err, rows) => {
    if (err) return res.status(500).send("DB-Fehler");
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
