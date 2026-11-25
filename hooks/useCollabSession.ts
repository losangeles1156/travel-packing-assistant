import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { CLOUD_FEATURES_ENABLED } from '../services/featureFlags';
import { ListSnapshot } from '../services/listStorageService';

type CollabSession = {
    id: string;
    snapshot: ListSnapshot;
    version: number;
    last_active: string;
};

export const useCollabSession = (
    currentSnapshot: ListSnapshot | null,
    onRemoteUpdate: (snapshot: ListSnapshot) => void
) => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const ignoreNextLocalUpdate = useRef(false);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    const onRemoteUpdateRef = useRef(onRemoteUpdate);
    useEffect(() => {
        onRemoteUpdateRef.current = onRemoteUpdate;
    }, [onRemoteUpdate]);

    // Initialize from URL
    useEffect(() => {
        if (!CLOUD_FEATURES_ENABLED || typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        const collabId = params.get('collab');
        if (collabId) {
            setSessionId(collabId);
        }
    }, []);

    // Fetch initial data & Subscribe
    useEffect(() => {
        if (!sessionId || !supabase) return;

        const client = supabase;

        // Fetch latest
        const fetchInitial = async () => {
            const { data, error } = await client
                .from('collab_sessions')
                .select('*')
                .eq('id', sessionId)
                .single();

            if (data && !error) {
                ignoreNextLocalUpdate.current = true;
                onRemoteUpdateRef.current(data.snapshot);
            }
        };

        fetchInitial();

        const channel = client
            .channel(`collab:${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'collab_sessions',
                    filter: `id=eq.${sessionId}`,
                },
                (payload) => {
                    const newData = payload.new as CollabSession;
                    ignoreNextLocalUpdate.current = true;
                    onRemoteUpdateRef.current(newData.snapshot);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Presence could be added here
                }
            });

        return () => {
            client.removeChannel(channel);
        };
    }, [sessionId]);

    // Sync upstream (Local -> DB)
    useEffect(() => {
        if (!sessionId || !currentSnapshot || !supabase) return;

        if (ignoreNextLocalUpdate.current) {
            ignoreNextLocalUpdate.current = false;
            return;
        }

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        const client = supabase;
        setIsSyncing(true);
        debounceTimer.current = setTimeout(async () => {
            try {
                await client
                    .from('collab_sessions')
                    .update({
                        snapshot: currentSnapshot,
                        last_active: new Date().toISOString(),
                    })
                    .eq('id', sessionId);
            } catch (err) {
                console.error('Failed to sync collab session', err);
            } finally {
                setIsSyncing(false);
            }
        }, 500);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [sessionId, currentSnapshot]);

    const startCollab = useCallback(async () => {
        if (!CLOUD_FEATURES_ENABLED || !currentSnapshot || !supabase) return null;
        try {
            const { data, error } = await supabase
                .from('collab_sessions')
                .insert({
                    snapshot: currentSnapshot,
                })
                .select()
                .single();

            if (data && !error) {
                setSessionId(data.id);
                // Update URL without reload
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('collab', data.id);
                window.history.pushState({}, '', newUrl.toString());
                return data.id;
            }
        } catch (e) {
            console.error(e);
        }
        return null;
    }, [currentSnapshot]);

    const exitCollab = useCallback(() => {
        setSessionId(null);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('collab');
        window.history.pushState({}, '', newUrl.toString());
    }, []);

    return {
        sessionId,
        isSyncing,
        startCollab,
        exitCollab,
    };
};
