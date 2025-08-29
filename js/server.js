/**
 * server.js
 * Express server providing:
 *  - /api/hits endpoint: fetches corpus hit counts from ARTFL PHILologic via Puppeteer
 *  - /api/lookup endpoint: scrapes morphological parses and short definitions from Logeion via Puppeteer
 *  - /api/tutor-analysis endpoint: provides Homeric Greek tutor analysis via Lambda Labs
 * Author: Tyler Peairs
 */
// --- External libraries ---
import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
dotenv.config();

const LAMBDA_API_KEY = process.env.LAMBDA_API_KEY;
if (!LAMBDA_API_KEY) {
  throw new Error('Missing LAMBDA_API_KEY in environment');
}
const lambdaClient = new OpenAI({
  apiKey: LAMBDA_API_KEY,
  baseURL: 'https://api.lambda.ai/v1',
});

// Initialize Express app and enable CORS for all routes
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;
console.log('Node is running as architecture:', process.arch);

/**
 * GET /api/hits
 * Retrieves the number of concordance hits for a Greek word in the Iliad.
 * Query parameters:
 *   - word: the Greek word to search (required)
 * Response: JSON { resultsLength: number }
 */
app.get('/api/hits', async (req, res) => {
  const { word } = req.query;
  if (!word) {
    console.log('No word provided in query.');
    return res.status(400).json({ error: 'Missing word' });
  }

  try {
    console.log(`Fetching concordance hits for word: ${word}`);
    const url = `https://artflsrv03.uchicago.edu/philologic4/Greek/query?report=concordance&method=phrase&q=${encodeURIComponent(word)}&start=0&end=0&author=&script=&frequency_field=&arg=&sort_order=rowid&title=%22Iliad%22`;
    console.log(`Visiting URL: ${url}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log(`Page loaded: ${url}`);

    const selector = '#search-hits[description]';
    if (await page.$(selector)) {
      const count = await page.$eval('#search-hits', el => JSON.parse(el.getAttribute('description')).resultsLength);
      console.log(`Found hit count: ${count}`);
      await browser.close();
      res.json({ resultsLength: count });
    } else {
      console.log('Selector not found. Returning 0 results.');
      await browser.close();
      res.json({ resultsLength: 0 });
    }
  } catch (err) {
    console.error(`Error fetching hits for word "${word}":`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/lookup
 * Scrapes morphological parses and short definitions for a Greek word from Logeion.
 * Query parameters:
 *   - word: the Greek word to lookup (required)
 * Response: JSON { word: string, parses: Array<{lemma:string, parse:string}>, definitions: string[] }
 */
app.get('/api/lookup', async (req, res) => {
  const word = req.query.word || '';
  if (!word) return res.status(400).json({ error: 'Missing word' });
  try {
    console.log(`Fetching morphology for word: ${word}`);
    const url = `https://logeion.uchicago.edu/morpho/${encodeURIComponent(word)}`;
    console.log(`Visiting URL: ${url}`);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    console.log(`Page loaded: ${url}`);

    await page.waitForSelector('ul.parse li');
    console.log('Found morphological parse selector.');

    const parses = await page.$$eval('ul.parse li', lis =>
      lis.map(li => {
        const lemmaNode = li.querySelector('p a');
        const lemmaText = lemmaNode ? lemmaNode.textContent.trim() : '';
        const parseNode = li.querySelector('p[ng-bind-html]');
        const parseText = parseNode ? parseNode.textContent.trim() : '';
        return { lemma: lemmaText, parse: parseText };
      })
    );

    let definitions = [];
    const shortDefSelector = 'div[ng-if="vm.shortDef.length > 0"] ul li';
    if (await page.$(shortDefSelector)) {
      console.log('Found short definition selector.');
      definitions = await page.$$eval(shortDefSelector, lis =>
        lis.map(li => li.textContent.trim())
      );
    } else {
      console.log('No short definitions found.');
    }

    await browser.close();
    console.log(`Returning results for word: ${word}`);
    res.json({ word, parses, definitions });
  } catch (err) {
    console.error(`Error fetching morphology for word "${word}":`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/tutor-analysis
 * Receives translation payload and returns tutor analysis via Lambda Labs.
 */
app.post('/api/tutor-analysis', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Tutor-analysis payload:', payload);
    const systemPrompt = [
      'You are a specialized Homeric Greek tutor.',
      'INPUT FIELDS:',
      '- originalLine: the target Greek line.',
      '- wordGuesses: array of { word, translationGuess, formGuess } supplied by the user.',
      '- phraseGuessText: the user\'s full-phrase translation guess.',
      '- referenceTranslations: Lattimore line for context. It should be heavily considered but not quoted or paraphrased.',
      'TASK:',
      '1) Verify each wordGuess: give correct lemma and precise morphology (case/number/gender for nominals; person/number/tense/voice/mood for verbs).',
      '2) Identify mistranslations, omissions, or additions; explain briefly (1–2 lines each).',
      '3) Analyze syntax (particles, enclitics, clause relations, notable word order).',
      '4) Produce ONE polished literal English translation of originalLine.',
      '5) Add ONE concise study tip tailored to this line.',
      'OUTPUT FORMAT (ALL sections required in this exact order; if nothing to add, write "None."):',
      'WORD-LEVEL CORRECTIONS:\n- …\nSYNTAX NOTES:\n- …\nLITERAL TRANSLATION:\n…\nIDIOMATIC NUANCES:\n- …\nSTUDY TIP:\n…',
    ].join(' ');
    console.log('Tutor model: llama-4-maverick-17b-128e-instruct-fp8');
    const userContent = JSON.stringify(payload, null, 2);
    const response = await lambdaClient.chat.completions.create({
      model: 'llama-4-maverick-17b-128e-instruct-fp8',
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });
    console.log('Lambda completion raw response:', response);
    console.log('Lambda response choices:', response.choices);
    const analysis = response.choices?.[0]?.message?.content || '';
    console.log('Extracted analysis:', analysis);
    res.json({ analysis });
  } catch (err) {
    console.error('Error in tutor-analysis:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the Puppeteer proxy server
app.listen(PORT, () => console.log(`Puppeteer service listening on ${PORT}`));