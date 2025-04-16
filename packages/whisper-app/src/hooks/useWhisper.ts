import { LogEntryProps } from '../components/Logs/LogEntry';
import { ChatWindowMessageType } from '../components/Messenger/Chat/ChatWindow';
import { UpdateType } from '../types/updateType';
import { getCryptography } from '../utils/cryptography';
import getDatabase from '../utils/database';
import { now, serverTime } from '../utils/functions';
import { Logger } from '../utils/logger';
import { useSearchParams } from './useSearchParams';
import { getPrototype, Connection, ConnectionState, Whisper, WhisperPrototype } from '@whisper/core';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import LogLevel = App.LogLevel;

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        whisper: Whisper & {
            [key: string]: any;
        };
    }
}

type WhisperHookMetadataPasswordState = undefined | 'none' | 'valid' | 'invalid';

type WhisperHookMetadata = {
    needUpdate: boolean;
    logs: Array<LogEntryProps>;
    unstable: [boolean, string | undefined];
    password: WhisperHookMetadataPasswordState;
};

export type WhisperHookConnectionCallbacks = {
    lifecycle: {
        open: (id: number) => Promise<void>;
        delete: (id: number) => Promise<void>;
    };
    view: {
        setOrder: (id: number, value: number) => void;
        setName: (id: number, value: string | undefined) => void;
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
        setOnStateChanged: (id: number, onStateChanged: (from: ConnectionState, to: ConnectionState) => void) => void;
        setOnMessage: (id: number, onMessage: (message: string) => void) => void;
    };
};

type WhisperHookConnections = {
    available: Array<{ id: number; publicKey: string; name: string | undefined; order: number }>;
    active: [number | undefined, React.Dispatch<React.SetStateAction<number | undefined>>];
    create: (publicKey: string) => number;
    callbacks: WhisperHookConnectionCallbacks;
};

type WhisperHook = [string | undefined, WhisperHookMetadata, WhisperHookConnections];

export function useWhisper(
    password: string | undefined,
    onPermissionDefault: () => Promise<void>,
    onPermissionGranted: () => Promise<void>,
    onPermissionDenied: () => Promise<void>,
    focusOnDial: (publicKey: string) => Promise<boolean>,
    requestDial: (publicKey: string, alreadyExists: boolean) => Promise<boolean>,
    onIncomingConnection: (connection: Connection) => void,
    onConnectionStateChanged: (connection: Connection, from: ConnectionState, to: ConnectionState) => void,
): WhisperHook {
    const [publicKey, setPublicKey] = useState<string | undefined>();

    // logs
    const [logs, setLogs] = useState<Array<LogEntryProps>>([]);

    const logger = useMemo<Logger>(() => {
        const originalConsole = { ...console };
        function getLine(...args: any[]) {
            return args
                .map((arg) => {
                    if (arg instanceof Error) {
                        return JSON.stringify(arg, Object.getOwnPropertyNames(arg));
                    } else if (typeof arg === 'object') {
                        return JSON.stringify(arg);
                    } else {
                        return String(arg);
                    }
                })
                .join(' ');
        }

        const MAX_LOG_LENGTH = 500;
        function documentLog(level: LogLevel, ...args: any[]) {
            const timestamp = now();
            const content = getLine(...args);
            setLogs((prevLogs) => {
                if (prevLogs.length > MAX_LOG_LENGTH) prevLogs.shift();
                return [...prevLogs, { timestamp, level, content }];
            });
        }

        return {
            trace(...args: any[]) {
                switch (process.env.CONSOLE_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                        originalConsole.trace(...args);
                        break;
                }
                switch (process.env.DOCUMENT_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                        documentLog('trace', ...args);
                        break;
                }
            },
            debug(...args: any[]) {
                switch (process.env.CONSOLE_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                    case 'debug':
                        originalConsole.debug(...args);
                        break;
                }
                switch (process.env.DOCUMENT_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                    case 'debug':
                        documentLog('debug', ...args);
                        break;
                }
            },
            log(...args: any[]) {
                switch (process.env.CONSOLE_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                    case 'debug':
                    case 'info':
                        originalConsole.log(...args);
                        break;
                }
                switch (process.env.DOCUMENT_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                    case 'debug':
                    case 'info':
                        documentLog('info', ...args);
                        break;
                }
            },
            warn(...args: any[]) {
                switch (process.env.CONSOLE_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                    case 'debug':
                    case 'info':
                    case 'warn':
                        originalConsole.warn(...args);
                        break;
                }
                switch (process.env.DOCUMENT_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                    case 'debug':
                    case 'info':
                    case 'warn':
                        documentLog('warn', ...args);
                        break;
                }
            },
            error(...args: any[]) {
                switch (process.env.CONSOLE_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                    case 'debug':
                    case 'info':
                    case 'warn':
                    case 'error':
                        originalConsole.error(...args);
                        break;
                }
                switch (process.env.DOCUMENT_LOG_LEVEL as App.LogLevel) {
                    case 'trace':
                    case 'debug':
                    case 'info':
                    case 'warn':
                    case 'error':
                        documentLog('error', ...args);
                        break;
                }
            },
        };
    }, []);
    const cryptography = useMemo(() => getCryptography(), []);
    const whisperPrototype = useMemo<WhisperPrototype>(() => getPrototype(logger), [logger]);

    const DB_SLUG = 'whisper';
    const DB_SLUG_TABLE_CHECK = 'check';
    type DB_CHECK_TYPE = { value: boolean; timestamp: number };
    const DB_SLUG_TABLE_KEYS = 'keys';
    type DB_KEYS_TYPE = [number[], number[]];
    const DB_SLUG_TABLE_CONNECTIONS = 'connections';
    type DB_CONNECTIONS_TYPE = {
        publicKey: string;
        order: number;
        name: string | undefined;
    };
    const DB_SLUG_TABLE_HISTORY = 'history';
    type DB_HISTORY_TYPE = Array<ChatWindowMessageType>;
    const DB_SLUG_TABLE_CACHE = 'cache';
    type DB_CACHE_TYPE = Array<UpdateType>;
    const database = useMemo(() => {
        const db = getDatabase(logger, cryptography);
        db.initialize({
            dbName: DB_SLUG,
            tables: [
                DB_SLUG_TABLE_CHECK,
                DB_SLUG_TABLE_KEYS,
                DB_SLUG_TABLE_CONNECTIONS,
                DB_SLUG_TABLE_HISTORY,
                DB_SLUG_TABLE_CACHE,
            ],
        });
        return db;
    }, [logger, cryptography]);

    const [passwordState, setPasswordState] = useState<WhisperHookMetadataPasswordState>();

    useEffect(() => {
        if (database) {
            setPasswordState(undefined);
            async function check() {
                try {
                    const check = await database.get<DB_CHECK_TYPE>(DB_SLUG_TABLE_CHECK, 'check', password || '');
                    if (check === null) {
                        if (password === undefined || password === '') {
                            setPasswordState('none');
                        } else {
                            await database.set<DB_CHECK_TYPE>(
                                DB_SLUG_TABLE_CHECK,
                                'check',
                                { value: true, timestamp: now() },
                                password,
                            );
                            setPasswordState('valid');
                        }
                    } else if (check.value) {
                        setPasswordState('valid');
                    }
                } catch {
                    if (!(password === undefined || password === null || password === '')) {
                        setPasswordState('invalid');
                    }
                }
            }
            check().then();
        }
    }, [password, database]);

    const [signingKeyPair, setSigningKeyPair] = useState<
        { publicKey: Uint8Array; secretKey: Uint8Array } | undefined
    >();

    const signingKeyPairGenerated = useRef(false);

    useEffect(() => {
        if (password && passwordState === 'valid' && database && !signingKeyPair && whisperPrototype) {
            database
                .get<DB_KEYS_TYPE>(DB_SLUG_TABLE_KEYS, 'signing', password)
                .then(async (keyPair) => {
                    const [pub, sec] = keyPair || [];
                    if (pub === undefined || pub === null || sec === undefined || sec === null) {
                        if (signingKeyPairGenerated.current) {
                            return;
                        }
                        signingKeyPairGenerated.current = true;
                        const keyPair = whisperPrototype.generateSigningKeyPair();
                        await database.set<DB_KEYS_TYPE>(
                            DB_SLUG_TABLE_KEYS,
                            'signing',
                            [Array.from(keyPair.publicKey), Array.from(keyPair.secretKey)],
                            password,
                        );
                        return keyPair;
                    } else {
                        return {
                            publicKey: Uint8Array.from(pub),
                            secretKey: Uint8Array.from(sec),
                        };
                    }
                })
                .then((keyPair) => setSigningKeyPair(keyPair));
        }
    }, [password, passwordState, database, signingKeyPair, whisperPrototype]);

    const getStoredConnections = useCallback(async (): Promise<
        Array<{ id: number; publicKey: string; name: string | undefined; order: number }>
    > => {
        if (password && passwordState === 'valid' && database) {
            const connections = (await database.getAll<DB_CONNECTIONS_TYPE>(DB_SLUG_TABLE_CONNECTIONS, password)) || [];
            return connections.map((connection) => ({
                id: +connection.id,
                publicKey: connection.value.publicKey,
                name: connection.value.name,
                order: connection.value.order,
            }));
        }
        return [];
    }, [password, passwordState, database]);

    const upsertStoredConnection = useCallback(
        async (connection: { id: number; publicKey: string; name: string | undefined; order: number }) => {
            const data = { publicKey: connection.publicKey, name: connection.name, order: connection.order };
            if (password && passwordState === 'valid' && database) {
                await database.set<DB_CONNECTIONS_TYPE>(DB_SLUG_TABLE_CONNECTIONS, `${connection.id}`, data, password);
            }
        },
        [password, passwordState, database],
    );

    const setStoredConnections = useCallback(
        async (values: Array<{ id: number; publicKey: string; name: string | undefined; order: number }>) => {
            if (password && passwordState === 'valid' && database) {
                await database.clear(DB_SLUG_TABLE_CONNECTIONS);
                for (const value of values) {
                    const data = { publicKey: value.publicKey, name: value.name, order: value.order };
                    await database.set<DB_CONNECTIONS_TYPE>(DB_SLUG_TABLE_CONNECTIONS, `${value.id}`, data, password);
                }
            }
        },
        [password, passwordState, database],
    );

    const [connections, setConnections] = useState<
        Array<{ id: number; publicKey: string; name: string | undefined; order: number }>
    >([]);
    const connectionsRef = useRef<Map<number, Connection>>();

    const _initConnections = useCallback(
        (connections: Array<{ id: number; publicKey: string; name: string | undefined; order: number }>) => {
            let newMap: Map<number, Connection> = new Map<number, Connection>();
            for (const { id, publicKey } of connections) {
                newMap.set(id, window.whisper.get(publicKey));
            }
            connectionsRef.current = newMap;
            setConnections(connections.sort((a, b) => a.id - b.id));
            setStoredConnections(connections).catch(logger.error);
        },
        [logger, setStoredConnections],
    );

    const _upsertConnection = useCallback(
        (id: number, connection: Connection) => {
            if (!connectionsRef.current) return;
            connectionsRef.current.set(id, connection);
            setConnections((prevConnections) => {
                const newConnection = prevConnections.find((connection) => connection.id === id) || {
                    id: id,
                    publicKey: connection.publicKey,
                    order: now(),
                    name: undefined,
                };
                upsertStoredConnection(newConnection).catch(logger.error);
                return [...prevConnections.filter((connection) => connection.id !== id), newConnection].sort(
                    (a, b) => a.id - b.id,
                );
            });
        },
        [logger, upsertStoredConnection],
    );

    const _deleteConnection = useCallback(
        async (id: number, connection: Connection) => {
            if (!connectionsRef.current) return;
            window.whisper.delete(connection.publicKey);
            connectionsRef.current.delete(id);
            setConnections((prevConnections) =>
                prevConnections.filter((connection) => connection.id !== id).sort((a, b) => a.id - b.id),
            );
            if (database) {
                const idString = `${id}`;
                await database.delete(DB_SLUG_TABLE_CONNECTIONS, idString);
                await database.delete(DB_SLUG_TABLE_HISTORY, idString);
                await database.delete(DB_SLUG_TABLE_CACHE, idString);
            }
        },
        [database],
    );

    const [activeConnectionId, setActiveConnectionId] = useState<number | undefined>();

    // unstable mode
    const [unstable, setUnstable] = useState<[boolean, string | undefined]>([false, undefined]);

    // new version available
    const [needUpdate, setNeedUpdate] = useState<boolean>(false);

    // on connection
    const resolveConnectionInitializedAwaiterRef = useRef<{ [id: number]: () => void }>({});
    const assertConnectionInitialized = useCallback((id: number) => {
        if (!connectionsRef.current) return false;
        const connection = connectionsRef.current.get(id);
        const validState =
            connection !== undefined &&
            connection !== null &&
            connection.onProgress !== undefined &&
            connection.onProgress !== null &&
            connection.onStateChanged !== undefined &&
            connection.onStateChanged !== null &&
            connection.onMessage !== undefined &&
            connection.onMessage !== null;
        const resolve = resolveConnectionInitializedAwaiterRef.current[id];
        if (validState && resolve !== undefined && resolve !== null) {
            resolve();
        }
        return validState;
    }, []);
    const connectionInitializedAwaiter = useCallback(
        async (id: number) => {
            if (assertConnectionInitialized(id)) return;
            await new Promise<void>((resolve) => {
                resolveConnectionInitializedAwaiterRef.current[id] = resolve;
            });
        },
        [assertConnectionInitialized],
    );
    const onConnection = useCallback(
        (newConnection: Connection) => {
            if (!connectionsRef.current) return -1;
            onIncomingConnection(newConnection);
            let [id, connection] = [...connectionsRef.current].find(
                ([, connection]) => connection.publicKey === newConnection.publicKey,
            ) || [undefined, undefined];
            if (
                connection !== undefined &&
                connection !== null &&
                connection.publicKey !== newConnection.publicKey &&
                connection.state !== ConnectionState.Closed
            ) {
                connection.close();
            }
            if (id === undefined || id === null) {
                const existingIds = [...connectionsRef.current.keys()];
                if (existingIds.length > 0) {
                    id = Math.max(...existingIds) + 1;
                } else {
                    id = 0;
                }
            }
            _upsertConnection(id, newConnection);
            setActiveConnectionId(id);
            return id;
        },
        [onIncomingConnection, _upsertConnection],
    );

    const [disablePushServiceValue] = useSearchParams('__debug_disable_push_service');

    // init
    useEffect(() => {
        if (
            passwordState === 'valid' &&
            signingKeyPair !== undefined &&
            signingKeyPair !== null &&
            whisperPrototype !== undefined &&
            whisperPrototype !== null &&
            (window.whisper === undefined || window.whisper === null)
        ) {
            whisperPrototype
                .initialize({
                    onMayWorkUnstably: (reason: string) => {
                        setUnstable([true, reason]);
                        return Promise.resolve();
                    },

                    // SignalRServiceConfig && CallServiceConfig
                    serverUrl: process.env.SERVER_URL,

                    // WorkerServiceConfig
                    version: process.env.BUILD_TIMESTAMP,
                    onNewVersion: () => {
                        setNeedUpdate(true);
                    },

                    // PushServiceConfig
                    disablePushService: disablePushServiceValue === 'true' ? true : undefined,
                    vapidKey: process.env.VAPID_KEY,
                    onPermissionDefault: onPermissionDefault,
                    onPermissionGranted: onPermissionGranted,
                    onPermissionDenied: onPermissionDenied,

                    // SessionServiceConfig
                    signingKeyPair: signingKeyPair,

                    // ConnectionServiceConfig
                    onIncomingConnection: onConnection,
                    iceServers: [
                        {
                            urls: 'stun:coturn.sfo3.do.vorobalek.dev:3478',
                        },
                        {
                            urls: 'stun:coturn.ams3.do.vorobalek.dev:3478',
                        },
                        {
                            urls: 'stun:coturn.fra1.do.vorobalek.dev:3478',
                        },
                        {
                            urls: 'turn:coturn.sfo3.do.vorobalek.dev:3478',
                            username: 'anonymous',
                            credential: 'anonymous',
                        },
                        {
                            urls: 'turn:coturn.ams3.do.vorobalek.dev:3478',
                            username: 'anonymous',
                            credential: 'anonymous',
                        },
                        {
                            urls: 'turn:coturn.fra1.do.vorobalek.dev:3478',
                            username: 'anonymous',
                            credential: 'anonymous',
                        },
                    ],

                    // HandleServiceConfig
                    focusOnDial: (publicKey: string) => {
                        if (!connectionsRef.current) return Promise.resolve(false);
                        return focusOnDial(publicKey);
                    },
                    requestDial: (key: string) => {
                        if (!connectionsRef.current) return Promise.resolve(false);
                        const connection = [...connectionsRef.current.values()].find(
                            ({ publicKey }) => publicKey === key,
                        );
                        return requestDial(key, connection !== undefined && connection !== null);
                    },
                })
                .then(async (_whisper) => {
                    function downloadData(name: string, data: any, space?: string | number) {
                        const tmpA = document.createElement('a');
                        tmpA.href = window.URL.createObjectURL(
                            new Blob([JSON.stringify(data, null, space)], { type: 'application/json' }),
                        );
                        tmpA.download = `${name}.json`;
                        tmpA.click();
                        tmpA.remove();
                    }

                    function uploadEncryptedDatabase(dbName: string, force: boolean = false) {
                        const tmpInput = document.createElement('input');
                        tmpInput.type = 'file';
                        tmpInput.onchange = (e) => {
                            const file = (e.target! as HTMLInputElement)!.files![0];
                            const reader = new FileReader();
                            reader.readAsText(file, 'UTF-8');
                            reader.onload = async (readerEvent) => {
                                const content = readerEvent.target!.result as string;
                                await database.createDatabaseFromDump(dbName, JSON.parse(content), force);
                            };
                        };
                        tmpInput.click();
                        tmpInput.remove();
                    }

                    async function downloadEncryptedDatabase() {
                        const data = await database.getRawDump();
                        downloadData(`${serverTime()}-whisper-encrypted`, data);
                    }

                    window.whisper = _whisper;
                    // noinspection JSUnusedGlobalSymbols
                    window.whisper['__debug'] = {
                        downloadEncryptedDatabase,
                        uploadEncryptedDatabase,
                    };
                    const storedConnections = await getStoredConnections();
                    _initConnections(storedConnections);

                    setPublicKey(_whisper.publicKey);
                })
                .catch(logger.error);
        }
    }, [
        passwordState,
        signingKeyPair,
        whisperPrototype,
        onPermissionDefault,
        onPermissionGranted,
        onPermissionDenied,
        onConnection,
        focusOnDial,
        requestDial,
        getStoredConnections,
        _initConnections,
        logger,
    ]);

    const createConnection = useCallback(
        (publicKey: string) => {
            const newConnection = window.whisper.get(publicKey.trim());
            return onConnection(newConnection);
        },
        [onConnection],
    );

    const openConnection = useCallback(
        async (id: number) => {
            if (!connectionsRef.current) return;
            const connection = connectionsRef.current.get(id);
            await connectionInitializedAwaiter(id);
            if (connection === undefined || connection === null) {
                return;
            }
            await connection.open();
        },
        [connectionInitializedAwaiter],
    );

    const deleteConnection = useCallback(
        async (id: number) => {
            if (!connectionsRef.current) return;
            const connection = connectionsRef.current.get(id);
            if (connection !== undefined && connection !== null) {
                connection.close();
                _deleteConnection(id, connection).catch(console.error);
            }
            setActiveConnectionId((prevActiveConnectionId) =>
                prevActiveConnectionId === id ? undefined : prevActiveConnectionId,
            );
        },
        [_deleteConnection],
    );

    const sendMessage = useCallback((id: number, message: string) => {
        if (!connectionsRef.current) return;
        const connection = connectionsRef.current.get(id);
        if (connection === undefined || connection === null || connection.state !== 'open') {
            return;
        }
        connection.send(message);
    }, []);

    const saveHistory = useCallback(
        async (id: number, history: Array<ChatWindowMessageType>) => {
            if (password && passwordState === 'valid' && database) {
                await database.set<DB_HISTORY_TYPE>(DB_SLUG_TABLE_HISTORY, `${id}`, history, password);
            }
        },
        [password, passwordState, database],
    );

    const getHistory = useCallback(
        async (id: number): Promise<Array<ChatWindowMessageType>> => {
            if (password && passwordState === 'valid' && database) {
                return (await database.get<DB_HISTORY_TYPE>(DB_SLUG_TABLE_HISTORY, `${id}`, password)) || [];
            }
            return [];
        },
        [password, passwordState, database],
    );

    const saveCache = useCallback(
        async (id: number, cache: Array<UpdateType>) => {
            if (password && passwordState === 'valid' && database) {
                await database.set<DB_CACHE_TYPE>(DB_SLUG_TABLE_CACHE, `${id}`, cache, password);
            }
        },
        [password, passwordState, database],
    );

    const getCache = useCallback(
        async (id: number): Promise<Array<UpdateType>> => {
            if (password && passwordState === 'valid' && database) {
                return (await database.get<DB_CACHE_TYPE>(DB_SLUG_TABLE_CACHE, `${id}`, password)) || [];
            }
            return [];
        },
        [password, passwordState, database],
    );

    const setConnectionOrder = useCallback(
        (id: number, value: number) => {
            setConnections((prevConnections) => {
                const newConnections: Array<{
                    id: number;
                    publicKey: string;
                    name: string | undefined;
                    order: number;
                }> = [];
                for (const [connectionId, connection] of connectionsRef.current ?? []) {
                    const prevConnection = prevConnections.find((connection) => connection.id === connectionId);
                    const order = connectionId === id ? value : prevConnection?.order || now();
                    if (prevConnection !== undefined && prevConnection !== null) {
                        const data = {
                            ...prevConnection,
                            order,
                        };
                        newConnections.push(data);
                        upsertStoredConnection(data).catch(logger.error);
                    } else {
                        newConnections.push({
                            id: connectionId,
                            publicKey: connection.publicKey,
                            order,
                            name: undefined,
                        });
                    }
                }
                return newConnections;
            });
        },
        [upsertStoredConnection],
    );

    const setConnectionName = useCallback(
        (id: number, value: string | undefined) => {
            setConnections((prevConnections) => {
                const newConnections: Array<{
                    id: number;
                    publicKey: string;
                    name: string | undefined;
                    order: number;
                }> = [];
                for (const [connectionId, connection] of connectionsRef.current ?? []) {
                    const prevConnection = prevConnections.find((connection) => connection.id === connectionId);
                    const name = connectionId === id ? value : prevConnection?.name;
                    if (prevConnection !== undefined && prevConnection !== null) {
                        const data = {
                            ...prevConnection,
                            name,
                        };
                        newConnections.push(data);
                        upsertStoredConnection(data).catch(logger.error);
                    } else {
                        newConnections.push({
                            id: connectionId,
                            publicKey: connection.publicKey,
                            order: now(),
                            name,
                        });
                    }
                }
                return newConnections;
            });
        },
        [upsertStoredConnection],
    );

    const setOnProgress = useCallback(
        (id: number, onProgress: (progress: number) => void) => {
            if (!connectionsRef.current) return;
            const connection = connectionsRef.current.get(id);
            if (connection === undefined || connection === null) {
                return;
            }
            connection.onProgress = onProgress;
            assertConnectionInitialized(id);
        },
        [assertConnectionInitialized],
    );

    const setOnStateChanged = useCallback(
        (id: number, onStateChanged: (from: ConnectionState, to: ConnectionState) => void) => {
            if (!connectionsRef.current) return;
            const connection = connectionsRef.current.get(id);
            if (connection === undefined || connection === null) {
                return;
            }
            connection.onStateChanged = (from, to) => {
                if (to === ConnectionState.Closed) {
                    deleteConnection(id).catch(logger.error);
                }
                onConnectionStateChanged(connection, from, to);
                onStateChanged(from, to);
            };
            assertConnectionInitialized(id);
        },
        [deleteConnection, onConnectionStateChanged, assertConnectionInitialized],
    );

    const setOnMessage = useCallback(
        (id: number, onMessage: (message: string) => void) => {
            if (!connectionsRef.current) return;
            const connection = connectionsRef.current.get(id);
            if (connection === undefined || connection === null) {
                return;
            }
            connection.onMessage = onMessage;
            assertConnectionInitialized(id);
        },
        [assertConnectionInitialized],
    );

    return [
        publicKey,
        {
            needUpdate,
            logs,
            unstable,
            password: passwordState,
        },
        {
            available: connections,
            active: [activeConnectionId, setActiveConnectionId],
            create: createConnection,
            callbacks: {
                lifecycle: {
                    open: openConnection,
                    delete: deleteConnection,
                },
                view: {
                    setOrder: setConnectionOrder,
                    setName: setConnectionName,
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
            },
        },
    ];
}
