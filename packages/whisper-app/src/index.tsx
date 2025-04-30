import App from './App';
import { Whisper } from '@whisper/core';
import React from 'react';
import ReactDOM from 'react-dom/client';

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        whisper: Whisper & {
            __debug?: () => void;
        };
    }
}

const rootElement = document.getElementById('root');

if (rootElement) {
    const root = ReactDOM.createRoot(rootElement as HTMLElement);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
} else {
    console.error('Unable to locate element with id "root"');
}
