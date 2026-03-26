/**
 * mc-status-proxy.js
 * 
 * A tiny Node.js HTTP server that queries the minecraft server on the same machine
 * using the Server List Ping (SLP) protocol and exposes the result
 * as JSON, so your website can fetch it without CORS issues.
 *
 * SETUP:
 *   1. npm install minecraft-server-util
 *   2. node mc-status-proxy.js
 *   3. (Recommended) run via PM2: pm2 start mc-status-proxy.js --name mc-status
 *
 * FIREWALL:
 *   Open port 3000 (or whatever PORT you set) in your firewall / router.
 *   e.g. on Linux with ufw: sudo ufw allow 3000/tcp
 *
 * The website fetches: https://macks.duckdns.org:3000/status
 */

const http  = require("http");
const { status } = require("minecraft-server-util");

const MC_HOST = "localhost";   // or "127.0.0.1" — same machine
const MC_PORT = 25565;          // your Minecraft server port
const PROXY_PORT = 3000;        // port this proxy listens on
const CACHE_TTL_MS = 15_000;    // cache result for 15 seconds

let cache = null;
let cacheTime = 0;

async function getStatus() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) return cache;

  try {
    const result = await status(MC_HOST, MC_PORT, { timeout: 5000 });
    cache = {
      online: true,
      players: {
        online: result.players.online,
        max:    result.players.max,
        list:   (result.players.sample || []).map(p => p.name),
      },
      version:  result.version.name,
      motd:     result.motd.clean,
    };
  } catch {
    cache = { online: false, players: { online: 0, max: 0, list: [] } };
  }

  cacheTime = Date.now();
  return cache;
}

const server = http.createServer(async (req, res) => {
  // CORS — allow your domain (and localhost for testing)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/status") {
    const data = await getStatus();
    res.writeHead(200);
    res.end(JSON.stringify(data));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "not found" }));
  }
});

server.listen(PROXY_PORT, () => {
  console.log(`mc-status-proxy running on :${PROXY_PORT}`);
  console.log(`Pinging Minecraft at ${MC_HOST}:${MC_PORT}`);
});