const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || 'Tierschutz2025';
const MAX = 20;

app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.json());

const bezirke = require('./data/bezirke.json');
const datenPfad = './data/eintraege.json';

// Datei eintraege.json beim Start laden oder erstellen
let eintraege = [];
if (!fs.existsSync(datenPfad)) {
  fs.writeFileSync(datenPfad, '[]', 'utf-8');
  console.log("Datei eintraege.json wurde erstellt.");
}
try {
  eintraege = JSON.parse(fs.readFileSync(datenPfad, 'utf-8'));
} catch (err) {
  console.error("Fehler beim Laden der Einträge:", err);
  eintraege = [];
}

// Hilfsfunktionen
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

// Eintragen-Route
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

  const neuerEintrag = { vorname, nachname, strasse, hausnummer, ...bez };
  eintraege.push(neuerEintrag);

  // In Datei speichern
  fs.writeFileSync(datenPfad, JSON.stringify(eintraege, null, 2), 'utf-8');

  res.status(200).json(neuerEintrag);
});

// Start
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
