import { useState, useEffect, useMemo, useRef } from 'react';
import { ref, query, orderByChild, equalTo, get } from 'firebase/database';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useTrucks } from './useTrucks';
import { kmBetween } from '../../../lib/geo';

function readCachedPosition() {
    try {
        const raw = localStorage.getItem('planizza.position');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') return parsed;
    } catch {
        // noop
    }
    return null;
}

export function useRecommendedTrucks() {
    const { user } = useAuth();
    const { trucks: allTrucks, loading: allTrucksLoading } = useTrucks();
    const [recommended, setRecommended] = useState([]);
    const [loading, setLoading] = useState(true);

    // IMPORTANT: Certains hooks peuvent renvoyer un nouvel array à chaque render.
    // Sans garde, l'effet ci-dessous peut se relancer en boucle et provoquer
    // "Maximum update depth exceeded".
    const trucksKey = useMemo(() => {
        if (!Array.isArray(allTrucks) || !allTrucks.length) return 'none';
        // Clé stable et indépendante de l'ordre
        const ids = allTrucks.map((t) => String(t?.id ?? '')).filter(Boolean).sort();
        return ids.join('|');
    }, [allTrucks]);
    const lastRunKeyRef = useRef('');

    useEffect(() => {
        if (allTrucksLoading || !allTrucks.length) return;

        const runKey = `${user?.uid || 'anon'}::${trucksKey}`;
        if (runKey === lastRunKeyRef.current) return;
        lastRunKeyRef.current = runKey;

        async function getRecommendations() {
            let recs = [];
            const seenIds = new Set();

            // 1. Priorité aux 3 derniers camions commandés
            if (user) {
                try {
                    const ordersRef = query(ref(db, 'orders'), orderByChild('uid'), equalTo(user.uid));
                    const ordersSnap = await get(ordersRef);

                    if (ordersSnap.exists()) {
                        const orders = Object.values(ordersSnap.val()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                        for (const order of orders) {
                            if (recs.length >= 3) break;
                            if (order.truckId && !seenIds.has(order.truckId)) {
                                const truck = allTrucks.find(t => t.id === order.truckId);
                                if (truck) {
                                    recs.push({ ...truck, recType: 'history' });
                                    seenIds.add(order.truckId);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching order history for recommendations:', e);
                }
            }

            // 2. Si moins de 3, ajouter par distance (si position dispo)
            if (recs.length < 3) {
                // Important : ne pas déclencher la géoloc automatiquement (Safari peut refuser sans prompt).
                // On utilise uniquement une position déjà connue (cache localStorage).
                const pos = readCachedPosition();
                if (pos) {
                    const sortedByDist = [...allTrucks]
                        .map(t => ({ ...t, dist: kmBetween(pos, t.location) }))
                        .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

                    for (const truck of sortedByDist) {
                        if (recs.length >= 3) break;
                        if (!seenIds.has(truck.id)) {
                            recs.push({ ...truck, recType: 'distance' });
                            seenIds.add(truck.id);
                        }
                    }
                }
            }

            // 3. Si toujours moins de 3, ajouter par note
            if (recs.length < 3) {
                const sortedByRating = [...allTrucks].sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0));
                for (const truck of sortedByRating) {
                    if (recs.length >= 3) break;
                    if (!seenIds.has(truck.id)) {
                        recs.push({ ...truck, recType: 'rating' });
                        seenIds.add(truck.id);
                    }
                }
            }

            setRecommended(recs);
            setLoading(false);
        }

        getRecommendations();
    }, [user?.uid, trucksKey, allTrucksLoading, allTrucks]);

    return { recommended, loading };
}