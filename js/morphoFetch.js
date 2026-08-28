/**
 * morphoFetch.js
 * Morphological parses and short definitions, served by the local Homer index.
 *
 * Not cached — see the note in corpusFetch.js. A stale entry here is worse than
 * a stale count, because it renders a parse in a shape the current UI no longer
 * understands.
 */

/**
 * Fetches morphological data for a Greek word.
 *
 * Passing book and line lets the server answer from the treebank's annotation
 * of that exact token, so an ambiguous form comes back already disambiguated
 * rather than as a list of everything it could be.
 *
 * @param {string} word — the Greek word as it appears in the line
 * @param {string|number} [book] — Iliad book number
 * @param {string|number} [line] — line number within that book
 * @returns {Promise<{word:string, parses:Array, definitions:string[], source:string}>}
 */
export async function loadMorphoData(word, book, line) {
  const params = new URLSearchParams({ word });
  if (book != null) params.set('book', book);
  if (line != null) params.set('line', line);

  try {
    const res = await fetch(`http://localhost:3001/api/lookup?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

/** Escapes text before it goes into innerHTML. */
function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Builds the morphology panel.
 * Each parse carries its own gloss and Homer frequency, so a form with more
 * than one possible lemma shows how common each reading actually is.
 */
export function generateMorphoHtml({ parses = [], definitions = [] } = {}) {
  let html = '';
  if (parses.length) {
    html += '<h3>Parses</h3><ul>';
    parses.forEach(p => {
      const bits = [`<strong>${escapeHtml(p.lemma)}</strong>`];
      if (p.parse) bits.push(escapeHtml(p.parse));
      if (p.definition) bits.push(`<em>${escapeHtml(p.definition)}</em>`);
      let row = bits.join(' — ');
      if (p.total) {
        row += ` <span class="freq">(Iliad ${p.iliad}, Odyssey ${p.odyssey})</span>`;
      }
      html += `<li>${row}</li>`;
    });
    html += '</ul>';
  }
  // Kept for parses that carry no gloss of their own.
  const extra = definitions.filter(d => !parses.some(p => p.definition === d));
  if (extra.length) {
    html += '<h3>Definitions</h3><ul>';
    extra.forEach(def => {
      html += `<li>${escapeHtml(def)}</li>`;
    });
    html += '</ul>';
  }
  if (!html) html = '<em>No data found.</em>';
  return html;
}
