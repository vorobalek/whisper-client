import './SecureInfoModal.css';
import React from 'react';

interface SecureInfoModalProps {
    visible: boolean;
    onClose: () => void;
}

const SecureInfoModal: React.FC<SecureInfoModalProps> = ({ visible, onClose }) => {
    if (!visible) return null;

    const openDocs = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        const url = `${process.env.FRONTEND_URL}/docs/protocol.svg?_=${process.env.BUILD_TIMESTAMP}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const openCoverage = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
        e.preventDefault();
        const url = `${process.env.FRONTEND_URL}/coverage/index.html`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

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
                            The Whisper server only stores your public signature key and, if you consent, your push
                            subscription. It relays data without retention or modification.
                        </p>
                        <p>Whisper communicates with its server exclusively over HTTPS.</p>

                        <p>
                            <a
                                href={`${process.env.FRONTEND_URL}/docs/protocol.svg?_=${process.env.BUILD_TIMESTAMP}`}
                                target='_blank'
                                rel='external noopener noreferrer'
                                onClick={openDocs}
                            >
                                See full protocol schema for details.
                            </a>
                        </p>

                        <p>
                            <a
                                href={`${process.env.FRONTEND_URL}/coverage/index.html`}
                                target='_blank'
                                rel='external noopener noreferrer'
                                onClick={openCoverage}
                            >
                                See source code and coverage.
                            </a>
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
