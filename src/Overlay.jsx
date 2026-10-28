import React, { useEffect, useState } from 'react';
import { load, subscribe } from './store.js';
import useNow from './useNow.js';
import { SERVER, roomFromUrl, useRemote } from './net.js';
const KEYS = ['A','B','C','D'];
export default function Overlay({ external }) {
  const [own, setOwn] = useState(load);
  const remote = !external && !!SERVER; const room = roomFromUrl();
  useEffect(() => (external || remote) ? undefined : subscribe(setOwn), [external, remote]);
  const [rs] = useRemote(room, 'overlay', remote);
  const s = external || (remote ? (rs || own) : own); const now = useNow(100);
  const counts = { A: 0, B: 0, C: 0, D: 0 }; Object.values(s.answers || {}).forEach(a => counts[a.key]++);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const msLeft = s.phase === 'question' ? Math.max(0, s.endsAt - now) : s.phase === 'paused' ? s.remainingOnPause : 0;
  const frac = s.timer ? msLeft / (s.timer * 1000) : 0;
  const top = Object.entries(s.scores || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const reveal = s.phase === 'reveal';
  const recent = Object.entries(s.answers || {}).sort((a, b) => b[1].t - a[1].t).slice(0, 4);
  return (<div className="overlay">
    <div className="road" />
    <div className="brand"><div className="logo big">BATTLE<span>ROUTE</span></div><div className="tag">Le quiz code de la route en live</div></div>
    {s.phase === 'idle' || !s.q ? (
      <div className="card idle"><div className="huge">🚦</div><h2>Prépare-toi !</h2><p>Réponds dans le chat avec <b>A</b>, <b>B</b>, <b>C</b> ou <b>D</b></p></div>
    ) : (<>
      <div className="meta"><span className="theme">{s.q.theme.replace(/_/g, ' ')}</span><span>Question #{s.qIndex}</span></div>
      <div className={'timer' + (frac < .3 && !reveal ? ' hot' : '')}>
        <div className="bar" style={{ width: (reveal ? 0 : frac * 100) + '%' }} />
        <span>{reveal ? 'TERMINÉ' : s.phase === 'paused' ? '⏸ PAUSE' : Math.ceil(msLeft / 1000) + 's'}</span></div>
      <div className={'card q' + (s.q.image ? ' withimg' : '')}>
        {s.q.image && <img className="qimg" src={s.q.image} alt="" />}<span>{s.q.question}</span></div>
      <div className="choices">{s.q.choices.map(c => {
        const pct = total ? Math.round(counts[c.key] * 100 / total) : 0;
        const st = reveal ? (c.key === s.q.answer ? ' good' : ' bad') : '';
        return (<div key={c.key} className={'choice k' + c.key + st}>
          <div className="fill" style={{ width: pct + '%' }} />
          <span className="key">{c.key}</span><span className="txt">{c.text}</span><span className="pct">{counts[c.key]} · {pct}%</span></div>); })}</div>
      {reveal && <div className="card expl">✅ <b>Réponse {s.q.answer}</b> — {s.q.explanation}</div>}
      {!reveal && <div className="feed">{recent.map(([n, a]) => <div key={n}>💬 <b>{n}</b> a répondu</div>)}</div>}
    </>)}
    <div className="card board"><h3>🏆 Top pilotes</h3>
      {(top.length ? top : [['—', 0], ['—', 0], ['—', 0]]).map(([n, p], i) => (
        <div key={i} className="lb"><span className="rk">{['🥇','🥈','🥉','4','5'][i]}</span><span className="nm">{n}</span>
          {reveal && s.lastGains?.[n] ? <span className="gain">+{s.lastGains[n]}</span> : null}<span className="pt">{p}</span></div>))}</div>
    <div className="foot">Tape <b>A B C D</b> dans le chat · 1er bon = 100 pts</div>
  </div>);
}
