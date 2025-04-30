import { serverTime } from '../../utils/functions';
import './DebugOverlay.css';
import React, { useCallback } from 'react';

type DebugOverlayProps = {
    getEncryptedDatabaseBlob: () => Promise<Blob>;
    setEncryptedDatabaseContent: (content: string) => Promise<void>;
    onClose: () => void;
};

const DebugOverlay: React.FC<DebugOverlayProps> = ({
    getEncryptedDatabaseBlob,
    setEncryptedDatabaseContent,
    onClose,
}) => {
    const handleFileChange = useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.readAsText(file, 'UTF-8');
            reader.onload = async (readerEvent) => {
                const content = readerEvent.target!.result as string;
                await setEncryptedDatabaseContent(content);
                onClose();
                window.location.reload();
            };
        },
        [setEncryptedDatabaseContent, onClose],
    );

    const handleBackup = useCallback(async () => {
        const blob = await getEncryptedDatabaseBlob();
        const tmpA = document.createElement('a');
        tmpA.href = window.URL.createObjectURL(blob);
        tmpA.download = `${serverTime()}-whisper-encrypted.json`;
        tmpA.click();
        tmpA.remove();
    }, [getEncryptedDatabaseBlob]);

    return (
        <div className='debug-overlay'>
            <button
                className='close-btn'
                onClick={onClose}
                aria-label='Close'
            >
                &times;
            </button>
            <div className='button-group'>
                <label className='file-upload-label'>
                    Restore
                    <input
                        type='file'
                        onChange={handleFileChange}
                    />
                </label>
                <button
                    className='action'
                    onClick={handleBackup}
                >
                    Backup
                </button>
            </div>
        </div>
    );
};

export default DebugOverlay;
