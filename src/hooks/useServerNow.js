import { useEffect, useMemo, useState } from 'react';
import { getServerNowMs, getServerTimeOffsetMs, startServerTimeSync } from '../lib/serverTime';

/**
 * Hook qui fournit un `nowMs` basé sur l'heure serveur RTDB.
 * - démarre la synchro offset si possible
 * - tick régulier (par défaut 1s)
 */
export function useServerNow({ tickMs = 1000 } = {}) {
  const [nowMs, setNowMs] = useState(() => getServerNowMs());
  const [offsetMs, setOffsetMs] = useState(() => getServerTimeOffsetMs());

  useEffect(() => {
    startServerTimeSync();

    const id = setInterval(() => {
      setNowMs(getServerNowMs());
      setOffsetMs(getServerTimeOffsetMs());
    }, tickMs);

    return () => clearInterval(id);
  }, [tickMs]);

  const isSynced = useMemo(() => offsetMs !== 0, [offsetMs]);

  return { nowMs, offsetMs, isSynced };
}
