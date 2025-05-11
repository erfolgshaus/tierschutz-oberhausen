const express = require('express');
const path = require('path');
const fs = require('fs');
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
    .replace(/straße|strasse|str\.|str/g, 'straße')
    .replace(/-/g, '')
    .replace(/ae/g, 'ä').replace(/oe/g, 'ö').replace(/ue/g, 'ü')
    .replace(/\s+/g, '')
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
  const anzahl = eintraege.filter(e => e.bezirksnummer === bez.bezirksnummer).length;
  if (anzahl >= MAX) return res.status(400).send("Bezirk voll");
  eintraege.push({ vorname, nachname, strasse, hausnummer, ...bez });
  res.send(`Eingetragen in ${bez.bezirksname} (Bezirk ${bez.bezirksnummer})`);
});

app.get('/api/status', (req, res) => {
  const result = {};
  for (const [bezNummer, bezirk] of Object.entries(bezirke)) {
    const count = eintraege.filter(e => e.bezirksnummer === bezNummer).length;
    result[bezNummer] = { name: bezirk.name, anzahl: count };
  }
  res.json(result);
});

app.get('/api/eintraege/:bezirk', (req, res) => {
  const bez = req.params.bezirk;
  const data = eintraege.filter(e => e.bezirksnummer === bez);
  res.json(data);
});

app.post('/api/admin/delete', (req, res) => {
  const { index, password } = req.body;
  if (password !== PASSWORD) return res.status(403).send('Falsches Passwort.');
  if (index >= 0 && index < eintraege.length) {
    eintraege.splice(index, 1);
    return res.status(200).send('Eintrag gelöscht.');
  }
  res.status(400).send('Ungültiger Index.');
});

app.get("/", (req, res) => {
  res.send("✅ Tierschutz Fraktion Oberhausen läuft auf Port " + PORT);
});

app.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});