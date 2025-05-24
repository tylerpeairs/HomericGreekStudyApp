/**
 * server.js
 * Express server providing:
 *  - /api/hits endpoint: fetches corpus hit counts from ARTFL PHILologic via Puppeteer
 *  - /api/lookup endpoint: scrapes morphological parses and short definitions from Logeion via Puppeteer
 * Author: Tyler Peairs
 */
// --- External libraries ---
import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';

// Initialize Express app and enable CORS for all routes
const app = express();
app.use(cors());
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

// Start the Puppeteer proxy server
app.listen(PORT, () => console.log(`Puppeteer service listening on ${PORT}`));