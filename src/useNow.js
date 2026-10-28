import { useEffect, useState } from 'react';
export default function useNow(ms = 100) { const [n, s] = useState(Date.now()); useEffect(() => { const i = setInterval(() => s(Date.now()), ms); return () => clearInterval(i); }, [ms]); return n; }
