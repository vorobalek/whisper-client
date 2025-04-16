import './PermissionOverlay.css';
import React, { MouseEventHandler } from 'react';

type PermissionOverlayProps = {
    onClick?: MouseEventHandler<HTMLButtonElement>;
};

const PermissionOverlay: React.FC<PermissionOverlayProps> = ({ onClick }) => {
    return (
        <div className='permission-overlay'>
            <pre>To ensure the application functions properly, it's necessary to allow notifications.</pre>
            <button onClick={onClick}>Allow Notifications</button>
        </div>
    );
};

export default PermissionOverlay;
