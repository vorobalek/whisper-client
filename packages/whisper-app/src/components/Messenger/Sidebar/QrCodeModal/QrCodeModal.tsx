import './QrCodeModal.css';
import { QRCodeSVG } from 'qrcode.react';
import React from 'react';

interface QrCodeModalProps {
    visible: boolean;
    onClose: () => void;
    textToEncode: string;
}

const QrCodeModal: React.FC<QrCodeModalProps> = ({ visible, onClose, textToEncode }) => {
    if (!visible) return null;
    return (
        <div className='qr-code-modal-overlay'>
            <div className='qr-code-modal-content'>
                <QRCodeSVG
                    value={textToEncode}
                    size={256}
                    level='H'
                />
                <button
                    onClick={onClose}
                    className='qr-code-modal-close-btn'
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default QrCodeModal;
