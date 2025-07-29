/****
 * Sends a translation payload to the server and returns tutor analysis.
 * @param {Object} payload - { lineNumber, originalLine, translationLines, words[], phraseGuess }
 * @returns {Promise<string>}
 */
export async function requestAnalysis(payload) {
  console.log('requestAnalysis payload:', payload);
  const response = await fetch('http://localhost:3001/api/tutor-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  console.log('requestAnalysis response status:', response.status, response.statusText);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to fetch tutor analysis');
  }
  const data = await response.json();
  console.log('requestAnalysis response data:', data);
  return data.analysis;
}
