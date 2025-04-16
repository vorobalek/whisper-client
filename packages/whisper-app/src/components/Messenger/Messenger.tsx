import { useConnectionCallbacksCache } from '../../hooks/useConnectionCallbacksCache';
import { UpdateType } from '../../types/updateType';
import Chat from './Chat';
import { ChatWindowMessageType } from './Chat/ChatWindow';
import './Messenger.css';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { ConnectionState } from '@whisper/core';
import React, { useCallback, useEffect, useState } from 'react';

type MessengerProps = {
    publicKey?: string;
    activeConnectionId?: number;
    setActiveConnectionId: (id: number) => void;
    connections: Array<{ id: number; publicKey: string; name: string | undefined; order: number }>;
    showSidebar: boolean;
    setShowSidebar: (value: boolean) => void;
    needUpdate: boolean;
    createConnection: (peerPublicKey: string) => number;
    callbacks: {
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
            setOnStateChanged: (
                id: number,
                onStateChanged: (from: ConnectionState, to: ConnectionState) => void,
            ) => void;
            setOnMessage: (id: number, onMessage: (message: string) => void) => void;
        };
    };
};

const Messenger: React.FC<MessengerProps> = ({
    publicKey,
    activeConnectionId,
    setActiveConnectionId,
    connections,
    showSidebar,
    setShowSidebar,
    needUpdate,
    createConnection,
    callbacks: {
        lifecycle: { open: openConnection, delete: deleteConnection },
        view: { setOrder: setConnectionOrder, setName: setConnectionName },
        messaging: {
            send: sendConnectionMessage,
            cache: { get: getConnectionCache, set: setConnectionCache },
            history: { get: getConnectionHistory, set: setConnectionHistory },
        },
        events: {
            setOnProgress: setConnectionOnProgress,
            setOnStateChanged: setConnectionOnStateChanged,
            setOnMessage: setConnectionOnMessage,
        },
    },
}) => {
    const [connectionsOverride, setConnectionsOverride] = useState<
        Array<{ id: number; publicKey: string; name: string | undefined; order: number; unread: number }>
    >([]);

    useEffect(() => {
        setConnectionsOverride((prevConnections) => {
            let newConnections: Array<{
                id: number;
                publicKey: string;
                name: string | undefined;
                order: number;
                unread: number;
            }> = [];
            for (const connection of connections) {
                const candidateConnection = prevConnections.find((e) => e.id === connection.id);
                if (candidateConnection !== undefined && candidateConnection !== null) {
                    newConnections.push({
                        ...connection,
                        unread: candidateConnection.unread,
                    });
                    continue;
                }
                newConnections.push({
                    ...connection,
                    unread: 0,
                });
            }
            return newConnections;
        });
    }, [connections]);

    const [unread, _setUnread] = useState<number>(0);

    useEffect(() => {
        _setUnread(connectionsOverride.reduce((acc, curr) => acc + curr.unread, 0));
    }, [connectionsOverride, activeConnectionId]);

    const setUnreadOverride = useCallback((id: number, value: number) => {
        setConnectionsOverride((prevConnections) =>
            prevConnections.map((connection) =>
                connection.id === id
                    ? {
                          ...connection,
                          unread: value,
                      }
                    : connection,
            ),
        );
    }, []);

    const callbacksCache = useConnectionCallbacksCache({
        connections,
        callbacks: {
            lifecycle: {
                open: openConnection,
            },
            view: {
                setName: setConnectionName,
                setOrder: setConnectionOrder,
                setUnread: setUnreadOverride,
            },
            messaging: {
                send: sendConnectionMessage,
                cache: {
                    get: getConnectionCache,
                    set: setConnectionCache,
                },
                history: {
                    get: getConnectionHistory,
                    set: setConnectionHistory,
                },
            },
            events: {
                setOnProgress: setConnectionOnProgress,
                setOnStateChanged: setConnectionOnStateChanged,
                setOnMessage: setConnectionOnMessage,
            },
        },
    });

    const sidebarConnectBtnOnClick = useCallback(
        async (peerPublicKey: string) => {
            if (!peerPublicKey) {
                console.warn("Please enter the peer's public key.");
                alert("Please enter the peer's public key.");
                return;
            }
            const id = createConnection(peerPublicKey);
            if (id >= 0) {
                await openConnection(id);
            }
        },
        [createConnection, openConnection],
    );

    const sidebarRefreshBtnOnClick = useCallback(() => {
        location.reload();
    }, []);

    const sidebarConnectionEditOnClick = useCallback((id: number, publicKey: string) => {
        const setName = callbacksCache(id)?.view.setName;
        if (setName) {
            const name = prompt('Enter new name.', publicKey);
            if (name !== null) {
                setName(name);
            }
        }
    }, []);

    const sidebarConnectionChooseOnClick = useCallback(
        (id: number) => {
            setActiveConnectionId(id);
            setShowSidebar(false);
        },
        [setActiveConnectionId, setShowSidebar],
    );

    const sidebarConnectionDeleteOnClick = useCallback(
        async (id: number) => {
            await deleteConnection(id);
        },
        [deleteConnection],
    );

    return (
        <div className='messenger'>
            <Navbar
                title={showSidebar ? 'Go to Chat ==>' : '<== Back to Connect'}
                unread={showSidebar ? undefined : unread}
                onClick={() => setShowSidebar(!showSidebar)}
            />
            <Sidebar
                publicKey={publicKey}
                activeConnectionId={activeConnectionId}
                active={showSidebar}
                connections={connectionsOverride}
                needUpdate={needUpdate}
                connectBtnOnClick={sidebarConnectBtnOnClick}
                refreshBtnOnClick={sidebarRefreshBtnOnClick}
                connectionEditOnClick={sidebarConnectionEditOnClick}
                connectionChooseOnClick={sidebarConnectionChooseOnClick}
                connectionDeleteOnClick={sidebarConnectionDeleteOnClick}
            />
            {connections.map(({ id, name }) => {
                const callbacks = callbacksCache(id);
                if (callbacks !== undefined && callbacks !== null) {
                    return (
                        <Chat
                            key={id}
                            visible={id === activeConnectionId}
                            active={!showSidebar}
                            name={name}
                            callbacks={callbacks}
                        />
                    );
                }
            })}
        </div>
    );
};

export default Messenger;
