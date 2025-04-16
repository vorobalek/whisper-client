export function showNotification(title: string, options?: NotificationOptions) {
    if (window.whisper !== undefined && window.whisper !== null) {
        window.whisper.showNotification(title, options);
    }
}
export function now() {
    return Date.now();
}
export function serverTime() {
    if (window.whisper !== undefined && window.whisper !== null) {
        return window.whisper.serverTime;
    }
    return Date.now();
}

export function formatTimestampDate(utcTimestamp: number) {
    if (String(utcTimestamp).length === 10) {
        utcTimestamp *= 1000;
    }

    const date = new Date(utcTimestamp);

    const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
    });

    return formatter.format(date);
}

export function formatTimestampLong(utcTimestamp: number) {
    if (String(utcTimestamp).length === 10) {
        utcTimestamp *= 1000;
    }

    const date = new Date(utcTimestamp);

    const formatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });

    return formatter.format(date);
}

export function formatTimestampShort(utcTimestamp: number) {
    if (String(utcTimestamp).length === 10) {
        utcTimestamp *= 1000;
    }

    const date = new Date(utcTimestamp);

    const formatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    return formatter.format(date);
}
