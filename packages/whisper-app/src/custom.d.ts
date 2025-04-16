declare namespace App {
    type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

declare namespace NodeJS {
    interface ProcessEnv {
        CONSOLE_LOG_LEVEL: App.LogLevel;
        DOCUMENT_LOG_LEVEL: App.LogLevel;
        BUILD_TIMESTAMP: string;
        SERVER_URL: string;
        FRONTEND_URL: string;
        VAPID_KEY: string;
    }
}
