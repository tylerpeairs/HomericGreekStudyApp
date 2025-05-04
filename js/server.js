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

/**
 * GET /api/hits
 * Retrieves the number of concordance hits for a Greek word in the Iliad.
 * Query parameters:
 *   - word: the Greek word to search (required)
 * Response: JSON { resultsLength: number }
 */
app.get('/api/hits', async (req, res) => {
  const { word } = req.query;
  if (!word) return res.status(400).json({ error: 'Missing word' });

  try {
    // Build ARTFL PHILologic URL for concordance query
    const url = `https://artflsrv03.uchicago.edu/philologic4/Greek/query?report=concordance&method=phrase&q=${encodeURIComponent(word)}&start=0&end=0&author=&script=&frequency_field=&arg=&sort_order=rowid&title=%22Iliad%22`
    // Launch headless browser
    const browser = await puppeteer.launch({ headless: true });
    // Navigate to query page and wait for network idle
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    // Wait for results to load and extract hit count
    await page.waitForSelector('#search-hits[description]', { timeout: 10000 });
    const count = await page.$eval('#search-hits', el => JSON.parse(el.getAttribute('description')).resultsLength);
    // Close the browser
    await browser.close();
    // Respond with JSON containing hit count
    res.json({ resultsLength: count });
  } catch (err) {
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
    // Build Logeion Morpho URL for the word
    const url = `https://logeion.uchicago.edu/morpho/${encodeURIComponent(word)}`;
    // Launch headless browser
    const browser = await puppeteer.launch({ headless: true });
    // Navigate to the Logeion page and wait for content
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Scrape morphological parses and short definitions
    await page.waitForSelector('ul.parse li', { timeout: 10000 });
    const parses = await page.$$eval('ul.parse li', lis =>
      lis.map(li => {
        const lemmaNode = li.querySelector('p a');
        const lemmaText = lemmaNode ? lemmaNode.textContent.trim() : '';
        const parseNode = li.querySelector('p[ng-bind-html]');
        const parseText = parseNode ? parseNode.textContent.trim() : '';
        return { lemma: lemmaText, parse: parseText };
      })
    );

    // 2) Scrape short definitions if present
    let definitions = [];
    const shortDefSelector = 'div[ng-if="vm.shortDef.length > 0"] ul li';
    if (await page.$(shortDefSelector)) {
      definitions = await page.$$eval(shortDefSelector, lis =>
        lis.map(li => li.textContent.trim())
      );
    }

    // Close the browser
    await browser.close();
    // Respond with JSON containing word, parses, definitions
    res.json({ word, parses, definitions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start the Puppeteer proxy server
app.listen(PORT, () => console.log(`Puppeteer service listening on ${PORT}`));