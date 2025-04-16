import AnimatedDots from '../../../../../AnimatedDots';
import './../Action.css';
import './Typing.css';
import React from 'react';

type TypingProps = {
    visible: boolean;
};

const Typing: React.FC<TypingProps> = ({ visible }) => {
    return (
        visible && (
            <div className='action typing'>
                <AnimatedDots />
            </div>
        )
    );
};

export default Typing;
