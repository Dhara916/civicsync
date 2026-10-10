import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../lib/errors';
export function announceDataChange() { window.dispatchEvent(new Event('civicsync:data-changed')); }
export function useResource<T>(key: string, load: () => Promise<T>, options: {enabled?: boolean; pollMs?: number} = {}) {
  const [state, setState] = useState<{data: T | null; loading: boolean; error: string | null; fetchedAt: string | null}>({data: null, loading: options.enabled !== false, error: null, fetchedAt: null});
  const [revision, setRevision] = useState(0);
  const loader = useRef(load); loader.current = load;
  const reload = useCallback(() => setRevision(n => n + 1), []);
  const enabled = options.enabled !== false;
  useEffect(() => {
    let ignore = false;
    if (!enabled) { setState({data: null, loading: false, error: null, fetchedAt: null}); return; }
    setState({data: null, loading: true, error: null, fetchedAt: null});
    loader.current().then(data => {
      if (!ignore) setState({data, loading: false, error: null, fetchedAt: new Date().toISOString()});
    }).catch(error => { if (!ignore) setState({data: null, loading: false, error: errorMessage(error), fetchedAt: null}); });
    return () => { ignore = true; };
  }, [key, revision, enabled]);
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState === 'visible') reload(); };
    window.addEventListener('civicsync:data-changed', refresh);
    const interval = options.pollMs ? window.setInterval(refresh, options.pollMs) : undefined;
    return () => { window.removeEventListener('civicsync:data-changed', refresh); if (interval) window.clearInterval(interval); };
  }, [enabled, options.pollMs, reload]);
  return {...state, reload};
}
