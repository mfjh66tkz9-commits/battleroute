// État partagé : l'onglet Host est l'autorité, diffuse via BroadcastChannel + localStorage.
const KEY = 'battleroute:state', CH = 'battleroute';
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CH) : null;
export const initialState = () => ({
  phase: 'idle', // idle | question | reveal | paused
  q: null, qIndex: 0, endsAt: 0, remainingOnPause: 0, timer: 12, theme: 'random',
  answers: {}, // name -> {key, t}
  scores: {}, // name -> points
  lastGains: {}, used: [], round: 0,
});
export function load() { try { return { ...initialState(), ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return initialState(); } }
export function publish(s) { localStorage.setItem(KEY, JSON.stringify(s)); bc && bc.postMessage(s); }
export function subscribe(fn) {
  const onMsg = (e) => fn(e.data);
  const onStore = (e) => { if (e.key === KEY && e.newValue) fn(JSON.parse(e.newValue)); };
  bc && bc.addEventListener('message', onMsg); window.addEventListener('storage', onStore);
  return () => { bc && bc.removeEventListener('message', onMsg); window.removeEventListener('storage', onStore); };
}
// Barème : 1er correct 100, 2e 80, 3e 60, puis 40 ; bonus vitesse jusqu'à +20
export function pointsFor(rank, fracLeft) { const base = [100, 80, 60][rank] ?? 40; return base + Math.round(20 * Math.max(0, fracLeft)); }
