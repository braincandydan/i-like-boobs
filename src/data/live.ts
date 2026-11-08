// ============================================================================
//  LIVE PAGE STREAMS — ADD YOUR LINKS HERE
// ============================================================================
//  Each entry shows up as a button on the /live page. Click it and the player
//  above the buttons switches to that stream.
//
//    name  – the label shown on the button
//    url   – the link to play
//    type  – 'iframe' for an embed page (opens inside an iframe)
//            'hls'    for a direct stream URL ending in .m3u8 (our own player)
//
//  Add entries to `liveStreams` (the "Live" section) and `replayStreams`
//  (the "Replays & Highlights" section). Remove the F1 examples if you don't
//  want them.
//
//  IFRAME LINKS: the site only lets iframes load from domains listed in
//  `frame-src` in src/layouts/Layout.astro (the Content-Security-Policy meta
//  tag). If you add an 'iframe' link from a new domain, add that domain there
//  too, or the browser will block it.
//
//  Example:
//    { name: 'My Channel', url: 'https://example.com/stream.m3u8', type: 'hls' },
//    { name: 'My Embed',   url: 'https://example.com/embed/123',   type: 'iframe' },
// ============================================================================

export type StreamType = 'iframe' | 'hls';

export interface LiveStream {
  name: string;
  url: string;
  type: StreamType;
}

const F1_CHANNEL_ID = 'UCB_qr75-ydFVKSF9Dmo6izg'; // official FORMULA 1 YouTube channel

// ---- LIVE: add your live stream links below ---------------------------------
export const liveStreams: LiveStream[] = [
  {
    name: 'Formula 1 (official YouTube live)',
    url: `https://www.youtube.com/embed/live_stream?channel=${F1_CHANNEL_ID}`,
    type: 'iframe',
  },
  // { name: 'Your live link', url: 'PASTE LINK HERE', type: 'iframe' },
];

// ---- REPLAYS & HIGHLIGHTS: add your replay/highlight links below ------------
export const replayStreams: LiveStream[] = [
  {
    name: 'Formula 1 (official YouTube uploads)',
    url: `https://www.youtube.com/embed/videoseries?list=UU${F1_CHANNEL_ID.slice(2)}`,
    type: 'iframe',
  },
  // { name: 'Your replay link', url: 'PASTE LINK HERE', type: 'iframe' },
];

// ---- LIVE DATA DASHBOARD: embedded on the /live page --------------------------
// Live timing, leaderboard, tyres and telemetry from the fan-made f1-dash
// project (https://github.com/slowlydev/f1-dash). Set to '' to hide the section.
// The domain must also be listed in `frame-src` in src/layouts/Layout.astro.
export const f1DashUrl = 'https://f1-dash.com';
