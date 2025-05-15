import { DeliveredType } from '../../../../types/deliveredType';
import { MessageType } from '../../../../types/messageType';
import { ReactionType } from '../../../../types/reactionType';
import { SeenType } from '../../../../types/seenType';
import Typing from './Action/Typing';
import './ChatWindow.css';
import Message from './Message';
import Progress from './Progress/Progress';
import { animated, useSpring } from '@react-spring/web';
import { useScroll } from '@use-gesture/react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type ChatWindowMessageType = {
    id: number;
    sender: 'you' | 'peer' | 'system' | 'date';
    blur: boolean;
    delivered?: DeliveredType;
    seen?: SeenType;
    reaction?: ReactionType;
} & MessageType;

type ChatWindowProps = {
    messages: Array<ChatWindowMessageType>;
    showTyping: boolean;
    setOnProgress: (onProgress: (progress: number) => void) => void;
    sendSeen: (id: number) => Promise<void>;
    sendReaction: (id: number, reaction: string) => Promise<void>;
    setReplyTo: (id: number, sender: 'you' | 'peer', text: string, scrollToReply: () => void) => void;
};

const ChatWindow: React.FC<ChatWindowProps> = ({
    messages,
    showTyping,
    setOnProgress,
    sendSeen,
    sendReaction,
    setReplyTo,
}) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const windowRef = useRef<HTMLDivElement>(null);
    const [progress, setProgress] = useState<number | undefined>();
    const messageDivRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    useLayoutEffect(() => {
        const scrollToTop = () => {
            if (windowRef.current) {
                windowRef.current.scrollTop = windowRef.current.scrollHeight;
            }
        };
        scrollToTop();
        const resizeObserver = new ResizeObserver(() => {
            scrollToTop();
        });
        if (wrapperRef.current) {
            resizeObserver.observe(wrapperRef.current);
        }
        return () => {
            resizeObserver.disconnect();
        };
    }, [progress, messages.length, showTyping]);
    useEffect(() => {
        setOnProgress((value) => {
            setProgress(value);
        });
    }, [setOnProgress]);
    const getScrollToMessage = (id: number, sender: 'you' | 'peer') => {
        return () => {
            const messageElement = messageDivRefs.current.get(`${id}-${sender}`);
            if (messageElement && windowRef.current) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
    };
    const [{ paddingTop, paddingBottom, height, width }, api] = useSpring(() => ({
        paddingTop: '0px',
        paddingBottom: '0px',
        height: '0px',
        width: '0%',
    }));
    useScroll(
        ({ xy: [, y] }) => {
            if (windowRef.current?.scrollHeight !== undefined && windowRef.current?.offsetHeight !== undefined) {
                const delta = windowRef.current.scrollHeight - windowRef.current.offsetHeight;
                const width = Math.round((1 - Math.max(0, Math.min(1, y / delta))) * 100);
                if (delta > 0) {
                    api.start({
                        paddingTop: width > 0 ? '5px' : '0px',
                        paddingBottom: width > 0 ? '5px' : '0px',
                        height: width > 0 ? '15px' : '0px',
                        width: width + '%',
                    });
                } else {
                    api.start({ paddingTop: '0px', paddingBottom: '0px', height: '0', width: '0' });
                }
            }
        },
        {
            target: windowRef,
            eventOptions: { passive: true },
        },
    );
    return (
        <div
            ref={wrapperRef}
            className='chat-window-wrapper'
        >
            <animated.div
                className='scroll'
                style={{ paddingTop, paddingBottom, height }}
            >
                <animated.div
                    className='scroll-progress'
                    style={{ width }}
                />
            </animated.div>
            <div
                ref={windowRef}
                className='chat-window'
            >
                <div className='messages'>
                    {messages.map((message) => {
                        return (
                            <Message
                                ref={(el) => messageDivRefs.current.set(`${message.timestamp}-${message.sender}`, el)}
                                key={
                                    message.id * 10 +
                                    (message.sender === 'system' ? 0 : message.sender === 'you' ? 1 : 2)
                                }
                                id={message.id}
                                sender={message.sender}
                                timestamp={message.timestamp}
                                text={message.text}
                                delivered={message.delivered}
                                seen={message.seen}
                                reaction={message.reaction}
                                replyToMessage={message.reply_to}
                                blur={message.blur}
                                sendSeen={sendSeen}
                                sendReaction={sendReaction}
                                setReplyTo={setReplyTo}
                                scrollTo={
                                    message.sender === 'you' || message.sender === 'peer'
                                        ? getScrollToMessage(message.id, message.sender)
                                        : () => {}
                                }
                                scrollToReply={
                                    message.reply_to !== undefined && message.reply_to !== null
                                        ? getScrollToMessage(message.reply_to.id, message.reply_to.sender)
                                        : () => {}
                                }
                            />
                        );
                    })}
                </div>
                <Typing visible={showTyping} />
                <Progress
                    visible={progress !== undefined && progress !== null && 0 < progress && progress < 100}
                    title={'🛰️ Connecting'}
                    value={progress}
                />
            </div>
        </div>
    );
};

export default ChatWindow;
