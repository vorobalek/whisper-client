import { ConnectionCallbacks } from '../../../hooks/useConnectionCallbacksCache';
import './Chat.css';
import ChatInput from './ChatInput';
import ChatWindow from './ChatWindow/ChatWindow';
import { useChat } from './useChat';
import React from 'react';

type ChatProps = {
    active: boolean;
    visible: boolean;
    name: string | undefined;
    callbacks: ConnectionCallbacks;
};

const Chat: React.FC<ChatProps> = ({ active, visible, callbacks }) => {
    const { typing, messages, send, replyTo } = useChat({
        callbacks,
    });

    return (
        visible && (
            <div className={active ? 'chat active' : 'chat hidden'}>
                <ChatWindow
                    messages={messages}
                    showTyping={typing}
                    setOnProgress={callbacks.events.setOnProgress}
                    sendReaction={send.reaction}
                    sendSeen={send.seen}
                    setReplyTo={replyTo.set}
                />
                <ChatInput
                    sendAction={send.action}
                    sendText={send.text}
                    replyTo={replyTo.value}
                    resetReplyTo={replyTo.reset}
                />
            </div>
        )
    );
};

export default Chat;
