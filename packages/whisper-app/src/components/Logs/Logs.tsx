import { now } from '../../utils/functions';
import LogEntry, { LogEntryProps } from './LogEntry/LogEntry';
import './Logs.css';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

type LogsProps = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    entries: Array<LogEntryProps>;
};

const Logs: React.FC<LogsProps> = ({ visible, setVisible, entries }) => {
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number | null>(null);
    const [localEntries, setLocalEntries] = useState<LogEntryProps[]>([]);

    useLayoutEffect(() => {
        if (ref.current && visible && (entries.length > 0 || localEntries.length > 0)) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    }, [visible, entries, localEntries]);

    useLayoutEffect(() => {
        if (visible && inputRef.current) {
            inputRef.current.focus();
        }
    }, [visible]);

    const toggleBtnOnClick = useCallback(() => {
        setVisible(!visible);
    }, [setVisible, visible]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            handleExec();
        } else if (e.key === 'ArrowUp') {
            if (history.length > 0) {
                e.preventDefault();
                const idx = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
                setInput(history[idx]);
                setHistoryIndex(idx);
            }
        } else if (e.key === 'ArrowDown') {
            if (history.length > 0 && historyIndex !== null) {
                e.preventDefault();
                const idx = historyIndex < history.length - 1 ? historyIndex + 1 : history.length - 1;
                setInput(history[idx]);
                setHistoryIndex(idx);
            }
        }
    };

    const handleExec = () => {
        const code = input.trim();
        if (!code) return;
        const timestamp = now();
        setLocalEntries((prev) => [...prev, { timestamp, level: 'info', content: `> ${code}` }]);
        setHistory((prev) => [...prev, code]);
        setHistoryIndex(null);
        setInput('');
        try {
            // eslint-disable-next-line no-eval
            const result = eval(code);
            setLocalEntries((prev) => [...prev, { timestamp: now(), level: 'debug', content: String(result) }]);
        } catch (err: any) {
            setLocalEntries((prev) => [...prev, { timestamp: now(), level: 'error', content: String(err) }]);
        }
    };

    // Auto-resize textarea
    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
        }
    }, [input]);

    return (
        <>
            {visible && (
                <div className='log-wrapper'>
                    <button
                        className='close-btn'
                        onClick={() => setVisible(false)}
                        aria-label='Close'
                    >
                        &times;
                    </button>
                    <div
                        ref={ref}
                        className='log-container'
                    >
                        {[...entries, ...localEntries]
                            .sort((a, b) => a.timestamp - b.timestamp)
                            .map((entry, index) => (
                                <LogEntry
                                    key={index}
                                    timestamp={entry.timestamp}
                                    level={entry.level}
                                    content={entry.content}
                                />
                            ))}
                    </div>
                    <div className='console-input-wrapper'>
                        <textarea
                            ref={inputRef}
                            className='console-input'
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={'Type JS code...'}
                            rows={1}
                            spellCheck={false}
                            autoCorrect='off'
                            autoCapitalize='off'
                        />
                        <button
                            className='console-exec-btn'
                            onClick={handleExec}
                        >
                            Exec
                        </button>
                    </div>
                </div>
            )}
            {visible === false && (
                <span
                    className='toggle-log-btn'
                    onClick={toggleBtnOnClick}
                >
                    &gt;_
                </span>
            )}
        </>
    );
};

export default Logs;
