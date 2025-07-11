declare namespace App {
    type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

declare namespace NodeJS {
    interface ProcessEnv {
        WHISPER_CONSOLE_LOG_LEVEL: App.LogLevel;
        WHISPER_DOCUMENT_LOG_LEVEL: App.LogLevel;
        WHISPER_BUILD_TIMESTAMP: string;
        WHISPER_SERVER_URL: string;
        WHISPER_CLIENT_URL: string;
        WHISPER_VAPID_KEY: string;
    }
}
