/**
 * server.js
 * Express server providing:
 *  - /api/hits endpoint: fetches corpus hit counts from ARTFL PHILologic via direct proxy
 *  - /api/lookup endpoint: proxies morphological parses and definitions via Perseids Morpheus API
 * Author: Tyler Peairs
 */
// --- External libraries ---
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';


// Initialize Express app and enable CORS for all routes
const app = express();
app.use(cors());

const PORT = process.env.PORT || 3001;


/**
 * GET /api/hits
 * Proxies to Philologic service for concordance hit counts.
 */
app.get('/api/hits', async (req, res) => {
  const { word } = req.query;
  if (!word) return res.status(400).json({ error: 'Missing word' });
  try {
    // Build Philologic Proxy URL for concordance query
    const apiUrl = `http://localhost:8080/philologic/search` +
      `?report=concordance&method=phrase&q=${encodeURIComponent(word)}`;
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) throw new Error(`Philologic API error: ${apiRes.status}`);
    const json = await apiRes.json();
    // Return only the hit count
    res.json({ resultsLength: json.results_length ?? json.resultsLength ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lookup
 * Proxies morphological parses and short definitions for a Greek word via Perseids Morpheus API.
 * Query parameters:
 *   - word: the Greek word to lookup (required)
 * Response: JSON { word: string, parses: Array<{lemma:string, parse:string}>, definitions: string[] }
 */
app.get('/api/lookup', async (req, res) => {
  const word = req.query.word || '';
  if (!word) return res.status(400).json({ error: 'Missing word' });
  try {
    // Proxy to Perseids Morpheus API
    const apiUrl = `http://localhost:1500/analysis/word?lang=grc&engine=morpheusgrc&word=${encodeURIComponent(word)}`;
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) {
      throw new Error(`Morpheus API error: ${apiRes.status}`);
    }
    const raw = await apiRes.json();
    const analyses = raw.analyses || [];
    const parses = analyses.map(a => ({ lemma: a.lemma, parse: a.morph }));
    const definitions = analyses
      .map(a => a.shortdef)
      .filter(def => def && def.trim());
    res.json({ word, parses, definitions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the API proxy server
app.listen(PORT, () => console.log(`API proxy server listening on ${PORT}`));