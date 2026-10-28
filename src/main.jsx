import React from 'react'; import { createRoot } from 'react-dom/client';
import Host from './Host.jsx'; import Overlay from './Overlay.jsx'; import './style.css';
const p = new URLSearchParams(location.search); const v = p.get('view') || (location.pathname.includes('overlay') ? 'overlay' : 'host');
if (v === 'overlay') document.body.classList.add('ov');
createRoot(document.getElementById('root')).render(v === 'overlay' ? <Overlay /> : <Host />);
