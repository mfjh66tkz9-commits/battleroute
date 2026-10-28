import React, { useEffect, useRef, useState } from 'react';
import { load, publish, initialState } from './store.js';
import { reduce } from './game.js';
import { SERVER, hostRoom, useRemote } from './net.js';
import useNow from './useNow.js';
import Overlay from './Overlay.jsx';
const KEYS = ['A','B','C','D'];
const FAKE = ['Lea_75','MaxDrift','Sofiane93','Julie.R','PermisB_Go','Nina','Kevin_Route','Yanis','Camille','TurboMamie','Ines','Lucas_V8'];
const ST_LABEL = { live: '🟢 LIVE connecté', offline: '⚪ Hors ligne', connecting: '🟡 Connexion…', error: '🔴 Erreur' };

export default function Host() {
  const remote = !!SERVER;
  const [room] = useState(hostRoom);
  const [bank, setBank] = useState({ themes: [], questions: [] });
  const [local, setLocal] = useState(load);
  const [rs, send, conn] = useRemote(room, 'host', remote);
  const s = remote ? (rs || { ...initialState(), tiktok: { user: '', status: 'offline', error: '' } }) : local;
  const ref = useRef(s); ref.current = s;
  const now = useNow(200);
  const [name, setName] = useState('Viewer1');
  const [auto, setAuto] = useState(false);
  const [ttUser, setTtUser] = useState(() => localStorage.getItem('br:tiktok') || '');
  useEffect(() => { fetch('/questions.json').then(r => r.json()).then(setBank); }, []);
  useEffect(() => { if (!remote) publish(local); }, []);
  // envoie la commande au serveur, ou applique localement
  const dispatch = (m) => { if (remote) return send(m);
    const n = reduce(ref.current, m, bank); ref.current = n; setLocal(n); publish(n); };
  const answer = (n, key) => dispatch({ type: 'simulateAnswer', name: n, key });

  // mode local : fin du chrono -> révélation auto (le serveur le gère lui-même)
  useEffect(() => { if (!remote && s.phase === 'question' && now >= s.endsAt) dispatch({ type: 'reveal' }); }, [now]);
  useEffect(() => { if (remote && conn === 'online' && rs && !rs.tiktok?.user && ttUser) send({ type: 'setTikTokUser', user: ttUser }); }, [conn, !!rs]);
  useEffect(() => { if (!auto || s.phase !== 'question') return;
    const i = setInterval(() => { const st = ref.current; if (st.phase !== 'question') return;
      const n = FAKE[Math.floor(Math.random() * FAKE.length)] + (Math.random() < .3 ? Math.floor(Math.random()*99) : '');
      const k = Math.random() < .55 ? st.q.answer : KEYS[Math.floor(Math.random() * 4)]; answer(n, k); }, 450);
    return () => clearInterval(i); }, [auto, s.phase]);

  const tt = s.tiktok || { status: 'offline' };
  const connectTT = () => { const u = ttUser.replace(/^@/, '').trim(); localStorage.setItem('br:tiktok', u); send({ type: 'connectTikTok', user: u }); };
  const left = s.phase === 'question' ? Math.max(0, Math.ceil((s.endsAt - now) / 1000)) : s.phase === 'paused' ? Math.ceil(s.remainingOnPause / 1000) : 0;
  const overlayPath = '/?view=overlay' + (remote ? '&room=' + room : '');
  const overlayUrl = location.origin + overlayPath;
  return (<div className="host">
    <header><h1 className="logo">BATTLE<span>ROUTE</span></h1>
      {remote ? <span className="pill">Salle <b>{room}</b> · serveur {conn === 'online' ? '🟢' : conn === 'connecting' ? '🟡' : '🔴 déconnecté'}</span>
        : <span className="pill">Mode TEST local — pas de serveur (VITE_SERVER_URL vide)</span>}</header>
    <div className="cols">
      <div className="panel">
        <h2>TikTok Live</h2>
        {remote ? <div className="tt">
          <div className="row"><input value={ttUser} onChange={e => setTtUser(e.target.value)} placeholder="@ton_pseudo_tiktok" />
            <button className="go" onClick={connectTT} disabled={!ttUser.trim() || conn !== 'online'}>Connecter</button>
            <button onClick={() => send({ type: 'disconnectTikTok' })} disabled={tt.status === 'offline'}>Déconnecter</button></div>
          <p className="row"><span className={'st ' + tt.status}>{ST_LABEL[tt.status] || tt.status}</span>
            {tt.user && <span className="small">@{tt.user}</span>}{tt.status === 'live' && <span className="small">👀 {tt.viewers || 0} spectateurs</span>}</p>
          {tt.error && <p className="small" style={{ color: '#fca5a5' }}>{tt.error}</p>}
          <p className="small">Lance ton live TikTok d’abord, puis Connecter. Les viewers répondent A, B, C ou D dans le chat (1 réponse par question).</p>
        </div> : <p className="small">Connexion TikTok indisponible : définis <code>VITE_SERVER_URL</code> vers le serveur Battleroute.</p>}
        <h2>Partie</h2>
        <div className="row">
          <button className="go" onClick={() => dispatch({ type: s.phase === 'idle' ? 'startRound' : 'next' })}>{s.phase === 'idle' ? '▶ Démarrer la manche' : '⏭ Question suivante'}</button>
          <button onClick={() => dispatch({ type: 'pause' })} disabled={!['question','paused'].includes(s.phase)}>{s.phase === 'paused' ? '▶ Reprendre' : '⏸ Pause'}</button>
          <button onClick={() => dispatch({ type: 'reveal' })} disabled={s.phase !== 'question'}>👁 Révéler</button>
        </div>
        <p>Phase : <b>{s.phase}</b> · Question #{s.qIndex} · Chrono : <b>{left}s</b> · Réponses : {Object.keys(s.answers || {}).length}</p>
        {s.q && <p className="small">{s.q.question} → <b>{s.q.answer}</b></p>}
        <label>Thème <select value={s.theme} onChange={e => dispatch({ type: 'setTheme', theme: e.target.value })}>
          <option value="random">🎲 Aléatoire</option>{bank.themes.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></label>
        <label>Chrono (s) <input type="number" min="5" max="60" value={s.timer} onChange={e => dispatch({ type: 'setTimer', timer: e.target.value })} /></label>
        <div className="row"><button className="danger" onClick={() => confirm('Remettre les scores à zéro ?') && dispatch({ type: 'resetScores' })}>♻ Reset scores</button>
          <button className="danger" onClick={() => dispatch({ type: 'reset' })}>⟲ Reset complet</button></div>
        <h2>Simuler le chat (test)</h2>
        <div className="row"><input value={name} onChange={e => setName(e.target.value)} placeholder="pseudo" />
          {KEYS.map(k => <button key={k} className={'k' + k} onClick={() => answer(name.trim() || 'anon', k)}>{k}</button>)}</div>
        <label className="row"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} /> Bots de test (réponses automatiques)</label>
        <h2>OBS</h2>
        <p className="small">Source navigateur : <code>{overlayUrl}</code> — 1080×1920</p>
        <div className="row"><a href={overlayPath} target="_blank" rel="noreferrer"><button>Ouvrir l’overlay ↗</button></a>
          <button onClick={() => navigator.clipboard?.writeText(overlayUrl)}>📋 Copier l’URL</button></div>
        {remote && <p className="small">Garde ce dashboard ouvert ; pour changer de salle : <code>?view=host&room=CODE</code></p>}
      </div>
      <div className="preview"><div className="scaler"><Overlay external={s} /></div></div>
    </div>
  </div>);
}
