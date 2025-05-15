import ConnectionTab from './ConnectionTab';
import QrCodeModal from './QrCodeModal';
import QrScannerModal from './QrScannerModal';
import SecureInfoModal from './SecureInfo';
import './Sidebar.css';
import { mdiShieldLockOutline } from '@mdi/js';
import Icon from '@mdi/react';
import React, { useLayoutEffect, useMemo, useState } from 'react';

type SidebarProps = {
    publicKey: string | undefined;
    active: boolean;
    needUpdate: boolean;
    activeConnectionId: number | undefined;
    connections: Array<{ id: number; publicKey: string; name: string | undefined; order: number; unread: number }>;
    connectBtnOnClick: (publicKey: string) => Promise<void>;
    refreshBtnOnClick: () => void;
    connectionEditOnClick: (id: number, publicKey: string) => void;
    connectionChooseOnClick: (id: number) => void;
    connectionDeleteOnClick: (id: number) => void;
};

const Sidebar: React.FC<SidebarProps> = ({
    publicKey,
    activeConnectionId,
    active,
    needUpdate,
    connections,
    connectBtnOnClick,
    refreshBtnOnClick,
    connectionEditOnClick,
    connectionChooseOnClick,
    connectionDeleteOnClick,
}) => {
    // Compute the active connection's public key directly
    const activeConnectionPublicKey = useMemo(() => {
        if (activeConnectionId != null) {
            return connections.find((e) => e.id === activeConnectionId)?.publicKey;
        }
        return undefined;
    }, [activeConnectionId, connections]);

    const [peerPublicKey, setPeerPublicKey] = useState<string>('');

    useLayoutEffect(() => {
        setPeerPublicKey(activeConnectionPublicKey || '');
    }, [activeConnectionPublicKey]);

    const [showQrCodeModal, setShowQrCodeModal] = useState(false);
    const [showQrScannerModal, setShowQrScannerModal] = useState(false);
    const [showSecureInfoModal, setShowSecureInfoModal] = useState(false);

    return (
        <div className={active ? 'sidebar active' : 'sidebar hidden'}>
            <div className='public-key-section'>
                <h3>Your Public Key</h3>
                <pre>{publicKey ?? 'Loading...'}</pre>
            </div>
            <div className='peer-section'>
                <h3>Peer's Public Key:</h3>
                <textarea
                    placeholder='Enter Public Key'
                    value={peerPublicKey}
                    onChange={(event) => setPeerPublicKey(event.target.value)}
                />
                <div className='qr-buttons'>
                    {publicKey && <button onClick={() => setShowQrCodeModal(true)}>Show QR</button>}
                    <button onClick={() => setShowQrScannerModal(true)}>Scan QR</button>
                </div>
                <button onClick={() => connectBtnOnClick(peerPublicKey)}>Connect</button>
            </div>
            {needUpdate && (
                <button
                    className='refresh-btn'
                    onClick={refreshBtnOnClick}
                >
                    ⬆️ Update to the New Version
                </button>
            )}
            {connections.length > 0 && (
                <div className='connections-section'>
                    <h3>Known connections:</h3>
                    <div className='connection-tabs'>
                        {connections
                            .sort((a, b) => (a.order === b.order ? 0 : a.order < b.order ? 1 : -1))
                            .map(({ id, publicKey, name, unread }) => (
                                <ConnectionTab
                                    key={id}
                                    id={id}
                                    publicKey={publicKey}
                                    name={name}
                                    active={publicKey === activeConnectionPublicKey}
                                    onEdit={() => connectionEditOnClick(id, publicKey)}
                                    onChoose={() => connectionChooseOnClick(id)}
                                    onDelete={() => connectionDeleteOnClick(id)}
                                    unread={unread}
                                />
                            ))}
                    </div>
                </div>
            )}
            <span
                className='privacy-info'
                onClick={() => setShowSecureInfoModal(true)}
            >
                <div className='link'>
                    <div className='sign'>
                        <Icon
                            path={mdiShieldLockOutline}
                            size='12pt'
                        />
                    </div>
                    <span className='info'>Read how Whisper protects your privacy</span>
                </div>
            </span>
            <span className='build-timestamp'>Build #{process.env.WHISPER_BUILD_TIMESTAMP}</span>
            <QrCodeModal
                visible={showQrCodeModal}
                onClose={() => setShowQrCodeModal(false)}
                textToEncode={publicKey || ''}
            />
            <QrScannerModal
                visible={showQrScannerModal}
                onClose={() => setShowQrScannerModal(false)}
                onResult={(decodedText: string) => {
                    setPeerPublicKey(decodedText);
                }}
            />
            <SecureInfoModal
                visible={showSecureInfoModal}
                onClose={() => setShowSecureInfoModal(false)}
            />
        </div>
    );
};

export default Sidebar;
