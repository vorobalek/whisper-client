import './Navbar.css';
import React, { MouseEventHandler } from 'react';

type NavbarProps = {
    title: string;
    unread?: number;
    onClick: MouseEventHandler<HTMLDivElement>;
};

const Navbar: React.FC<NavbarProps> = ({ title, onClick, unread }) => {
    return (
        <div
            className='navbar'
            onClick={onClick}
        >
            <h2>{title}</h2>
            {unread !== undefined && unread !== null && unread > 0 && <span className='unread-count'>{unread}</span>}
        </div>
    );
};

export default Navbar;
