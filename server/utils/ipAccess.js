const net = require('net');
const pool = require('../db/pool');
const logger = require('../logger');

// IP allowlist for the whole portal (pages *and* API). Off by default; an Admin turns it on. When on, a
// request from an address that is not on the list gets a 403 before it reaches anything else -- the login
// page included, so the portal simply "does not open" from an unlisted network.
//
// The client address is req.ip. The app sits directly behind Traefik with `trust proxy` set to 1, so that is
// the address Traefik saw connect -- a client-supplied X-Forwarded-For cannot override it.

const SETTING_KEY = 'ip_restriction_enabled';
const TTL_MS = 5000; // settings/list are re-read at most this often; changes made here invalidate it at once
const MAX_ENTRIES = 500;

let cache = null; // { at, enabled, entries, blockList }

// "::ffff:203.0.113.5" is just IPv4 in IPv6 clothing -- compare it as IPv4.
function normalizeIp(ip) {
  if (!ip) return null;
  let value = String(ip).trim();
  const mapped = value.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) value = mapped[1];
  return net.isIP(value) ? value.toLowerCase() : null;
}

// Parses "203.0.113.5", "203.0.113.0/24" or an IPv6 equivalent. Returns { canonical, address, prefix, family } or { error }.
function parseEntry(input) {
  if (typeof input !== 'string') return { error: 'Enter an IP address or range.' };
  const [rawAddress, rawPrefix, ...extra] = input.trim().split('/');
  if (extra.length > 0) return { error: 'That is not a valid IP address or range.' };

  const address = normalizeIp(rawAddress);
  if (!address) return { error: 'That is not a valid IPv4 or IPv6 address.' };
  const family = net.isIPv4(address) ? 'ipv4' : 'ipv6';

  if (rawPrefix === undefined) return { canonical: address, address, prefix: undefined, family };

  if (!/^\d{1,3}$/.test(rawPrefix)) return { error: 'The range size after "/" must be a number.' };
  const prefix = Number(rawPrefix);
  const max = family === 'ipv4' ? 32 : 128;
  if (prefix > max) return { error: `The range size for ${family === 'ipv4' ? 'IPv4' : 'IPv6'} can be at most /${max}.` };
  if (prefix === 0) return { error: 'A range that covers every address (/0) would defeat the allowlist.' };
  return { canonical: `${address}/${prefix}`, address, prefix, family };
}

function buildBlockList(entries) {
  const list = new net.BlockList();
  for (const { cidr } of entries) {
    const parsed = parseEntry(cidr);
    if (parsed.error) continue; // a corrupt row must never break the gate for everyone else
    if (parsed.prefix === undefined) list.addAddress(parsed.address, parsed.family);
    else list.addSubnet(parsed.address, parsed.prefix, parsed.family);
  }
  return list;
}

async function loadState() {
  const { rows: settings } = await pool.query('SELECT value FROM app_settings WHERE key = $1', [SETTING_KEY]);
  const { rows: entries } = await pool.query('SELECT id, cidr, label, created_by, created_at FROM ip_allowlist ORDER BY created_at ASC');
  cache = { at: Date.now(), enabled: settings[0]?.value === 'true', entries, blockList: buildBlockList(entries) };
  return cache;
}

async function getState() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache;
  return loadState();
}

// Call after any change to the list or the switch so it takes effect on the very next request.
function invalidate() {
  cache = null;
}

function isAllowedBy(state, ip) {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  return state.blockList.check(normalized, net.isIPv4(normalized) ? 'ipv4' : 'ipv6');
}

// Emergency escape hatch: if an Admin locks themselves out (say, their own address changed), setting this
// environment variable on the server and restarting turns enforcement off without needing to sign in.
const overrideActive = () => process.env.IP_RESTRICTION_DISABLED === 'true';

function blockedPage(ip) {
  const shown = String(ip || 'unknown').replace(/[^0-9a-fA-F:.]/g, '');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Access restricted</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0c0b14; color: #e8e6f3; font-family: system-ui, sans-serif; }
  main { max-width: 460px; padding: 2rem; text-align: center; }
  h1 { font-size: 1.4rem; margin: 0 0 0.75rem; }
  p { line-height: 1.55; color: #b9b5cf; margin: 0.5rem 0; }
  code { background: #1b1930; padding: 0.15rem 0.5rem; border-radius: 6px; color: #fff; }
</style></head>
<body><main>
  <h1>Access restricted</h1>
  <p>The Blylinks portal can only be opened from approved networks, and this network is not on the list.</p>
  <p>Your address is <code>${shown}</code>. Send it to your administrator and ask them to allow it.</p>
</main></body></html>`;
}

// Mounted early in the app, before the API and the static site, and after the health check (which the
// platform's own probe must always be able to reach).
function ipAccessGate(req, res, next) {
  if (overrideActive()) return next();
  getState().then((state) => {
    if (!state.enabled || isAllowedBy(state, req.ip)) return next();

    logger.info({ ip: req.ip, method: req.method, path: req.path }, 'request blocked by IP allowlist');
    res.set('Cache-Control', 'no-store');
    if (req.path.startsWith('/api')) {
      return res.status(403).json({ error: 'Access from your network is not permitted. Ask your administrator to allow your IP address.', ip: normalizeIp(req.ip) });
    }
    return res.status(403).type('html').send(blockedPage(normalizeIp(req.ip)));
  }).catch(next);
}

module.exports = {
  ipAccessGate, getState, invalidate, isAllowedBy, normalizeIp, parseEntry, buildBlockList, overrideActive,
  SETTING_KEY, MAX_ENTRIES
};
