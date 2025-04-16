import { ReplyToMessageType } from '../../../../types/replyToMessageType';
import './ChatInput.css';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

type ChatInputProps = {
    sendAction: (type: 'typing') => Promise<void>;
    sendText: (text: string) => Promise<void>;
    replyTo?: ReplyToMessageType & { scrollToReply: () => void };
    resetReplyTo?: () => void;
};

const ChatInput: React.FC<ChatInputProps> = ({ sendAction, sendText, replyTo, resetReplyTo }) => {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const adjustMessageInputHeightVariable = () => {
            if (ref.current) {
                const height = ref.current.offsetHeight;
                requestAnimationFrame(() => {
                    document.documentElement.style.setProperty('--message-input-height', `${height}px`);
                });
            }
        };
        adjustMessageInputHeightVariable();
        const resizeObserver = new ResizeObserver(() => {
            adjustMessageInputHeightVariable();
        });
        if (ref.current) {
            resizeObserver.observe(ref.current);
        }
        return () => {
            resizeObserver.disconnect();
        };
    }, [replyTo]);
    const [input, setInput] = useState('');
    const sendTextCallback = useCallback(() => {
        const value = input.trim();
        if (value) {
            setInput('');
            sendText(value).catch(console.error);
        }
    }, [input, sendText]);

    return (
        <div
            ref={ref}
            className='message-input'
        >
            {replyTo !== undefined && replyTo !== null && (
                <div className='reply-to'>
                    <span
                        className='icon'
                        onClick={replyTo.scrollToReply}
                    >
                        ↪
                    </span>
                    <p
                        className={replyTo.sender}
                        onClick={replyTo.scrollToReply}
                    >
                        {replyTo.text}
                    </p>
                    <span
                        className='icon reset'
                        onClick={resetReplyTo}
                    >
                        ×
                    </span>
                </div>
            )}
            <div className='typing-area'>
                <input
                    type='text'
                    placeholder='Enter message'
                    value={input}
                    onChange={(event) => {
                        setInput(event.target.value);
                        sendAction('typing').catch(console.error);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            sendTextCallback();
                        }
                    }}
                />
                <button onClick={sendTextCallback}>Send</button>
            </div>
        </div>
    );
};

export default ChatInput;
