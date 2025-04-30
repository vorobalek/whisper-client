import DebugOverlay from './components/DebugOverlay';
import LoadingOverlay from './components/LoadingOverlay';
import Logs from './components/Logs';
import Messenger from './components/Messenger';
import PermissionOverlay from './components/PermissionOverlay';
import UnstableModeWarning from './components/UnstableModeWarning';
import { usePermissionOverlay } from './hooks/usePermissionOverlay';
import { useSearchParams } from './hooks/useSearchParams';
import { useWhisper } from './hooks/useWhisper';
import './styles.css';
import { Connection, ConnectionState } from '@whisper/core';
import React, { useCallback, useEffect, useRef, useState } from 'react';

const App: React.FC = () => {
    const [logsVisible, setLogsVisible] = useState(false);
    const [showSidebar, setShowSidebar] = useState<boolean>(true);
    const shownDialRequestsRef = useRef<{ [key: string]: boolean }>({});

    const {
        showPermissionOverlay,
        permissionOverlayOnClick,
        onPermissionDefault,
        onPermissionGranted,
        onPermissionDenied,
    } = usePermissionOverlay();

    const focusOnDial = useCallback((publicKey: string) => {
        if (document.hidden) {
            if (!shownDialRequestsRef.current[publicKey]) {
                window.whisper.showNotification('🛰️ Hey! Are you here?', {
                    body: 'Someone is trying to reach you!',
                    requireInteraction: true,
                    icon: '/favicon.png',
                });
                shownDialRequestsRef.current[publicKey] = true;
            }
            return Promise.resolve(false);
        }
        return Promise.resolve(true);
    }, []);

    const requestDial = useCallback((publicKey: string, alreadyExists: boolean) => {
        if (alreadyExists || window.confirm(`Incoming connection request from ${publicKey}.\nAccept?`)) {
            return Promise.resolve(true);
        }
        console.log('User declined the connection request.');
        return Promise.resolve(false);
    }, []);

    const onIncomingConnection = useCallback(() => {
        setShowSidebar(false);
    }, []);

    const onConnectionStateChanged = useCallback((connection: Connection, _: ConnectionState, to: ConnectionState) => {
        if (to === ConnectionState.Open) {
            shownDialRequestsRef.current[connection.publicKey] = false;
        }
    }, []);

    const [debugPassword] = useSearchParams('__debug_password');
    useEffect(() => {
        if (debugPassword) {
            setPassword(debugPassword);
        }
    }, [debugPassword]);
    const [password, setPassword] = useState(debugPassword || undefined);

    const [publicKey, metadata, connections, debugFunctions] = useWhisper(
        password,
        onPermissionDefault,
        onPermissionGranted,
        onPermissionDenied,
        focusOnDial,
        requestDial,
        onIncomingConnection,
        onConnectionStateChanged,
    );
    const [unstableMode, unstableModeReason] = metadata.unstable;
    const [activeConnectionId, setActiveConnectionId] = connections.active;

    const [enablePasswordValidation, setEnablePasswordValidation] = useState<boolean>(false);
    let passwordTitle: string | undefined;
    let passwordButton: string | undefined;
    let passwordError: string | undefined;
    switch (metadata.password) {
        case undefined:
            passwordTitle = 'Enter password to unlock database.';
            passwordButton = 'Unlock';
            passwordError = undefined;
            break;
        case 'none':
            passwordTitle = 'Create new database password.';
            passwordButton = 'Create';
            passwordError = undefined;
            break;
        case 'invalid':
            passwordTitle = 'Enter password to unlock database.';
            passwordButton = 'Unlock';
            passwordError = 'Invalid password. ';
            break;
    }

    const [debugSelfConnectValue] = useSearchParams('__debug_self_connect');
    const {
        create: createConnection,
        callbacks: {
            lifecycle: { open: openConnection },
        },
    } = connections;
    useEffect(() => {
        if (publicKey) {
            const debugSelfConnect = debugSelfConnectValue === 'true';
            if (debugSelfConnect) {
                const id = createConnection(publicKey);
                openConnection(id).catch(console.error);
            }
        }
    }, [publicKey, createConnection, openConnection, debugSelfConnectValue]);

    const { getEncryptedDatabaseBlob, setEncryptedDatabaseContent } = debugFunctions;
    const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
    useEffect(() => {
        if (publicKey) {
            window.whisper.__debug = () => {
                setShowDebugOverlay(true);
            };
        }
        return () => {
            delete window.whisper.__debug;
        };
    }, [publicKey]);

    return showDebugOverlay ? (
        <DebugOverlay
            getEncryptedDatabaseBlob={getEncryptedDatabaseBlob}
            setEncryptedDatabaseContent={setEncryptedDatabaseContent}
            onClose={() => setShowDebugOverlay(false)}
        />
    ) : (
        <>
            <Logs
                visible={logsVisible}
                setVisible={setLogsVisible}
                entries={metadata.logs}
            />
            {showPermissionOverlay ? (
                <PermissionOverlay onClick={permissionOverlayOnClick} />
            ) : publicKey === undefined || publicKey === null ? (
                <LoadingOverlay
                    passwordRequired={metadata.password === undefined || metadata.password !== 'valid'}
                    passwordValid={
                        !enablePasswordValidation || metadata.password === undefined || metadata.password === 'valid'
                    }
                    passwordError={enablePasswordValidation ? passwordError : undefined}
                    title={passwordTitle}
                    button={passwordButton}
                    onChange={() => setEnablePasswordValidation(false)}
                    onPassword={(value) => {
                        setEnablePasswordValidation(true);
                        setPassword(value);
                    }}
                />
            ) : (
                <>
                    <UnstableModeWarning
                        visible={unstableMode}
                        reason={unstableModeReason}
                    />
                    <Messenger
                        publicKey={publicKey}
                        activeConnectionId={activeConnectionId}
                        setActiveConnectionId={setActiveConnectionId}
                        connections={connections.available}
                        showSidebar={connections.available.length === 0 || showSidebar}
                        setShowSidebar={setShowSidebar}
                        needUpdate={metadata.needUpdate}
                        createConnection={connections.create}
                        callbacks={connections.callbacks}
                    />
                </>
            )}
        </>
    );
};

export default App;
