import { DeliveredType } from '../../../../../types/deliveredType';
import { ReactionType } from '../../../../../types/reactionType';
import { ReplyToMessageType } from '../../../../../types/replyToMessageType';
import { SeenType } from '../../../../../types/seenType';
import { formatTimestampLong, formatTimestampShort, now, serverTime } from '../../../../../utils/functions';
import './Message.css';
import ReactionMenu from './ReactionMenu';
import { mdiLoading, mdiCheck, mdiCheckAll, mdiEmoticonOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag, useWheel } from '@use-gesture/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type MessageProps = {
    id: number;
    sender: 'you' | 'peer' | 'system' | 'date';
    timestamp: number;
    text: string;
    delivered?: DeliveredType;
    seen?: SeenType;
    reaction?: ReactionType;
    replyToMessage?: { text: string } & ReplyToMessageType;
    blur: boolean;
    sendSeen: (id: number) => Promise<void>;
    sendReaction: (id: number, reaction: string) => Promise<void>;
    setReplyTo: (id: number, sender: 'you' | 'peer', text: string, scrollToReply: () => void) => void;
    scrollTo: () => void;
    scrollToReply: () => void;
};

const Message = React.forwardRef<HTMLDivElement, MessageProps>(
    (
        {
            id,
            sender,
            timestamp,
            text,
            delivered,
            seen,
            reaction,
            replyToMessage,
            blur,
            sendSeen,
            sendReaction,
            setReplyTo,
            scrollTo,
            scrollToReply,
        },
        ref,
    ) => {
        const topMarkerRef = useRef<HTMLDivElement>(null);
        const bottomMarkerRef = useRef<HTMLDivElement>(null);
        const seenRef = useRef<boolean>(seen !== undefined && seen !== null);
        const topSeenRef = useRef<boolean>(false);
        const bottomSeenRef = useRef<boolean>(false);
        const divRef = useRef<HTMLDivElement>(null);
        const [showReactionMenu, setShowReactionMenu] = useState(false);
        const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

        const handleReactionClick = useCallback(
            (event: React.MouseEvent) => {
                event.stopPropagation();
                if (sender === 'peer') {
                    const target = event.currentTarget;
                    const rect = target.getBoundingClientRect();

                    const menuWidth = 250;

                    const EMOJI_COUNT = 15;
                    const EMOJI_PER_ROW = Math.floor(menuWidth / 40);
                    const ROWS = Math.ceil(EMOJI_COUNT / EMOJI_PER_ROW);
                    const EMOJI_HEIGHT = window.innerWidth <= 480 ? 32 : 36;
                    const ROW_GAP = 5;
                    const PADDING = 16;
                    const menuHeight = ROWS * EMOJI_HEIGHT + (ROWS - 1) * ROW_GAP + PADDING;

                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;

                    let posX = rect.left + rect.width / 2 - menuWidth / 2;
                    let posY = rect.top - menuHeight - 10;

                    const effectiveMenuWidth = Math.min(menuWidth, viewportWidth - 20);

                    if (posX < 10) {
                        posX = 10;
                    }

                    if (posX + effectiveMenuWidth > viewportWidth - 10) {
                        posX = viewportWidth - effectiveMenuWidth - 10;
                    }

                    if (posY < 10) {
                        posY = rect.bottom + 10;

                        if (posY + menuHeight > viewportHeight - 10) {
                            if (rect.top < viewportHeight / 2) {
                                posY = Math.min(rect.bottom + 10, viewportHeight - menuHeight - 10);
                            } else {
                                posY = Math.max(10, rect.top - menuHeight - 10);
                            }
                        }
                    }

                    setMenuPosition({
                        x: posX,
                        y: posY,
                    });
                    setShowReactionMenu(true);
                }
            },
            [sender],
        );

        useEffect(() => {
            if (sender === 'peer' && !seenRef.current) {
                const options = {
                    root: null,
                    rootMargin: '0px',
                    threshold: 0.1,
                };

                const topObserver = new IntersectionObserver((entries) => {
                    if (entries.length > 0 && entries[0].target === topMarkerRef.current && entries[0].isIntersecting) {
                        topSeenRef.current = true;
                        if (bottomSeenRef.current && !seenRef.current) {
                            sendSeen(id).catch(console.error);
                            seenRef.current = true;
                            topObserver.disconnect();
                            bottomObserver.disconnect();
                        }
                    }
                }, options);

                const bottomObserver = new IntersectionObserver((entries) => {
                    if (
                        entries.length > 0 &&
                        entries[0].target === bottomMarkerRef.current &&
                        entries[0].isIntersecting
                    ) {
                        bottomSeenRef.current = true;
                        if (topSeenRef.current && !seenRef.current) {
                            sendSeen(id).catch(console.error);
                            seenRef.current = true;
                            topObserver.disconnect();
                            bottomObserver.disconnect();
                        }
                    }
                }, options);

                if (!seenRef.current && topMarkerRef.current) {
                    topObserver.observe(topMarkerRef.current);
                }
                if (!seenRef.current && bottomMarkerRef.current) {
                    bottomObserver.observe(bottomMarkerRef.current);
                }

                return () => {
                    topObserver.disconnect();
                    bottomObserver.disconnect();
                };
            }
        }, [sender, id, sendSeen]);

        const SWIPE_THRESHOLD = 50;
        const [{ x }, api] = useSpring(() => ({ x: 0 }));
        const bind = useDrag(
            ({ down, movement: [mx, my], direction: [xDir], first, cancel, event }) => {
                if (first) {
                    if (Math.abs(my) > Math.abs(mx)) {
                        cancel();
                        return;
                    } else {
                        event.preventDefault();
                    }
                }

                const direction = xDir < 0 ? 'Left' : 'Right';
                const isSwipeYou = sender === 'you' && direction === 'Left';
                const isSwipePeer = sender === 'peer' && direction === 'Left';

                if (isSwipeYou || isSwipePeer) {
                    if (Math.abs(mx) > SWIPE_THRESHOLD) {
                        setReplyTo(timestamp, sender, text, scrollTo);
                        api.start({ x: 0, immediate: false });
                        cancel();
                    } else {
                        api.start({
                            x: down
                                ? sender === 'you'
                                    ? Math.max(mx, -SWIPE_THRESHOLD)
                                    : Math.min(mx, SWIPE_THRESHOLD)
                                : 0,
                            immediate: down,
                        });
                    }
                } else {
                    api.start({ x: 0, immediate: false });
                }
            },
            {
                axis: 'x',
            },
        );

        const WHEEL_THRESHOLD = 100;
        const wheelAccumRef = useRef<number>(0);
        const wheelInteractionAllowedRef = useRef<boolean>(true);
        useWheel(
            ({ delta: [dx, dy], event }) => {
                if (Math.abs(dx) < Math.abs(dy)) return;

                const direction = dx > 0 ? 'Left' : 'Right';
                const isSwipeYou = sender === 'you' && direction === 'Left';
                const isSwipePeer = sender === 'peer' && direction === 'Left';

                if (isSwipeYou || isSwipePeer) {
                    event.preventDefault();
                    if (wheelInteractionAllowedRef.current) {
                        wheelAccumRef.current += dx;
                        api.start({
                            x: -wheelAccumRef.current,
                            immediate: false,
                        });
                        if (Math.abs(wheelAccumRef.current) > WHEEL_THRESHOLD) {
                            setReplyTo(timestamp, sender, text, scrollTo);
                            wheelAccumRef.current = 0;
                            api.start({
                                x: 0,
                                immediate: false,
                            });
                            wheelInteractionAllowedRef.current = false;
                            setTimeout(() => {
                                wheelInteractionAllowedRef.current = true;
                            }, 1000);
                        }
                    }
                    setTimeout(() => {
                        wheelAccumRef.current = 0;
                        api.start({
                            x: 0,
                            immediate: false,
                        });
                    }, 500);
                } else {
                    api.start({
                        x: 0,
                        immediate: false,
                    });
                }
            },
            {
                target: divRef.current ?? undefined,
                eventOptions: { passive: false },
            },
        );

        const onDoubleClick = useCallback(() => {
            if (sender === 'peer') {
                if (reaction === undefined || reaction === null || reaction.value === '') {
                    sendReaction(id, '💜').catch(console.error);
                } else {
                    sendReaction(id, '').catch(console.error);
                }
            }
        }, [sender, reaction, sendReaction, id]);

        const delta = now() - serverTime();
        const messageTimestamp = timestamp + delta;
        const deliveredTimestamp = delivered?.timestamp ? delivered.timestamp + delta : undefined;
        const seenTimestamp = seen?.timestamp ? seen.timestamp + delta : undefined;
        const reactionTimestamp = reaction?.timestamp ? reaction.timestamp + delta : undefined;

        return (
            <>
                <animated.div
                    {...bind()}
                    style={{ x }}
                    ref={ref}
                    className={`message ${sender}${blur ? ' blur' : ''}`}
                    onDoubleClick={onDoubleClick}
                >
                    <div ref={divRef}>
                        <div
                            ref={topMarkerRef}
                            className='message-marker-top'
                        />
                        {replyToMessage !== undefined && replyToMessage !== null && (
                            <div
                                className='reply-to'
                                onClick={scrollToReply}
                            >
                                <span className='icon'>↪</span>
                                <p className={replyToMessage.sender}>{replyToMessage.text}</p>
                            </div>
                        )}
                        <div className='message-text'>{text}</div>
                        {sender !== 'system' && sender !== 'date' && (
                            <>
                                {reaction?.value !== undefined &&
                                reaction.value !== null &&
                                reaction.value !== '' &&
                                reactionTimestamp !== undefined &&
                                reactionTimestamp !== null ? (
                                    <span
                                        title={`Reacted ${formatTimestampLong(reactionTimestamp)}`}
                                        className='message-reaction'
                                        onClick={sender === 'peer' ? handleReactionClick : undefined}
                                    >
                                        {reaction.value}
                                    </span>
                                ) : (
                                    sender === 'peer' && (
                                        <span
                                            className='message-reaction-placeholder'
                                            onClick={handleReactionClick}
                                        >
                                            <Icon
                                                path={mdiEmoticonOutline}
                                                title='Add reaction'
                                                size='16px'
                                                color='var(--button-primary-bg-color)'
                                            />
                                        </span>
                                    )
                                )}
                                <span className='message-status'>
                                    <span
                                        title={`${sender === 'you' ? 'Sent' : 'Received'} ${formatTimestampLong(messageTimestamp)}`}
                                        className='message-time'
                                    >
                                        {formatTimestampShort(messageTimestamp)}
                                    </span>
                                    <div className='message-check'>
                                        {sender === 'you' &&
                                            (deliveredTimestamp ? (
                                                !seenTimestamp ? (
                                                    <Icon
                                                        path={mdiCheck}
                                                        title={`Delivered ${formatTimestampLong(deliveredTimestamp)}`}
                                                        size='14px'
                                                        color='var(--button-primary-bg-color)'
                                                    />
                                                ) : (
                                                    <Icon
                                                        path={mdiCheckAll}
                                                        title={`Delivered ${formatTimestampLong(deliveredTimestamp)}, Seen ${formatTimestampLong(seenTimestamp)}`}
                                                        size='14px'
                                                        color='var(--button-primary-bg-color)'
                                                    />
                                                )
                                            ) : (
                                                <Icon
                                                    path={mdiLoading}
                                                    title={`Undelivered`}
                                                    size='14px'
                                                    color='var(--button-primary-bg-color)'
                                                    spin
                                                />
                                            ))}
                                    </div>
                                </span>
                            </>
                        )}
                        <div
                            ref={bottomMarkerRef}
                            className='message-marker-bottom'
                        />
                    </div>
                </animated.div>
                {showReactionMenu && (
                    <ReactionMenu
                        x={menuPosition.x}
                        y={menuPosition.y}
                        selectedReaction={reaction?.value}
                        onSelect={(emoji) => {
                            const newReaction = emoji === reaction?.value ? '' : emoji;
                            sendReaction(id, newReaction).catch(console.error);
                        }}
                        onClose={() => setShowReactionMenu(false)}
                    />
                )}
            </>
        );
    },
);

export default Message;
