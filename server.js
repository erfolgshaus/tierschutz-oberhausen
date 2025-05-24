
const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || 'Tierschutz2025';
const MAX = 20;

const DATA_FILE = path.join(__dirname, 'data/eintraege.json');

// JSON Datei laden oder erstellen
function loadEintraege() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } else {
      fs.writeFileSync(DATA_FILE, '[]');
      return [];
    }
  } catch (e) {
    console.error("Fehler beim Laden der Datei:", e);
    return [];
  }
}

function saveEintraege(eintraege) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(eintraege, null, 2));
  } catch (e) {
    console.error("Fehler beim Speichern:", e);
  }
}

let eintraege = loadEintraege();

app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.json());

const bezirke = require('./data/bezirke.json');

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
      const match = normalize(s.name);
      if (norm === match) {
        const gerade = parseInt(s.gerade_von) <= nr && nr <= parseInt(s.gerade_bis);
        const ungerade = parseInt(s.ungerade_von) <= nr && nr <= parseInt(s.ungerade_bis);
        if ((nr % 2 === 0 && gerade) || (nr % 2 === 1 && ungerade)) {
          return id;
        }
      }
    }
  }
  return null;
}

app.get('/api/eintraege', (req, res) => {
  res.json(eintraege);
});

app.post('/api/eintragen', (req, res) => {
  const { vorname, nachname, strasse, hausnummer } = req.body;
  if (!vorname || !nachname || !strasse || !hausnummer) {
    return res.status(400).json({ error: 'Fehlende Felder' });
  }

  const nameKey = `${vorname.trim().toLowerCase()} ${nachname.trim().toLowerCase()}`.replace(/\s+/g, ' ');
  const strasseKey = `${normalize(strasse)} ${hausnummer}`.replace(/\s+/g, ' ');

  const existiert = eintraege.some(e => 
    `${e.vorname.trim().toLowerCase()} ${e.nachname.trim().toLowerCase()}`.replace(/\s+/g, ' ') === nameKey &&
    `${normalize(e.strasse)} ${e.hausnummer}`.replace(/\s+/g, ' ') === strasseKey
  );

  if (existiert) {
    return res.status(409).json({ error: 'Eintrag existiert bereits' });
  }

  const bezirk = findeBezirk(strasse, hausnummer);
  const neuerEintrag = { vorname, nachname, strasse, hausnummer, bezirk };

  eintraege.push(neuerEintrag);
  saveEintraege(eintraege);

  res.status(201).json(neuerEintrag);
});

app.post('/api/entfernen', (req, res) => {
  const { vorname, nachname, strasse, hausnummer, password } = req.body;
  if (password !== PASSWORD) {
    return res.status(403).json({ error: 'Falsches Passwort' });
  }

  eintraege = eintraege.filter(e => 
    !(e.vorname === vorname && e.nachname === nachname && e.strasse === strasse && e.hausnummer === hausnummer)
  );
  saveEintraege(eintraege);
  res.json({ success: true });
});


app.get('/api/status', (req, res) => {
  const status = {};
  for (const e of eintraege) {
    if (e.bezirk) {
      if (!status[e.bezirk]) status[e.bezirk] = { anzahl: 0 };
      status[e.bezirk].anzahl++;
    }
  }
  res.json(status);
});

app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));

