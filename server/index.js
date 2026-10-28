// Battleroute game server : rooms en mémoire + WebSocket + TikTok Live (connecteur non officiel)
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { WebcastPushConnection } from 'tiktok-live-connector';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://battleroute.vercel.app').split(',').map(s => s.trim()).filter(Boolean);
const okOrigin = (o) => !o || ORIGINS.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || /^https:\/\/battleroute(-[a-z0-9-]+)?\.vercel\.app$/.test(o);

// Banque de questions (copie locale, ou ../public/questions.json)
const bankPath = [path.join(__dirname, 'questions.json'), path.join(__dirname, '../public/questions.json')].find(p => fs.existsSync(p));
const BANK = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
console.log(`[bank] ${BANK.questions.length} questions (${bankPath})`);

const initialState = () => ({
  phase: 'idle', q: null, qIndex: 0, endsAt: 0, remainingOnPause: 0, timer: 12, theme: 'random',
  answers: {}, scores: {}, lastGains: {}, used: [], round: 0,
  tiktok: { user: '', status: 'offline', error: '', viewers: 0 },
});
const pointsFor = (rank, fracLeft) => ([100, 80, 60][rank] ?? 40) + Math.round(20 * Math.max(0, fracLeft));

const rooms = new Map(); // id -> {state, clients:Set, tt, timer}
function getRoom(id) {
  if (!rooms.has(id)) rooms.set(id, { id, state: initialState(), clients: new Set(), tt: null, tick: null, lastSeen: Date.now() });
  return rooms.get(id);
}
function broadcast(room) {
  const msg = JSON.stringify({ type: 'state', state: room.state, serverNow: Date.now() });
  room.clients.forEach(c => c.readyState === 1 && c.send(msg));
}
function set(room, fn) { room.state = fn(room.state); broadcast(room); }
function setTT(room, patch) { set(room, s => ({ ...s, tiktok: { ...s.tiktok, ...patch } })); }

function pick(st) {
  const pool = BANK.questions.filter(q => st.theme === 'random' || q.theme === st.theme);
  let fresh = pool.filter(q => !st.used.includes(q.id)); let used = st.used;
  if (!fresh.length) { fresh = pool; used = used.filter(id => !pool.some(q => q.id === id)); }
  const q = fresh[Math.floor(Math.random() * fresh.length)];
  return { q, used: [...used, q.id] };
}
function schedule(room) {
  clearTimeout(room.tick);
  const s = room.state;
  if (s.phase === 'question') room.tick = setTimeout(() => cmd(room, { type: 'reveal' }), Math.max(0, s.endsAt - Date.now()) + 50);
}
function answer(room, name, key) {
  set(room, st => (st.phase !== 'question' || !name || st.answers[name] || Date.now() > st.endsAt) ? st
    : { ...st, answers: { ...st.answers, [name]: { key, t: Date.now() } } });
}
// "A", "b", " c ", "D!!", "réponse A", "A je pense" -> lettre ; ignore les phrases sans réponse isolée
export function parseAnswer(text) {
  const t = String(text || '').trim().toUpperCase();
  let m = t.match(/^([ABCD])(?![A-Z0-9À-Ü])/);
  if (m) return m[1];
  m = t.match(/(?:^|[^A-Z0-9À-Ü])([ABCD])(?![A-Z0-9À-Ü])/);
  return m && t.length <= 20 ? m[1] : null;
}

async function connectTikTok(room) {
  const user = room.state.tiktok.user.replace(/^@/, '').trim();
  if (!user) return setTT(room, { status: 'error', error: 'Pseudo TikTok vide' });
  disconnectTikTok(room, true);
  setTT(room, { status: 'connecting', error: '' });
  const opts = { processInitialData: false, enableExtendedGiftInfo: false };
  if (process.env.TIKTOK_SESSION_ID) opts.sessionId = process.env.TIKTOK_SESSION_ID;
  const tt = new WebcastPushConnection(user, opts);
  room.tt = tt;
  tt.on('chat', d => { const k = parseAnswer(d.comment); if (k) answer(room, d.nickname || d.uniqueId, k); });
  tt.on('gift', d => console.log(`[gift][${room.id}] ${d.uniqueId} -> ${d.giftName} x${d.repeatCount}`));
  tt.on('roomUser', d => room.tt === tt && setTT(room, { viewers: d.viewerCount || 0 }));
  tt.on('streamEnd', () => room.tt === tt && setTT(room, { status: 'offline', error: 'Live terminé' }));
  tt.on('disconnected', () => room.tt === tt && setTT(room, { status: 'offline' }));
  tt.on('error', e => console.warn(`[tiktok][${room.id}]`, e?.info || e?.message || e));
  try {
    const st = await tt.connect();
    if (room.tt !== tt) return;
    console.log(`[tiktok][${room.id}] connecté à @${user} roomId=${st.roomId}`);
    setTT(room, { status: 'live', error: '' });
  } catch (e) {
    if (room.tt !== tt) return;
    room.tt = null;
    const msg = String(e?.message || e);
    setTT(room, { status: 'error', error: /offline|LIVE_NOT_FOUND|isn't online/i.test(msg) ? `@${user} n'est pas en live` : msg.slice(0, 200) });
  }
}
function disconnectTikTok(room, silent) {
  if (room.tt) { try { room.tt.disconnect(); } catch {} room.tt = null; }
  if (!silent) setTT(room, { status: 'offline', error: '' });
}

function cmd(room, m) {
  const st = room.state;
  switch (m.type) {
    case 'setTikTokUser': return setTT(room, { user: String(m.user || '').replace(/^@/, '').trim().slice(0, 40) });
    case 'connectTikTok': if (m.user) setTT(room, { user: String(m.user).replace(/^@/, '').trim() }); return connectTikTok(room);
    case 'disconnectTikTok': return disconnectTikTok(room);
    case 'startRound': case 'next': {
      if (!BANK.questions.length) return;
      const { q, used } = pick(st);
      set(room, s => ({ ...s, phase: 'question', q, used, answers: {}, lastGains: {}, qIndex: s.qIndex + 1, endsAt: Date.now() + s.timer * 1000 }));
      return schedule(room);
    }
    case 'pause':
      if (st.phase === 'question') { clearTimeout(room.tick); return set(room, s => ({ ...s, phase: 'paused', remainingOnPause: Math.max(0, s.endsAt - Date.now()) })); }
      if (st.phase === 'paused') { set(room, s => ({ ...s, phase: 'question', endsAt: Date.now() + s.remainingOnPause })); return schedule(room); }
      return;
    case 'reveal': {
      clearTimeout(room.tick);
      if (!st.q || !['question', 'paused'].includes(st.phase)) return;
      return set(room, s => {
        const correct = Object.entries(s.answers).filter(([, a]) => a.key === s.q.answer).sort((a, b) => a[1].t - b[1].t);
        const scores = { ...s.scores }, lastGains = {}, total = s.timer * 1000;
        correct.forEach(([n, a], i) => { const p = pointsFor(i, (s.endsAt - a.t) / total); scores[n] = (scores[n] || 0) + p; lastGains[n] = p; });
        return { ...s, phase: 'reveal', scores, lastGains };
      });
    }
    case 'setTheme': return set(room, s => ({ ...s, theme: String(m.theme || 'random') }));
    case 'setTimer': return set(room, s => ({ ...s, timer: Math.min(60, Math.max(5, +m.timer || 12)) }));
    case 'resetScores': return set(room, s => ({ ...s, scores: {}, lastGains: {} }));
    case 'reset': clearTimeout(room.tick); return set(room, s => ({ ...initialState(), timer: s.timer, theme: s.theme, tiktok: s.tiktok }));
    case 'simulateAnswer': { const k = String(m.key || '').toUpperCase(); if ('ABCD'.includes(k) && k) answer(room, String(m.name || 'anon').slice(0, 40), k); return; }
  }
}

const app = express();
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && okOrigin(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); res.set('Access-Control-Allow-Headers', 'Content-Type'); }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size, uptime: process.uptime() }));
app.get('/', (req, res) => res.type('text').send('Battleroute server OK'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws', verifyClient: ({ origin }) => okOrigin(origin) });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const id = (url.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const role = url.searchParams.get('role') === 'host' ? 'host' : 'overlay';
  if (!id) return ws.close(4000, 'room requis');
  const room = getRoom(id); room.clients.add(ws); room.lastSeen = Date.now();
  ws.send(JSON.stringify({ type: 'state', state: room.state, serverNow: Date.now() }));
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    if (role !== 'host') return; // l'overlay est en lecture seule
    let m; try { m = JSON.parse(raw); } catch { return; }
    try { cmd(room, m); } catch (e) { console.error('cmd error', e); }
  });
  ws.on('close', () => { room.clients.delete(ws); room.lastSeen = Date.now(); });
});
// keepalive + GC des rooms vides depuis 2 h
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
  for (const [id, r] of rooms) if (!r.clients.size && Date.now() - r.lastSeen > 2 * 3600e3) { disconnectTikTok(r, true); clearTimeout(r.tick); rooms.delete(id); }
}, 30000);

server.listen(PORT, '0.0.0.0', () => console.log(`Battleroute server on :${PORT}`));
