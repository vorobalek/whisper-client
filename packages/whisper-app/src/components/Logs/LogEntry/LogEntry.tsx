import './LogEntry.css';
import React from 'react';

import LogLevel = App.LogLevel;

export type LogEntryProps = {
    timestamp: number;
    level: LogLevel;
    content: string;
};

const LogEntry: React.FC<LogEntryProps> = ({ timestamp, level, content }) => {
    return (
        <div>
            <pre>
                <span className='time'>{new Date(timestamp).toISOString()}</span>
                <span className={level}>{`\n${content}`}</span>
            </pre>
        </div>
    );
};

export default LogEntry;
