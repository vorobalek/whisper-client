import React, { useState, useEffect } from 'react';

const AnimatedDots: React.FC = () => {
    const [dots, setDots] = useState('.');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots((prevDots) => {
                return prevDots.length < 3 ? prevDots + '.' : '.';
            });
        }, 500);

        return () => clearInterval(interval);
    }, []);

    return <span>{dots}</span>;
};

export default AnimatedDots;
