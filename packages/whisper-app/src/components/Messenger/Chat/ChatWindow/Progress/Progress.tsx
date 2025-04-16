import AnimatedDots from '../../../../AnimatedDots';
import './Progress.css';
import React from 'react';

type ProgressProps = {
    visible: boolean;
    title: string;
    value: number | undefined;
};

const Progress: React.FC<ProgressProps> = ({ visible, title, value }) => {
    return (
        visible && (
            <div className='progress'>
                <span>{`${title} ${value}% `}</span>
                <AnimatedDots />
            </div>
        )
    );
};

export default Progress;
