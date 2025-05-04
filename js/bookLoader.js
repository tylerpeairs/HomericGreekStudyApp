/**
 * Loads a given Book from your Iliad XML and emits line blocks.
 *
 * Assumes your HTML has:
 *   <select id="bookSelector">…</select>
 *   <button id="loadBookBtn">Load Book</button>
 */
export async function loadIliadBook(bookNum, firstLine = null, lastLine = null) {
  // 1) Fetch the XML text
  const resp = await fetch('data/illiadGreek.xml');
  if (!resp.ok) throw new Error(`XML load failed: ${resp.status}`);
  const xmlText = await resp.text();

  // 2) Parse as XML
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');

  // 3) Find the <div type="textpart" subtype="Book" n="…">
  const bookDiv = doc.querySelector(`div[type="textpart"][subtype="Book"][n="${bookNum}"]`);
  if (!bookDiv) throw new Error(`Book ${bookNum} not found`);

  // 4) Extract each <l> element
  const allLines = Array.from(bookDiv.querySelectorAll('l')).map(el => ({
    n: el.getAttribute('n'),
    text: el.textContent.trim()
  }));
  // If a range is specified, filter lines by line number
  if (firstLine !== null && lastLine !== null) {
    return allLines.filter(line => {
      const num = parseInt(line.n, 10);
      return num >= firstLine && num <= lastLine;
    });
  }
  return allLines;
}

/**
 * Loads a window of up to `maxLines` lines for a given book and line range.
 * Pads backwards if the selected range is shorter than maxLines.
 *
 * @param {string|number} bookNum - The Book number to load.
 * @param {number} firstLine - The starting line number of interest.
 * @param {number} lastLine - The ending line number of interest.
 * @param {number} [maxLines=10] - Maximum number of lines to return.
 * @returns {Promise<Array<{n: string, text: string}>>}
 */
export async function loadBookWindow(bookNum, firstLine, lastLine, maxLines = 10) {
  // Load all lines of the book
  const all = await loadIliadBook(bookNum);

  // Ensure firstLine ≤ lastLine
  if (firstLine > lastLine) {
    [firstLine, lastLine] = [lastLine, firstLine];
  }

  const count = lastLine - firstLine + 1;
  let start, end;

  if (count >= maxLines) {
    // If the range covers at least maxLines, take only the first maxLines
    start = firstLine;
    end = firstLine + maxLines - 1;
  } else {
    // Otherwise, pad backwards up to maxLines, not going below 1
    start = Math.max(1, firstLine - (maxLines - count));
    end = lastLine;
  }

  // Filter and return the selected window of lines
  return all.filter(({ n }) => {
    const num = parseInt(n, 10);
    return num >= start && num <= end;
  });
}
