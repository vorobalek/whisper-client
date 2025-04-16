import './QrScannerModal.css';
import React from 'react';
import { useZxing } from 'react-zxing';

interface QrScannerVideoProps {
    paused: boolean;
    hidden: boolean;
    onPlay: () => void;
    onClose: () => void;
    onResult: (decodedText: string) => void;
}

const QrScannerVideo: React.FC<QrScannerVideoProps> = ({ paused, hidden, onPlay, onClose, onResult }) => {
    const { ref } = useZxing({
        onDecodeResult(result) {
            onResult(result.getText());
            onClose();
        },
        paused: paused,
    });

    return (
        <video
            ref={ref as React.RefObject<HTMLVideoElement>}
            muted
            autoPlay
            playsInline
            onPlay={onPlay}
            hidden={hidden}
        />
    );
};

export default QrScannerVideo;
