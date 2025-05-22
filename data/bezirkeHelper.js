
function normalizeStreet(str) {
  return str
    .toLowerCase()
    .replace(/straße/g, 'strasse')
    .replace(/str\./g, 'strasse')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBezirk(strasse, hausnummer, daten) {
  const name = normalizeStreet(strasse);
  const istGerade = parseInt(hausnummer) % 2 === 0;
  const nummer = parseInt(hausnummer);

  for (const bezirkKey in daten) {
    const bezirk = daten[bezirkKey];
    for (const abschnitt of bezirk.straßen) {
      const absName = normalizeStreet(abschnitt.name);
      const von = parseInt(abschnitt.von);
      const bis = parseInt(abschnitt.bis);
      const typ = abschnitt.typ;

      if (absName === name) {
        if ((istGerade && typ === 'G') || (!istGerade && typ === 'U')) {
          if (nummer >= von && nummer <= bis) {
            return bezirk.name;
          }
        }
      }
    }
  }
  return null;
}
