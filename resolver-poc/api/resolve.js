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
  if (type === 'tv') {
    return `https://${domain}/embed/tv/${id}/${season}/${episode}`;
  }
  return `https://${domain}/embed/movie/${id}`;
}

function classifyUrl(url) {
  if (url.includes('.m3u8'))  return 'hls';
  if (url.includes('.mpd'))   return 'dash';
  if (url.includes('.mp4'))   return 'mp4';
  return 'unknown';
}

function isStreamUrl(url) {
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return false;
  return (
    url.includes('.m3u8') ||
    url.includes('.mpd')  ||
    (url.includes('.mp4') && !url.includes('thumbnail') && !url.includes('poster') && !url.includes('logo'))
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) {
    return res.status(500).json({
      error: 'BROWSERLESS_TOKEN is not set. Sign up at browserless.io (free), get your API token, and add it as a Vercel environment variable.',
    });
  }

  const {
    id,
    type    = 'movie',
    season  = '1',
    episode = '1',
    domain  = DOMAINS[0],
  } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing required parameter: id' });
  }

  const embedUrl = buildEmbedUrl(domain, type, id, season, episode);
  const startTime = Date.now();
  const log = [];

  const tick = (msg) => {
    const entry = { ms: Date.now() - startTime, msg };
    log.push(entry);
    console.log(`[${entry.ms}ms] ${msg}`);
  };

  let browser = null;

  try {
    tick(`Connecting to Browserless for ${embedUrl}`);

    // Browserless hosts the browser — no local Chromium needed at all
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

    const foundUrls = [];

    // Monitor responses across all frames
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const ct  = response.headers()['content-type'] || '';
        if (
          isStreamUrl(url) ||
          ct.includes('mpegURL') ||
          ct.includes('x-mpegurl') ||
          ct.includes('dash+xml')
        ) {
          const streamType = classifyUrl(url);
          tick(`Found stream candidate (${streamType}): ${url.slice(0, 120)}`);
          foundUrls.push({ url, type: streamType, ms: Date.now() - startTime });
        }
      } catch (_) {}
    });

    // Also intercept requests before they complete
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      try {
        const url = request.url();
        if (isStreamUrl(url) && !foundUrls.some(f => f.url === url)) {
          const streamType = classifyUrl(url);
          tick(`Intercepted stream request (${streamType}): ${url.slice(0, 120)}`);
          foundUrls.push({ url, type: streamType, ms: Date.now() - startTime });
        }
        request.continue();
      } catch (_) {
        try { request.continue(); } catch (_2) {}
      }
    });

    tick('Navigating to embed page…');
    await page.goto(embedUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    tick('Page DOM loaded, waiting for stream…');

    // Poll until a stream URL appears or 20s elapses
    const streamResult = await Promise.race([
      new Promise(resolve => {
        const interval = setInterval(() => {
          if (foundUrls.length > 0) {
            clearInterval(interval);
            resolve(foundUrls[0]);
          }
        }, 300);
      }),
      new Promise(resolve => setTimeout(() => resolve(null), 20000)),
    ]);

    // Last resort: check <video> elements in the DOM
    if (!streamResult) {
      tick('No stream intercepted — checking DOM for <video> elements…');
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
        error:   'No stream URL found — the embed may be blocking headless browsers or needs more time',
        embedUrl,
        elapsed,
        log,
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
