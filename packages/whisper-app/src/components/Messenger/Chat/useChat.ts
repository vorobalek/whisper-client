import { ConnectionCallbacks } from '../../../hooks/useConnectionCallbacksCache';
import { ActionType } from '../../../types/actionType';
import { DeliveredType } from '../../../types/deliveredType';
import { MessageType } from '../../../types/messageType';
import { ReactionType } from '../../../types/reactionType';
import { ReplyToMessageType } from '../../../types/replyToMessageType';
import { SeenType } from '../../../types/seenType';
import { UpdateType } from '../../../types/updateType';
import { formatTimestampDate, now, serverTime, showNotification } from '../../../utils/functions';
import { ChatWindowMessageType } from './ChatWindow';
import { ConnectionState } from '@whisper/core';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ChatHook = {
    typing: boolean;
    messages: Array<ChatWindowMessageType>;
    send: {
        action: (type: 'typing') => Promise<void>;
        text: (input: string) => Promise<void>;
        reaction: (id: number, reaction: string) => Promise<void>;
        seen: (id: number) => Promise<void>;
    };
    replyTo: {
        value?: ReplyToMessageType & {
            scrollToReply: () => void;
        };
        set: (id: number, sender: 'you' | 'peer', text: string, scrollToReply: () => void) => void;
        reset: () => void;
    };
};

type ChatHookProps = {
    callbacks: ConnectionCallbacks;
};

export function useChat({
    callbacks: {
        lifecycle: { open: openConnection },
        view: { setUnread: setUnread, setOrder: setOrder },
        messaging: {
            send: sendMessage,
            cache: { get: getCache, set: saveCache },
            history: { get: getHistory, set: saveHistory },
        },
        events: { setOnStateChanged: setOnStateChanged, setOnMessage: setOnMessage },
    },
}: ChatHookProps): ChatHook {
    const shownMessageNotificationsRef = useRef<Set<number>>(new Set<number>());
    const usefulUpdatesRef = useRef<Map<number, UpdateType>>(new Map());
    const [messages, _setMessages] = useState<Array<ChatWindowMessageType>>([]);
    const [hasBeenOpened, setHasBeenOpened] = useState<boolean>(false);
    const [hasBeenClosed, setHasBeenClosed] = useState<boolean>(false);
    const [typing, setTyping] = useState(false);
    const [inputReplyTo, setInputReplyTo] = useState<ReplyToMessageType & { scrollToReply: () => void }>();

    const _addDailyMarks = useCallback((values: Array<ChatWindowMessageType>) => {
        function addDailyMarkIfNeeded(timestamp: number) {
            const localTimestamp = new Date(timestamp + delta).setHours(0, 0, 0, 0);
            if (lastDate === undefined || lastDate !== localTimestamp) {
                lastDate = localTimestamp;
                const timestamp = localTimestamp - delta;
                newValues.push({
                    id: timestamp,
                    timestamp,
                    sender: 'date',
                    blur: false,
                    text: formatTimestampDate(localTimestamp),
                });
            }
        }
        let newValues: Array<ChatWindowMessageType> = [];
        let lastDate: number | undefined = undefined;
        const delta = now() - serverTime();
        for (const value of values.filter((e) => e.sender !== 'date')) {
            addDailyMarkIfNeeded(value.timestamp);
            newValues.push(value);
        }
        addDailyMarkIfNeeded(now());
        return newValues;
    }, []);

    const setMessages = useCallback(
        (
            arg: Array<ChatWindowMessageType> | ((value: Array<ChatWindowMessageType>) => Array<ChatWindowMessageType>),
        ) => {
            if (typeof arg === 'function') {
                _setMessages((prevMessages) => arg(_addDailyMarks(prevMessages)));
            } else {
                _setMessages(_addDailyMarks(arg));
            }
        },
        [],
    );

    useEffect(() => {
        setUnread(messages.filter((e) => e.sender === 'peer' && e.seen === undefined).length);
    }, [setUnread, messages]);

    const displayTypingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const displayTyping = useCallback((show: boolean) => {
        setTyping(show);
        if (show) {
            const unset = () => {
                setTyping(false);
            };
            clearTimeout(displayTypingTimeoutRef.current);
            displayTypingTimeoutRef.current = setTimeout(unset, 5000);
        }
        return () => {
            clearTimeout(displayTypingTimeoutRef.current);
        };
    }, []);

    const displayMessage = useCallback((id: number, sender: 'you' | 'peer' | 'system', message: MessageType) => {
        const newMessage: ChatWindowMessageType = {
            id,
            sender,
            blur: false,
            ...message,
        };
        setMessages((prevMessages) =>
            [...prevMessages, newMessage]
                .filter((message, index, array) => {
                    return (
                        array.findIndex((e) => {
                            return e.id === message.id && e.sender === message.sender;
                        }) === index
                    );
                })
                .sort((a, b) => {
                    function getKey(message: { timestamp: number; sender: 'you' | 'peer' | 'system' | 'date' }) {
                        switch (message.sender) {
                            case 'system':
                            case 'date':
                                return message.timestamp * 10;
                            case 'you':
                                return message.timestamp * 10 + 1;
                            case 'peer':
                                return message.timestamp * 10 + 2;
                        }
                    }
                    const keyA = getKey(a);
                    const keyB = getKey(b);
                    return keyA == keyB ? 0 : keyA < keyB ? -1 : 1;
                }),
        );
        if (sender === 'peer' && !shownMessageNotificationsRef.current.has(id)) {
            shownMessageNotificationsRef.current.add(id);
            if (document.hidden) {
                showNotification('New message!', { body: message.text });
            }
        }
    }, []);

    useEffect(() => {
        getHistory()
            .then((history) => {
                for (const message of history) {
                    shownMessageNotificationsRef.current.add(message.id);
                }
                setMessages(history);
            })
            .catch(console.error);
    }, [getHistory]);

    useEffect(() => {
        saveHistory(messages.filter((e) => e.sender !== 'system' && e.sender !== 'date')).catch(console.error);
    }, [messages]);

    useEffect(() => {
        getCache().then(async (updates) => {
            for (const update of updates) {
                usefulUpdatesRef.current.set(update.id, update);
            }
            await saveCache([...usefulUpdatesRef.current.values()]);
        });
    }, [getCache, saveCache]);

    const saveUsefulUpdate = useCallback(
        async (update: UpdateType) => {
            let changed = false;
            const stored = usefulUpdatesRef.current.get(update.id);
            if (stored !== undefined && stored !== null) {
                if (update.message !== undefined && update.message !== null) {
                    if (
                        stored.message === undefined ||
                        stored.message === null ||
                        stored.message.timestamp < update.message.timestamp
                    ) {
                        usefulUpdatesRef.current.set(update.id, {
                            ...stored,
                            message: update.message,
                        });
                        changed = true;
                    }
                }
                if (update.delivered !== undefined && update.delivered !== null) {
                    if (
                        stored.delivered === undefined ||
                        stored.delivered === null ||
                        stored.delivered.timestamp > update.delivered.timestamp
                    ) {
                        usefulUpdatesRef.current.set(update.id, {
                            ...stored,
                            delivered: update.delivered,
                        });
                        changed = true;
                    }
                }
                if (update.seen !== undefined && update.seen !== null) {
                    if (
                        stored.seen === undefined ||
                        stored.seen === null ||
                        stored.seen.timestamp > update.seen.timestamp
                    ) {
                        usefulUpdatesRef.current.set(update.id, {
                            ...stored,
                            seen: update.seen,
                        });
                        changed = true;
                    }
                }
                if (update.reaction !== undefined && update.reaction !== null) {
                    if (
                        stored.reaction === undefined ||
                        stored.reaction === null ||
                        stored.reaction.timestamp < update.reaction.timestamp
                    ) {
                        usefulUpdatesRef.current.set(update.id, {
                            ...stored,
                            reaction: update.reaction,
                        });
                        changed = true;
                    }
                }
            } else {
                if (
                    (update.action === undefined || update.action === null) &&
                    ((update.message !== undefined && update.message !== null) ||
                        (update.delivered !== undefined && update.delivered !== null) ||
                        (update.seen !== undefined && update.seen !== null) ||
                        (update.reaction !== undefined && update.reaction !== null))
                ) {
                    usefulUpdatesRef.current.set(update.id, update);
                    changed = true;
                }
            }
            if (changed) {
                await saveCache([...usefulUpdatesRef.current.values()]);
            }
        },
        [saveCache],
    );

    const sendUpdate = useCallback(
        async (update: UpdateType) => {
            await saveUsefulUpdate(update);
            sendMessage(JSON.stringify(update));
        },
        [saveUsefulUpdate, sendMessage],
    );

    const sendAction = useCallback(
        async (action: ActionType) => {
            const now = serverTime();
            await sendUpdate({ id: now, action });
        },
        [sendUpdate],
    );

    const sendText = useCallback(
        async (input: string) => {
            const now = serverTime();
            await sendUpdate({
                id: now,
                message: {
                    timestamp: now,
                    text: input,
                    reply_to:
                        inputReplyTo !== undefined && inputReplyTo !== null
                            ? {
                                  id: inputReplyTo.id,
                                  sender: inputReplyTo.sender === 'you' ? 'peer' : 'you',
                                  text: inputReplyTo.text,
                              }
                            : undefined,
                },
            });
            displayMessage(now, 'you', {
                timestamp: now,
                text: input,
                reply_to: inputReplyTo,
            });
            setInputReplyTo(undefined);
            setOrder(now);
        },
        [sendUpdate, displayMessage, inputReplyTo, setOrder],
    );

    const setMessageDelivered = useCallback((id: number, delivered: DeliveredType, sender: 'you' | 'peer') => {
        setMessages((prevMessages) =>
            prevMessages.map((message) => {
                if (message.id === id && message.sender === sender) {
                    return {
                        ...message,
                        delivered: {
                            ...delivered,
                            timestamp:
                                message.delivered?.timestamp !== undefined && message.delivered.timestamp !== null
                                    ? message.delivered.timestamp > delivered.timestamp
                                        ? delivered.timestamp
                                        : message.delivered.timestamp
                                    : delivered.timestamp,
                        },
                    };
                } else {
                    return message;
                }
            }),
        );
    }, []);

    const sendDelivered = useCallback(
        async (id: number) => {
            const now = serverTime();
            setMessageDelivered(id, { timestamp: now }, 'peer');
            await sendUpdate({
                id,
                delivered: {
                    timestamp: now,
                },
            });
        },
        [sendUpdate, setMessageDelivered],
    );

    const setMessageSeen = useCallback((id: number, seen: SeenType, sender: 'you' | 'peer') => {
        setMessages((prevMessages) =>
            prevMessages.map((message) => {
                if (message.id === id && message.sender === sender) {
                    return {
                        ...message,
                        seen: {
                            ...seen,
                            timestamp:
                                message.seen?.timestamp !== undefined && message.seen.timestamp !== null
                                    ? message.seen.timestamp > seen.timestamp
                                        ? seen.timestamp
                                        : message.seen.timestamp
                                    : seen.timestamp,
                        },
                    };
                } else {
                    return message;
                }
            }),
        );
    }, []);

    const sendSeen = useCallback(
        async (id: number) => {
            const now = serverTime();
            setMessageSeen(id, { timestamp: now }, 'peer');
            await sendUpdate({
                id,
                seen: {
                    timestamp: now,
                },
            });
        },
        [sendUpdate, setMessageSeen],
    );

    const setMessageReaction = useCallback((id: number, sender: 'you' | 'peer', reaction: ReactionType) => {
        setMessages((prevMessages) =>
            prevMessages.map((message) => {
                if (message.id === id && message.sender === sender) {
                    return {
                        ...message,
                        reaction:
                            message.reaction?.timestamp !== undefined && message.reaction.timestamp !== null
                                ? reaction.timestamp > message.reaction.timestamp
                                    ? reaction
                                    : message.reaction
                                : reaction,
                    };
                } else {
                    return message;
                }
            }),
        );
    }, []);

    const sendReaction = useCallback(
        async (id: number, reaction: string) => {
            const now = serverTime();
            await sendUpdate({
                id,
                reaction: {
                    timestamp: now,
                    value: reaction,
                },
            });
            setMessageReaction(id, 'peer', {
                timestamp: now,
                value: reaction,
            });
        },
        [sendUpdate, setMessageReaction],
    );

    const resendCached = useCallback(async () => {
        const cache = await getCache();
        for (const update of cache) {
            await sendUpdate(update);
        }
    }, [sendUpdate]);

    const setReplyTo = useCallback(
        (id: number, sender: 'you' | 'peer', text: string, scrollToReply: () => void) => {
            if (inputReplyTo?.id !== id || inputReplyTo?.sender !== sender) {
                setInputReplyTo({ id, sender, text, scrollToReply });
            }
        },
        [inputReplyTo],
    );

    const resetReplyTo = useCallback(() => {
        setInputReplyTo(undefined);
    }, [inputReplyTo]);

    const onStateChanged = useCallback(
        (_: ConnectionState, to: ConnectionState) => {
            const id = serverTime();
            if (to === ConnectionState.Open) {
                resendCached().catch(console.error);
                if (!hasBeenOpened) {
                    setHasBeenOpened(true);
                    setHasBeenClosed(false);
                    displayMessage(id, 'system', {
                        timestamp: id,
                        text: '🚀 Connection opened.',
                    });
                }
            } else if (to === ConnectionState.Closed) {
                displayTyping(false);
                setMessages((prevMessages) =>
                    prevMessages.map((message) =>
                        message.sender !== 'system'
                            ? {
                                  ...message,
                                  blur: true,
                              }
                            : message,
                    ),
                );
                shownMessageNotificationsRef.current.clear();
                usefulUpdatesRef.current.clear();
                if (!hasBeenClosed) {
                    displayMessage(id, 'system', {
                        timestamp: id,
                        text: '⛔️ Connection closed.',
                    });
                    setHasBeenClosed(true);
                    setHasBeenOpened(false);
                }
            }
        },
        [resendCached, hasBeenOpened, displayMessage, displayTyping, hasBeenClosed],
    );

    const onMessage = useCallback(
        (value: string) => {
            const update: UpdateType = JSON.parse(value);
            if (update.action !== undefined && update.action !== null) {
                switch (update.action) {
                    case 'typing':
                        displayTyping(true);
                        break;
                }
            }
            if (update.message !== undefined && update.message !== null) {
                displayTyping(false);
                displayMessage(update.id, 'peer', update.message);
                sendDelivered(update.id).catch(console.error);
                setOrder(update.id);
            }
            if (update.delivered !== undefined && update.delivered !== null) {
                setMessageDelivered(update.id, update.delivered, 'you');
            }
            if (update.seen !== undefined && update.seen !== null) {
                setMessageSeen(update.id, update.seen, 'you');
            }
            if (update.reaction !== undefined && update.reaction !== null) {
                setMessageReaction(update.id, 'you', update.reaction);
            }
        },
        [
            displayTyping,
            displayMessage,
            sendDelivered,
            setOrder,
            setMessageDelivered,
            setMessageSeen,
            setMessageReaction,
        ],
    );

    const [firstUndeliveredMessageTimestamp, setFirstUndeliveredMessageTimestamp] = useState<number | undefined>();

    useEffect(() => {
        setFirstUndeliveredMessageTimestamp(
            messages.find((e) => e.sender === 'you' && (e.delivered === undefined || e.delivered === null))?.timestamp,
        );
    }, [messages]);

    useEffect(() => {
        let timeout: NodeJS.Timeout | undefined;
        const job = (retryCount: number) => async () => {
            const timestamp = serverTime();
            if (
                firstUndeliveredMessageTimestamp !== undefined &&
                firstUndeliveredMessageTimestamp !== null &&
                timestamp > firstUndeliveredMessageTimestamp
            ) {
                if (timestamp - firstUndeliveredMessageTimestamp >= 5 * 1000) {
                    console.warn(`Reconnecting, try #${retryCount + 1}... (Retry after 30 seconds).`);
                    timeout = setTimeout(job(retryCount + 1), 30 * 1000);
                    await openConnection();
                } else {
                    await new Promise<void>((resolve) => {
                        console.warn(`Reconnecting after 5 seconds.`);
                        timeout = setTimeout(async () => {
                            await job(retryCount)();
                            resolve();
                        }, 5 * 1000);
                    });
                }
            }
        };
        const clear = () => {
            clearTimeout(timeout);
        };
        job(0)().then(clear).catch(console.error);
        return clear;
    }, [firstUndeliveredMessageTimestamp, openConnection]);

    useEffect(() => {
        setOnStateChanged(onStateChanged);
    }, [setOnStateChanged, onStateChanged]);

    useEffect(() => {
        setOnMessage(onMessage);
    }, [setOnMessage, onMessage]);

    return {
        typing: typing,
        messages,
        send: {
            action: sendAction,
            text: sendText,
            reaction: sendReaction,
            seen: sendSeen,
        },
        replyTo: {
            value: inputReplyTo,
            set: setReplyTo,
            reset: resetReplyTo,
        },
    };
}
