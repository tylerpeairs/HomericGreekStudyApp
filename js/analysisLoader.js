/****
 * analysisLoader.js
 * Sends a translation payload to the server and reads back the tutor analysis.
 *
 * The endpoint streams, so the text arrives in pieces. Callers that want to
 * show it as it lands pass an onDelta callback; the promise still resolves with
 * the whole analysis either way, so a caller that only wants the finished text
 * can ignore the streaming entirely.
 *
 * @param {Object} payload - { lineNumber, originalLine, wordGuesses[], userTranslation, actualTranslation }
 * @param {(text: string) => void} [onDelta] - called with the analysis so far
 * @returns {Promise<string>} the complete analysis
 */
export async function requestAnalysis(payload, onDelta) {
  const response = await fetch('http://localhost:3001/api/tutor-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch tutor analysis');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let analysis = '';

  // Server-sent events arrive as "data: {...}" blocks separated by a blank
  // line, and a single read can end mid-event, so only whole blocks are parsed
  // and the remainder stays in the buffer for the next one.
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const line = block.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;

      const event = JSON.parse(line.slice(5).trim());
      if (event.error) throw new Error(event.error);
      if (event.delta) {
        analysis += event.delta;
        onDelta?.(analysis);
      }
    }
  }
  return analysis;
}
