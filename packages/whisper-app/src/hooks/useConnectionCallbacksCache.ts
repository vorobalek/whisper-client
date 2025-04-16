import { ChatWindowMessageType } from '../components/Messenger/Chat/ChatWindow';
import { UpdateType } from '../types/updateType';
import { ConnectionState } from '@whisper/core';
import { useLayoutEffect, useRef } from 'react';

export type ConnectionCallbacks = {
    lifecycle: {
        open: () => Promise<void>;
    };
    view: {
        setName: (value: string | undefined) => void;
        setOrder: (value: number) => void;
        setUnread: (value: number) => void;
    };
    messaging: {
        send: (message: string) => void;
        cache: {
            get: () => Promise<Array<UpdateType>>;
            set: (cache: Array<UpdateType>) => Promise<void>;
        };
        history: {
            get: () => Promise<Array<ChatWindowMessageType>>;
            set: (history: Array<ChatWindowMessageType>) => Promise<void>;
        };
    };
    events: {
        setOnProgress: (onProgress: (progress: number) => void) => void;
        setOnStateChanged: (onStateChanged: (from: ConnectionState, to: ConnectionState) => void) => void;
        setOnMessage: (onMessage: (message: string) => void) => void;
    };
};

type ConnectionCallbacksCacheHook = (id: number) => ConnectionCallbacks | undefined;

type ConnectionCallbacksCacheHookProps = {
    connections: Array<{ id: number; publicKey: string }>;
    callbacks: {
        lifecycle: {
            open: (id: number) => Promise<void>;
        };
        view: {
            setName: (id: number, value: string | undefined) => void;
            setOrder: (id: number, value: number) => void;
            setUnread: (id: number, value: number) => void;
        };
        messaging: {
            send: (id: number, message: string) => void;
            cache: {
                get: (id: number) => Promise<Array<UpdateType>>;
                set: (id: number, cache: Array<UpdateType>) => Promise<void>;
            };
            history: {
                get: (id: number) => Promise<Array<ChatWindowMessageType>>;
                set: (id: number, history: Array<ChatWindowMessageType>) => Promise<void>;
            };
        };
        events: {
            setOnProgress: (id: number, onProgress: (progress: number) => void) => void;
            setOnStateChanged: (
                id: number,
                onStateChanged: (from: ConnectionState, to: ConnectionState) => void,
            ) => void;
            setOnMessage: (id: number, onMessage: (message: string) => void) => void;
        };
    };
};

export function useConnectionCallbacksCache({
    connections,
    callbacks: {
        lifecycle: { open: openConnection },
        view: { setName: setName, setOrder: setOrder, setUnread: setUnread },
        messaging: {
            send: sendMessage,
            cache: { get: getCache, set: saveCache },
            history: { get: getHistory, set: saveHistory },
        },
        events: { setOnProgress: setOnProgress, setOnStateChanged: setOnStateChanged, setOnMessage: setOnMessage },
    },
}: ConnectionCallbacksCacheHookProps): ConnectionCallbacksCacheHook {
    const sendMessageCallbacksMapRef = useRef<Map<number, (message: string) => void>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (sendMessageCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            sendMessageCallbacksMapRef.current.set(connection.id, (message: string) =>
                sendMessage(connection.id, message),
            );
        }
    }, [connections, sendMessage]);

    const saveHistoryCallbacksMapRef = useRef<Map<number, (history: Array<ChatWindowMessageType>) => Promise<void>>>(
        new Map(),
    );

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (saveHistoryCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            saveHistoryCallbacksMapRef.current.set(
                connection.id,
                async (history: Array<ChatWindowMessageType>) => await saveHistory(connection.id, history),
            );
        }
    }, [connections, saveHistory]);

    const getHistoryCallbacksMapRef = useRef<Map<number, () => Promise<Array<ChatWindowMessageType>>>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (getHistoryCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            getHistoryCallbacksMapRef.current.set(connection.id, async () => await getHistory(connection.id));
        }
    }, [connections, getHistory]);

    const saveCacheCallbacksMapRef = useRef<Map<number, (cache: Array<UpdateType>) => Promise<void>>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (saveCacheCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            saveCacheCallbacksMapRef.current.set(
                connection.id,
                async (cache: Array<UpdateType>) => await saveCache(connection.id, cache),
            );
        }
    }, [connections, saveCache]);

    const getCacheCallbacksMapRef = useRef<Map<number, () => Promise<Array<UpdateType>>>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (getCacheCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            getCacheCallbacksMapRef.current.set(connection.id, async () => await getCache(connection.id));
        }
    }, [connections, getCache]);

    const openConnectionCallbacksMapRef = useRef<Map<number, () => Promise<void>>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (openConnectionCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            openConnectionCallbacksMapRef.current.set(connection.id, () => openConnection(connection.id));
        }
    }, [connections, openConnection]);

    const setUnreadCallbacksMapRef = useRef<Map<number, (value: number) => void>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (setUnreadCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            setUnreadCallbacksMapRef.current.set(connection.id, (value: number) => setUnread(connection.id, value));
        }
    }, [connections, setUnread]);

    const setNameCallbacksMapRef = useRef<Map<number, (value: string | undefined) => void>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (setNameCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            setNameCallbacksMapRef.current.set(connection.id, (value: string | undefined) =>
                setName(connection.id, value),
            );
        }
    }, [connections, setName]);

    const setOrderCallbacksMapRef = useRef<Map<number, (value: number) => void>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (setOrderCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            setOrderCallbacksMapRef.current.set(connection.id, (value: number) => setOrder(connection.id, value));
        }
    }, [connections, setOrder]);

    const setOnProgressCallbacksMapRef = useRef<Map<number, (onProgress: (progress: number) => void) => void>>(
        new Map(),
    );

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (setOnProgressCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            setOnProgressCallbacksMapRef.current.set(connection.id, (onProgress: (progress: number) => void) => {
                setOnProgress(connection.id, onProgress);
            });
        }
    }, [connections, setOnProgress]);

    const setOnStateChangedCallbacksMapRef = useRef<
        Map<number, (onStateChanged: (from: ConnectionState, to: ConnectionState) => void) => void>
    >(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (setOnStateChangedCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            setOnStateChangedCallbacksMapRef.current.set(
                connection.id,
                (onStateChanged: (from: ConnectionState, to: ConnectionState) => void) =>
                    setOnStateChanged(connection.id, onStateChanged),
            );
        }
    }, [connections, setOnStateChanged]);

    const setOnMessageCallbacksMapRef = useRef<Map<number, (onMessage: (message: string) => void) => void>>(new Map());

    useLayoutEffect(() => {
        for (const connection of connections) {
            if (setOnMessageCallbacksMapRef.current.has(connection.id)) {
                continue;
            }
            setOnMessageCallbacksMapRef.current.set(connection.id, (onMessage: (message: string) => void) =>
                setOnMessage(connection.id, onMessage),
            );
        }
    }, [connections, setOnMessage]);

    return (id: number): ConnectionCallbacks | undefined => {
        const openConnection = openConnectionCallbacksMapRef.current.get(id);
        const setName = setNameCallbacksMapRef.current.get(id);
        const setOrder = setOrderCallbacksMapRef.current.get(id);
        const setUnread = setUnreadCallbacksMapRef.current.get(id);
        const sendMessage = sendMessageCallbacksMapRef.current.get(id);
        const getCache = getCacheCallbacksMapRef.current.get(id);
        const saveCache = saveCacheCallbacksMapRef.current.get(id);
        const getHistory = getHistoryCallbacksMapRef.current.get(id);
        const saveHistory = saveHistoryCallbacksMapRef.current.get(id);
        const setOnProgress = setOnProgressCallbacksMapRef.current.get(id);
        const setOnStateChanged = setOnStateChangedCallbacksMapRef.current.get(id);
        const setOnMessage = setOnMessageCallbacksMapRef.current.get(id);

        if (
            openConnection !== undefined &&
            openConnection !== null &&
            setName !== undefined &&
            setName !== null &&
            setOrder !== undefined &&
            setOrder !== null &&
            setUnread !== undefined &&
            setUnread !== null &&
            sendMessage !== undefined &&
            sendMessage !== null &&
            getCache !== undefined &&
            getCache !== null &&
            saveCache !== undefined &&
            saveCache !== null &&
            getHistory !== undefined &&
            getHistory !== null &&
            saveHistory !== undefined &&
            saveHistory !== null &&
            setOnProgress !== undefined &&
            setOnProgress !== null &&
            setOnStateChanged !== undefined &&
            setOnStateChanged !== null &&
            setOnMessage !== undefined &&
            setOnMessage !== null
        ) {
            return {
                lifecycle: {
                    open: openConnection,
                },
                view: {
                    setName: setName,
                    setOrder: setOrder,
                    setUnread: setUnread,
                },
                messaging: {
                    send: sendMessage,
                    cache: {
                        get: getCache,
                        set: saveCache,
                    },
                    history: {
                        get: getHistory,
                        set: saveHistory,
                    },
                },
                events: {
                    setOnProgress,
                    setOnStateChanged,
                    setOnMessage,
                },
            };
        }
        return undefined;
    };
}
