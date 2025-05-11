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
  return str.toLowerCase().replace(/strasse|str\.|str/g, 'straße')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/\s+/g, '');
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