const puppeteer = require('puppeteer-core');

const DOMAINS = [
  'vidsrcme.ru',
  'vidsrcme.su',
  'vidsrc-me.ru',
  'vidsrc-me.su',
  'vidsrc-embed.ru',
  'vidsrc-embed.su',
  'vsrc.su',
];

function buildEmbedUrl(domain, type, id, season, episode) {
  if (type === 'tv') return `https://${domain}/embed/tv/${id}/${season}/${episode}`;
  return `https://${domain}/embed/movie/${id}`;
}

function classifyUrl(url) {
  if (url.includes('.m3u8'))  return 'hls';
  if (url.includes('.mpd'))   return 'dash';
  if (url.includes('.mp4'))   return 'mp4';
  if (url.includes('.ts'))    return 'hls-segment';
  return 'unknown';
}

function isStreamUrl(url) {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;
  return (
    url.includes('.m3u8')  ||
    url.includes('.mpd')   ||
    url.includes('/hls/')  ||
    url.includes('master.') ||
    url.includes('playlist') ||
    (url.includes('.mp4') &&
      !url.includes('thumbnail') &&
      !url.includes('poster') &&
      !url.includes('logo') &&
      !url.includes('sprite'))
  );
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Selectors to try clicking in order
const PLAY_SELECTORS = [
  'video',
  '.play-button',
  '[class*="play-btn"]',
  '[class*="play-icon"]',
  '.jw-display-click',
  '.jw-display',
  '.plyr__control--overlaid',
  '[aria-label*="play" i]',
  'button',
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: 'BROWSERLESS_TOKEN is not set. Sign up at browserless.io, get your API token, and add it as a Vercel environment variable.',
    });
  }

  const {
    id,
    type    = 'movie',
    season  = '1',
    episode = '1',
    domain  = DOMAINS[0],
  } = req.query;

  if (!id) return res.status(400).json({ error: 'Missing required parameter: id' });

  const embedUrl = buildEmbedUrl(domain, type, id, season, episode);
  const startTime = Date.now();
  const log = [];
  // All responses seen (for debugging when no stream is found)
  const allResponses = [];

  const tick = (msg) => {
    const entry = { ms: Date.now() - startTime, msg };
    log.push(entry);
    console.log(`[${entry.ms}ms] ${msg}`);
  };

  let browser = null;

  try {
    tick(`Connecting to Browserless for ${embedUrl}`);

    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${token}&timeout=55000&stealth`,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://${domain}/`,
    });
    await page.setViewport({ width: 1280, height: 720 });

    const foundUrls = [];

    // Log ALL responses for debugging — helps diagnose when nothing is found
    page.on('response', async (response) => {
      try {
        const url  = response.url();
        const ct   = response.headers()['content-type'] || '';
        const status = response.status();

        // Track all non-trivial requests for the debug log
        if (!url.includes('favicon') && !url.includes('.png') && !url.includes('.jpg') &&
            !url.includes('.svg') && !url.includes('.woff') && !url.includes('.css')) {
          allResponses.push({ url: url.slice(0, 150), status, ct: ct.slice(0, 60) });
        }

        if (
          isStreamUrl(url) ||
          ct.includes('mpegURL') ||
          ct.includes('x-mpegurl') ||
          ct.includes('dash+xml') ||
          ct.includes('octet-stream')
        ) {
          const streamType = classifyUrl(url);
          tick(`✓ Stream found (${streamType}) [${status}]: ${url.slice(0, 120)}`);
          foundUrls.push({ url, type: streamType, ms: Date.now() - startTime });
        }
      } catch (_) {}
    });

    // Intercept requests too (catches URLs before response arrives)
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      try {
        const url = request.url();
        if (isStreamUrl(url) && !foundUrls.some(f => f.url === url)) {
          const streamType = classifyUrl(url);
          tick(`→ Stream request intercepted (${streamType}): ${url.slice(0, 120)}`);
          foundUrls.push({ url, type: streamType, ms: Date.now() - startTime });
        }
        request.continue();
      } catch (_) {
        try { request.continue(); } catch (_2) {}
      }
    });

    // --- Navigation ---
    tick('Navigating to embed page…');
    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    tick('DOM loaded — waiting 3s for scripts to initialise…');
    await sleep(3000);

    // --- Click to trigger playback ---
    // Embeds show a static overlay until clicked; without this no stream loads
    tick('Clicking centre of page to trigger playback…');
    await page.mouse.click(640, 360);
    await sleep(1000);

    // Also try known play button selectors
    for (const sel of PLAY_SELECTORS) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          tick(`Clicked element: ${sel}`);
          break;
        }
      } catch (_) {}
    }

    tick('Waiting up to 25s for stream URL to appear…');

    // Poll until stream found or 25s elapsed
    const streamResult = await Promise.race([
      new Promise(resolve => {
        const interval = setInterval(() => {
          if (foundUrls.length > 0) { clearInterval(interval); resolve(foundUrls[0]); }
        }, 300);
      }),
      new Promise(resolve => setTimeout(() => resolve(null), 25000)),
    ]);

    // Last resort: check <video> src in DOM
    if (!streamResult) {
      tick('Polling timed out — checking DOM for <video> src…');
      try {
        const videoSrcs = await page.evaluate(() => {
          const srcs = [];
          document.querySelectorAll('video').forEach(v => {
            if (v.src && !v.src.startsWith('blob:')) srcs.push(v.src);
            v.querySelectorAll('source').forEach(s => {
              if (s.src && !s.src.startsWith('blob:')) srcs.push(s.src);
            });
          });
          return srcs;
        });
        if (videoSrcs.length > 0) {
          tick(`Found video src in DOM: ${videoSrcs[0]}`);
          foundUrls.push({ url: videoSrcs[0], type: classifyUrl(videoSrcs[0]), ms: Date.now() - startTime });
        }
      } catch (_) {}
    }

    await page.close();
    await browser.disconnect();
    browser = null;

    const elapsed = Date.now() - startTime;

    if (foundUrls.length === 0) {
      tick('No stream URL found');
      return res.status(404).json({
        success: false,
        error: 'No stream URL found',
        embedUrl,
        elapsed,
        log,
        // Return all network requests seen so we can diagnose
        networkSample: allResponses.slice(-40),
      });
    }

    tick('Done — returning best result');
    return res.status(200).json({
      success:  true,
      url:      foundUrls[0].url,
      type:     foundUrls[0].type,
      embedUrl,
      elapsed,
      allFound: foundUrls,
      log,
    });

  } catch (err) {
    if (browser) { try { await browser.disconnect(); } catch (_) {} }
    const elapsed = Date.now() - startTime;
    tick(`Error: ${err.message}`);
    return res.status(500).json({
      success: false,
      error:   err.message,
      embedUrl,
      elapsed,
      log,
    });
  }
};
