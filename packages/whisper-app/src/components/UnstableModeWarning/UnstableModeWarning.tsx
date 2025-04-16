import './UnstableModeWarning.css';
import React, { useLayoutEffect, useRef } from 'react';

type UnstableModeWarningProps = {
    visible: boolean;
    reason: string | undefined;
};

const UnstableModeWarning: React.FC<UnstableModeWarningProps> = ({ visible, reason }) => {
    const ref = useRef<HTMLPreElement>(null);

    useLayoutEffect(() => {
        const adjustUnstableModeWarningHeightVariable = () => {
            if (ref.current) {
                const height = ref.current.offsetHeight;
                document.documentElement.style.setProperty('--unstable-mode-warning-height', `${height}px`);
            } else {
                document.documentElement.style.setProperty('--unstable-mode-warning-height', '0px');
            }
        };
        if (visible && ref.current) {
            adjustUnstableModeWarningHeightVariable();
            const resizeObserver = new ResizeObserver(() => {
                adjustUnstableModeWarningHeightVariable();
            });
            resizeObserver.observe(ref.current);
            return () => {
                resizeObserver.disconnect();
            };
        } else {
            document.documentElement.style.setProperty('--unstable-mode-warning-height', '0px');
        }
    }, [visible, reason]);

    if (!visible) {
        return null;
    }

    return (
        <pre
            ref={ref}
            className='unstable-mode-warning'
        >
            {reason}
        </pre>
    );
};

export default UnstableModeWarning;
