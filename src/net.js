// Connexion au serveur de jeu (si VITE_SERVER_URL est défini)
import { useEffect, useRef, useState } from 'react';
export const SERVER = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
export const wsUrl = (room, role) => SERVER.replace(/^http/, 'ws') + `/ws?room=${encodeURIComponent(room)}&role=${role}`;
export function roomFromUrl() { return (new URLSearchParams(location.search).get('room') || '').toUpperCase(); }
export function hostRoom() {
  const fromUrl = roomFromUrl(); if (fromUrl) { sessionStorage.setItem('br:room', fromUrl); return fromUrl; }
  let r = sessionStorage.getItem('br:room');
  if (!r) { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; r = Array.from({ length: 5 }, () => a[Math.floor(Math.random() * a.length)]).join(''); sessionStorage.setItem('br:room', r); }
  return r;
}
// Renvoie [state, send, connStatus]. Les horodatages serveur sont corrigés du décalage d'horloge.
export function useRemote(room, role, enabled) {
  const [state, setState] = useState(null); const [conn, setConn] = useState('connecting');
  const wsRef = useRef(null);
  useEffect(() => {
    if (!enabled || !room) return; let dead = false, retry;
    const open = () => {
      const ws = new WebSocket(wsUrl(room, role)); wsRef.current = ws; setConn('connecting');
      ws.onopen = () => setConn('online');
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type !== 'state') return;
        const off = Date.now() - m.serverNow, s = m.state;
        const answers = {}; Object.entries(s.answers || {}).forEach(([n, a]) => { answers[n] = { ...a, t: a.t + off }; });
        setState({ ...s, endsAt: s.endsAt + off, answers }); };
      ws.onclose = () => { if (dead) return; setConn('offline'); retry = setTimeout(open, 2000); };
    };
    open();
    return () => { dead = true; clearTimeout(retry); wsRef.current && wsRef.current.close(); };
  }, [room, role, enabled]);
  const send = (m) => { const ws = wsRef.current; if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  return [state, send, conn];
}
