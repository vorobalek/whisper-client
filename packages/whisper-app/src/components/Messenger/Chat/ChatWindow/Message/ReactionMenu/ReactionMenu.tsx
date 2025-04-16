import './ReactionMenu.css';
import React, { useEffect, useRef } from 'react';

const EMOJI_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '💜', '🔥', '👏', '😍', '🎉', '😱', '👎', '💯', '🤔'];

type ReactionMenuProps = {
    x: number;
    y: number;
    selectedReaction?: string;
    onSelect: (reaction: string) => void;
    onClose: () => void;
};

const ReactionMenu: React.FC<ReactionMenuProps> = ({ x, y, selectedReaction, onSelect, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className='reaction-menu'
            style={{
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            {EMOJI_REACTIONS.map((emoji) => (
                <button
                    key={emoji}
                    className={`reaction-button ${emoji === selectedReaction ? 'selected' : ''}`}
                    onClick={() => {
                        onSelect(emoji);
                        if (emoji !== selectedReaction) {
                            onClose();
                        }
                    }}
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
};

export default ReactionMenu;
