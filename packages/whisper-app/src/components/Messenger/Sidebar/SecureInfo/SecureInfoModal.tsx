import './SecureInfoModal.css';
import React from 'react';

interface SecureInfoModalProps {
    visible: boolean;
    onClose: () => void;
}

const SecureInfoModal: React.FC<SecureInfoModalProps> = ({ visible, onClose }) => {
    if (!visible) return null;

    return (
        <div className='privacy-info-modal-overlay'>
            <div className='privacy-info-modal-content'>
                <div className='privacy-info-modal-body'>
                    <div>
                        <p>
                            All data transfers are time-sensitive, signed, and verified by both server and recipient.
                            Private messages use end-to-end encryption with a unique key refreshed on each reconnection.
                            This key is never stored or shared. Chat history and your private signature key are stored
                            encrypted, protected by your password, and never leave your device. All WebRTC data is
                            transmitted with end-to-end encryption.
                        </p>
                        <p>
                            No registration or disclosure of personal data is required. Dual peer-to-peer channels are
                            established for reliability and to circumvent regional restrictions, with seamless fallback
                            to relay servers if direct P2P is unavailable. The protocol is trustless by design: neither
                            backend nor relay servers nor counterparties can compromise your privacy. Private messages
                            are unlinkable — no one can determine sender or recipient, and messages contain no
                            identifying marks.
                        </p>
                        <p>
                            The Whisper server only stores your public signature key and, if you consent, your push
                            subscription. It relays data without retention or modification.
                        </p>
                        <p>Whisper communicates with its server exclusively over HTTPS.</p>

                        <p>
                            <a
                                href={`${process.env.WHISPER_CLIENT_URL}/docs/protocol.svg?_=${process.env.WHISPER_BUILD_TIMESTAMP}`}
                                target='_blank'
                                rel='external noopener noreferrer'
                            >
                                See full protocol schema for details.
                            </a>
                        </p>

                        <p>
                            See&nbsp;
                            <a
                                href={'https://github.com/vorobalek/whisper-client'}
                                target='_blank'
                                rel='external noopener noreferrer'
                            >
                                source code
                            </a>
                            &nbsp;and&nbsp;
                            <a
                                href={`${process.env.WHISPER_CLIENT_URL}/coverage/index.html`}
                                target='_blank'
                                rel='external noopener noreferrer'
                            >
                                coverage
                            </a>
                            .
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className='privacy-info-modal-close-btn'
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default SecureInfoModal;
