/**
 * Load and cache the Murray translation XML, indexed by book → line number.
 */
let _translationIndex = null;
async function _buildTranslationIndex() {
  if (_translationIndex) return _translationIndex;

  const resp = await fetch('data/murrayTranslation.xml');
  if (!resp.ok) throw new Error(`Could not load translation XML: ${resp.status}`);
  const xmlText = await resp.text();
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  
  _translationIndex = {};
  const transDiv = doc.querySelector('div[type="translation"]');
  if (!transDiv) throw new Error('No <div type="translation"> found in XML');

  Array.from(transDiv.querySelectorAll('div[type="textpart"][subtype="book"]')).forEach(bookEl => {
    const bookNum = bookEl.getAttribute('n');
    const linesMap = {};

    // For each <p> under each card, walk its child nodes.
    Array.from(bookEl.querySelectorAll('div[type="textpart"][subtype="card"] p')).forEach(p => {
      let currentLine = null;
      Array.from(p.childNodes).forEach(node => {
        if (node.nodeName === 'milestone' && node.getAttribute('unit') === 'line') {
          currentLine = parseInt(node.getAttribute('n'), 10);
          linesMap[currentLine] = '';
        } else if (currentLine !== null) {
          linesMap[currentLine] += node.textContent;
        }
      });
    });

    _translationIndex[bookNum] = linesMap;
  });

  return _translationIndex;
}

/**
 * Given a book and a line number, return the 5-line chunk covering that line.
 * Always returns an array of up to 5 {n, text} entries.
 */
export async function getTranslationChunk(bookNum, lineNum) {
  const idx = await _buildTranslationIndex();
  const lines = idx[bookNum];
  if (!lines) throw new Error(`No translation for Book ${bookNum}`);
  
  // Determine block index and start line
  let blockIdx, start;
  if (lineNum < 5) {
    blockIdx = 0;
    start = 1;
  } else {
    blockIdx = Math.floor((lineNum - 5) / 5) + 1;
    start = blockIdx * 5;
  }

  // Determine how many lines: first block has 4, others have 5
  const length = blockIdx === 0 ? 4 : 5;
  const chunk = [];

  for (let n = start; n < start + length; n++) {
    if (lines[n] != null) {
      chunk.push({ n, text: lines[n] });
    }
  }
  return chunk;
}