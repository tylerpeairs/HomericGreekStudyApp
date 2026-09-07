/**
 * server.js
 * Express server providing:
 *  - /api/hits endpoint: lemma frequency in Homer, from the local Perseus index
 *  - /api/lookup endpoint: morphological parses and short definitions, from the same index
 *  - /api/concordance endpoint: every line in Homer where a lemma occurs
 *  - /api/tutor-analysis endpoint: streams Homeric Greek tutor analysis via OpenAI GPT-5
 *  - /api/translation-log endpoint: reads/appends the translation journal file on disk
 * Author: Tyler Peairs
 */
// --- External libraries ---
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { loadHomerIndex, lookup, count, concordance } from './homerIndex.js';
dotenv.config();

const TRANSLATION_LOG_PATH = path.resolve('data', 'translationJournal.md');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY in environment');
}
const openaiClient = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Initialize Express app and enable CORS for all routes
const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
const PORT = process.env.PORT || 3001;
console.log('Node is running as architecture:', process.arch);

/**
 * GET /api/hits
 * Lemma frequency across Homer (Iliad + Odyssey), matching the totals ARTFL
 * reports for author=Homer.
 *
 * The clicked word is an inflected form, so it is resolved to its lemma first —
 * counting the surface form directly is what made this endpoint report 0 for
 * nearly every word it was previously asked about.
 *
 * Query parameters:
 *   - word: the Greek word as it appears in the line (required)
 *   - book, line: Iliad location, for the in-context parse (optional)
 * Response: JSON { resultsLength, iliad, odyssey, lemma, lemmas[] }
 */
app.get('/api/hits', (req, res) => {
  const { word, book, line } = req.query;
  if (!word) {
    console.log('No word provided in query.');
    return res.status(400).json({ error: 'Missing word' });
  }

  try {
    const { analyses, source } = lookup(word, book, line);
    if (!analyses.length) {
      console.log(`No lemma found for word: ${word}`);
      return res.json({ resultsLength: 0, iliad: 0, odyssey: 0, lemma: null, lemmas: [] });
    }

    // Distinct lemmas, most frequent first — an ambiguous form should lead with
    // the reading the reader is most likely looking at.
    const byLemma = new Map();
    for (const item of analyses) {
      if (!byLemma.has(item.lemma)) byLemma.set(item.lemma, count(item.lemma));
    }
    const lemmas = [...byLemma].map(([lemma, counts]) => ({ lemma, ...counts }));
    lemmas.sort((a, b) => b.total - a.total);

    const primary = lemmas[0];
    console.log(`Hits for "${word}" [${source}]: ${primary.lemma} = ${primary.total}`);
    res.json({
      resultsLength: primary.total,
      iliad: primary.iliad,
      odyssey: primary.odyssey,
      lemma: primary.lemma,
      lemmas,
    });
  } catch (err) {
    console.error(`Error looking up hits for word "${word}":`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lookup
 * Morphological parses and short definitions for a Greek word.
 *
 * When book and line are supplied the parse comes from the treebank's own
 * annotation of that token, so it is already disambiguated in context rather
 * than a list of everything the form could theoretically be.
 *
 * Query parameters:
 *   - word: the Greek word to look up (required)
 *   - book, line: Iliad location (optional)
 * Response: JSON { word, parses: Array<{lemma, parse, ...}>, definitions: string[], source }
 */
app.get('/api/lookup', (req, res) => {
  const { word, book, line } = req.query;
  if (!word) return res.status(400).json({ error: 'Missing word' });
  try {
    const { analyses, source } = lookup(word, book, line);

    const parses = analyses.map(item => ({
      lemma: item.lemma,
      parse: item.parse,
      postag: item.postag,
      definition: item.definition,
      iliad: item.iliad,
      odyssey: item.odyssey,
      total: item.total,
    }));

    // Dedupe glosses while keeping lemma order — an ambiguous form can share one.
    const definitions = [...new Set(analyses.map(item => item.definition).filter(Boolean))];

    console.log(`Lookup "${word}" [${source}]: ${parses.length} parse(s)`);
    res.json({ word, parses, definitions, source });
  } catch (err) {
    console.error(`Error looking up morphology for word "${word}":`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/concordance
 * Every line in Homer where a lemma occurs, as "I:book.line" / "O:book.line".
 * Query parameters:
 *   - lemma: the dictionary form (required)
 *   - limit: maximum citations to return (optional, default 200)
 * Response: JSON { lemma, total, cites: string[] }
 */
app.get('/api/concordance', (req, res) => {
  const { lemma } = req.query;
  if (!lemma) return res.status(400).json({ error: 'Missing lemma' });
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 200;
    const counts = count(lemma);
    res.json({ lemma, total: counts.total, cites: concordance(lemma, limit) });
  } catch (err) {
    console.error(`Error building concordance for lemma "${lemma}":`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tutor-analysis
 * Receives a translation payload and streams tutor analysis back as server-sent
 * events: `{delta}` for each chunk of text, then `{done:true}`, or `{error}` if
 * the model call fails after the stream has already started.
 */
app.post('/api/tutor-analysis', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Tutor-analysis payload:', payload);
    const systemPrompt = [
      'You are a Homeric Greek tutor.',
      'Provide corrections to morphology, note syntax briefly, give a literal translation, one idiomatic note if needed, and one short study tip.',
      'OUTPUT FORMAT (all sections required in this exact order):',
      'WORD CORRECTIONS:\n- …\nSYNTAX:\n- …\nTRANSLATION:\n…\nSTUDY TIP:\n…',
    ].join(' ');
    const userContent = JSON.stringify(payload, null, 2);

    console.log('Sending OpenAI Responses API request with model: gpt-5.5');
    const stream = await openaiClient.responses.create({
      model: 'gpt-5.5',
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      // The two settings that decide how long this takes. Default effort and
      // verbosity spent 17-30s composing several paragraphs of prose; the
      // feedback the app actually renders is four short sections, and asking
      // for that directly answers in about five.
      reasoning: { effort: 'low' },
      text: { verbosity: 'low' },
      stream: true,
    });

    // Streamed as server-sent events so the reader starts seeing the analysis
    // in about a second and a half rather than waiting for all of it.
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let analysis = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        analysis += event.delta;
        res.write(`data: ${JSON.stringify({ delta: event.delta })}\n\n`);
      } else if (event.type === 'response.failed' || event.type === 'error') {
        throw new Error(event.response?.error?.message || event.message || 'stream failed');
      }
    }
    console.log('Extracted analysis:', analysis);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Error in tutor-analysis:', err);
    // Once the event stream has started there is no status code left to set,
    // so the failure has to travel as an event the client can render.
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

/**
 * GET /api/translation-log
 * Returns the full contents of the translation journal file on disk.
 * Response: JSON { text: string }
 */
app.get('/api/translation-log', async (req, res) => {
  try {
    const text = await fs.readFile(TRANSLATION_LOG_PATH, 'utf8').catch(err => {
      if (err.code === 'ENOENT') return '';
      throw err;
    });
    res.json({ text });
  } catch (err) {
    console.error('Error reading translation log:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/translation-log
 * Appends the given text to the translation journal file on disk,
 * creating the file (and its parent directory) if needed.
 * Body: { text: string }
 */
app.post('/api/translation-log', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });
  try {
    await fs.mkdir(path.dirname(TRANSLATION_LOG_PATH), { recursive: true });
    await fs.appendFile(TRANSLATION_LOG_PATH, text, 'utf8');
    res.json({ success: true });
  } catch (err) {
    console.error('Error appending to translation log:', err);
    res.status(500).json({ error: err.message });
  }
});

// Load the Homer index before accepting requests, so no lookup races the parse.
let index;
try {
  index = await loadHomerIndex();
} catch (err) {
  // A missing index is a setup step, not a crash worth a stack trace.
  console.error(err.message);
  process.exit(1);
}
console.log(
  `Homer index loaded: ${Object.keys(index.lemmas).length.toLocaleString()} lemmas, ` +
  `${Object.keys(index.forms).length.toLocaleString()} forms`
);

app.listen(PORT, () => console.log(`Study service listening on ${PORT}`));