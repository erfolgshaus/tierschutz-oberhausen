
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || 'Tierschutz2025';
const MAX = 20;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const bezirke = require('./data/bezirke.json');

let eintraege = [];

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

app.post('/eintragen', (req, res) => {
  const { vorname, nachname, strasse, hausnummer } = req.body;
  const bez = findeBezirk(strasse, hausnummer);
  if (!bez) return res.status(400).send("Adresse keinem Bezirk zuordenbar");

  const exists = eintraege.find(e =>
    normalize(e.vorname) === normalize(vorname) &&
    normalize(e.nachname) === normalize(nachname) &&
    normalize(e.strasse) === normalize(strasse) &&
    parseInt(e.hausnummer) === parseInt(hausnummer)
  );
  if (exists) return res.status(400).send("Diese Person wurde bereits eingetragen.");

  const anzahl = eintraege.filter(e => e.bezirksnummer === bez.bezirksnummer).length;
  if (anzahl >= MAX) return res.status(400).send("Bezirk voll");

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  eintraege.push({ id, vorname, nachname, strasse, hausnummer, ...bez });
  res.send(`Eingetragen in ${bez.bezirksname} (Bezirk ${bez.bezirksnummer})`);
});

app.post('/api/admin/delete', (req, res) => {
  const { id } = req.body;
  const index = eintraege.findIndex(e => e.id === id);
  if (index !== -1) {
    eintraege.splice(index, 1);
    return res.status(200).send("Eintrag gelöscht.");
  }
  res.status(404).send("Eintrag nicht gefunden.");
});

app.get('
/api/status', (req, res) => {
  const result = {};

  // Alle Bezirke mit 0 starten
  for (const [id, bezirk] of Object.entries(bezirke)) {
    result[id] = {
      name: bezirk.name,
      anzahl: 0
    };
  }

  // Dann Einträge zählen
  for (const e of eintraege) {
    if (result[e.bezirksnummer]) {
      result[e.bezirksnummer].anzahl++;
    }
  }

  res.json(result);

    if (!result[e.bezirksnummer]) {
      result[e.bezirksnummer] = { name: e.bezirksname, anzahl: 0 };
    }
    result[e.bezirksnummer].anzahl++;
  }
  res.json(result);
});

app.get('/api/eintraege/:bezirk', (req, res) => {
  const bezirk = req.params.bezirk;
  const daten = eintraege.filter(e => e.bezirksnummer === bezirk);
  res.json(daten);
});

app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
