import LogEntry, { LogEntryProps } from './LogEntry/LogEntry';
import './Logs.css';
import React, { useCallback, useLayoutEffect, useRef } from 'react';

type LogsProps = {
    visible: boolean;
    setVisible: (visible: boolean) => void;
    entries: Array<LogEntryProps>;
};

const Logs: React.FC<LogsProps> = ({ visible, setVisible, entries }) => {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        if (ref.current && visible && entries.length > 0) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    }, [visible, entries]);

    const toggleBtnOnClick = useCallback(() => {
        setVisible(!visible);
    }, [setVisible, visible]);

    return (
        <>
            {visible && (
                <div className='log-wrapper'>
                    <div
                        ref={ref}
                        className='log-container'
                    >
                        {entries.map((entry, index) => (
                            <LogEntry
                                key={index}
                                timestamp={entry.timestamp}
                                level={entry.level}
                                content={entry.content}
                            />
                        ))}
                    </div>
                </div>
            )}
            <span
                className='toggle-log-btn'
                onClick={toggleBtnOnClick}
            >
                &gt;_
            </span>
        </>
    );
};

export default Logs;
