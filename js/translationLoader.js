/**
 * Load and cache the Murray translation XML, indexed by book → line number.
 */
const TEI_NS = 'http://www.tei-c.org/ns/1.0';
let _translationIndex = null;
async function _buildTranslationIndex() {
  if (_translationIndex) return _translationIndex;

  const resp = await fetch('data/murrayTranslation.xml');
  if (!resp.ok) throw new Error(`Could not load translation XML: ${resp.status}`);
  const xmlText = await resp.text();
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  
  _translationIndex = {};
  // Locate the translation <div> in the TEI namespace
  const transDiv = Array.from(doc.getElementsByTagNameNS(TEI_NS, 'div'))
    .find(el => el.getAttribute('type') === 'translation');
  if (!transDiv) throw new Error('No <div type="translation"> found in XML');

  // Find book <div> elements by type and subtype attributes
  Array.from(transDiv.getElementsByTagNameNS(TEI_NS, 'div'))
    .filter(el => el.getAttribute('type') === 'textpart' && el.getAttribute('subtype') === 'book')
    .forEach(bookEl => {
      const bookNum = bookEl.getAttribute('n');
      const linesMap = {};

      // For each <p> under each card, walk all text and element nodes, capturing nested milestones
      Array.from(bookEl.querySelectorAll('div[type="textpart"][subtype="card"] p')).forEach(p => {
        let currentLine = null;
        // Walk all text and element nodes under <p>, capturing nested milestones
        const walker = document.createTreeWalker(
          p,
          NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
          null,
          false
        );
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (node.nodeType === Node.ELEMENT_NODE && node.localName === 'milestone' && node.getAttribute('unit') === 'line') {
            currentLine = parseInt(node.getAttribute('n'), 10);
            linesMap[currentLine] = '';
            console.log('[translationLoader]  New line milestone', currentLine);
          } else if (node.nodeType === Node.TEXT_NODE && currentLine !== null) {
            linesMap[currentLine] += node.textContent;
            console.log('[translationLoader]  Appended text to line', currentLine, ':', node.textContent.trim());
          }
        }
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