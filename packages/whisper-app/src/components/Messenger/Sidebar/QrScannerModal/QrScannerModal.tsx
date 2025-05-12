import AnimatedDots from '../../../AnimatedDots';
import './QrScannerModal.css';
import React, { Suspense, useCallback, useEffect, useState } from 'react';

interface QrScannerModalProps {
    visible: boolean;
    onClose: () => void;
    onResult: (decodedText: string) => void;
}

const QrScannerModal: React.FC<QrScannerModalProps> = ({ visible, onClose, onResult }) => {
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const [videoLoaded, setVideoLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadScript = useCallback(
        (url: string, waitFor: () => boolean): Promise<void> => {
            return new Promise((resolve, reject) => {
                const element = document.querySelector(`script[src="${url}"]`);
                if (element) {
                    if (scriptLoaded) {
                        resolve();
                        return;
                    } else {
                        element.remove();
                    }
                }
                const script = document.createElement('script');
                script.src = url;
                script.onload = async () => {
                    while (!waitFor()) {
                        await new Promise<void>((resolveAwaiter) => {
                            setTimeout(() => resolveAwaiter(), 100);
                        });
                    }
                    resolve();
                };
                script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
                document.body.appendChild(script);
            });
        },
        [scriptLoaded],
    );

    useEffect(() => {
        if (visible && !scriptLoaded) {
            const url = `${process.env.WHISPER_FRONTEND_URL}/scripts/zxing.0.21.3.min.js`;
            loadScript(url, () => !!(window as any).ZXing)
                .then(async () => {
                    setScriptLoaded(true);
                    setError(null);
                })
                .catch((error: Error) => {
                    setError(error.message);
                });
        }
    }, [visible, scriptLoaded]);

    const QrScannerVideoLazy = React.lazy(() =>
        import(/* webpackChunkName: "scanner.min" */ './QrScannerVideo')
            .then((result) => {
                return result;
            })
            .catch((error: Error) => {
                return {
                    default: () => <pre>{error.message}</pre>,
                };
            }),
    );
    const qrScannerVideoFallback = (
        <>
            <h2>Loading plugin</h2>
            <AnimatedDots />
        </>
    );
    const qrScannerVideo = (
        <>
            <Suspense fallback={qrScannerVideoFallback}>
                {!scriptLoaded ? (
                    qrScannerVideoFallback
                ) : (
                    <>
                        {!videoLoaded ? (
                            <>
                                <h2>Loading video</h2>
                                <AnimatedDots />
                            </>
                        ) : (
                            <>
                                <h2>Scan QR code</h2>
                            </>
                        )}
                        <QrScannerVideoLazy
                            paused={!visible}
                            hidden={!videoLoaded}
                            onPlay={() => setVideoLoaded(true)}
                            onClose={onClose}
                            onResult={onResult}
                        />
                    </>
                )}
            </Suspense>
        </>
    );

    if (!visible) return null;

    return (
        <div className='qr-scanner-modal-overlay'>
            <div className='qr-scanner-modal-content'>
                {qrScannerVideo}
                {error && <pre>{error}</pre>}
                <button
                    onClick={() => {
                        setVideoLoaded(false);
                        onClose();
                    }}
                    className='qr-scanner-modal-close-btn'
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default QrScannerModal;
