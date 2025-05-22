
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

let eintraege = [];

function normalize(str) {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

app.get('/api/eintraege', (req, res) => {
  res.json(eintraege);
});

app.post('/api/eintraege', (req, res) => {
  const { name, adresse, bezirk } = req.body;

  const normName = normalize(name);
  const normAdresse = normalize(adresse);

  const exists = eintraege.find(e =>
    normalize(e.name) === normName &&
    normalize(e.adresse) === normAdresse
  );

  if (exists) {
    return res.status(400).json({ message: 'Eintrag bereits vorhanden' });
  }

  const neuerEintrag = {
    id: Date.now().toString(),
    name,
    adresse,
    bezirk
  };
  eintraege.push(neuerEintrag);
  res.status(201).json(neuerEintrag);
});

app.delete('/api/eintraege/:id', (req, res) => {
  const id = req.params.id;
  eintraege = eintraege.filter(e => e.id !== id);
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Server läuft auf Port ${port}`);
});
