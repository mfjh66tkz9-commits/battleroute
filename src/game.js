// Logique de jeu partagée (mode local sans serveur). Le serveur a la même logique dans server/index.js.
import { initialState, pointsFor } from './store.js';
function pick(st, bank) {
  const pool = bank.questions.filter(q => st.theme === 'random' || q.theme === st.theme);
  let fresh = pool.filter(q => !st.used.includes(q.id)); let used = st.used;
  if (!fresh.length) { fresh = pool; used = used.filter(id => !pool.some(q => q.id === id)); }
  const q = fresh[Math.floor(Math.random() * fresh.length)];
  return { q, used: [...used, q.id] };
}
export function reduce(s, m, bank) {
  switch (m.type) {
    case 'startRound': case 'next': { if (!bank.questions.length) return s; const { q, used } = pick(s, bank);
      return { ...s, phase: 'question', q, used, answers: {}, lastGains: {}, qIndex: s.qIndex + 1, endsAt: Date.now() + s.timer * 1000 }; }
    case 'pause': return s.phase === 'question' ? { ...s, phase: 'paused', remainingOnPause: Math.max(0, s.endsAt - Date.now()) }
      : s.phase === 'paused' ? { ...s, phase: 'question', endsAt: Date.now() + s.remainingOnPause } : s;
    case 'reveal': { if (!s.q || !['question', 'paused'].includes(s.phase)) return s;
      const correct = Object.entries(s.answers).filter(([, a]) => a.key === s.q.answer).sort((a, b) => a[1].t - b[1].t);
      const scores = { ...s.scores }, lastGains = {}, total = s.timer * 1000;
      correct.forEach(([n, a], i) => { const p = pointsFor(i, (s.endsAt - a.t) / total); scores[n] = (scores[n] || 0) + p; lastGains[n] = p; });
      return { ...s, phase: 'reveal', scores, lastGains }; }
    case 'setTheme': return { ...s, theme: m.theme };
    case 'setTimer': return { ...s, timer: Math.min(60, Math.max(5, +m.timer || 12)) };
    case 'resetScores': return { ...s, scores: {}, lastGains: {} };
    case 'reset': return { ...initialState(), timer: s.timer, theme: s.theme };
    case 'simulateAnswer': return (s.phase !== 'question' || s.answers[m.name]) ? s : { ...s, answers: { ...s.answers, [m.name]: { key: m.key, t: Date.now() } } };
    default: return s;
  }
}
