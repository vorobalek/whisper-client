import './ConnectionTab.css';
import { mdiDeleteOutline, mdiPencil } from '@mdi/js';
import Icon from '@mdi/react';
import React from 'react';

type ConnectionTabProps = {
    id: number;
    publicKey: string;
    name: string | undefined;
    active: boolean;
    onEdit: () => void;
    onChoose: () => void;
    onDelete: () => void;
    unread: number;
};

const ConnectionTab: React.FC<ConnectionTabProps> = ({
    id,
    publicKey,
    name,
    active,
    onEdit,
    onChoose,
    onDelete,
    unread,
}) => {
    return (
        <div
            key={id}
            className={active ? 'connection-tab active' : 'connection-tab'}
        >
            <div
                onClick={onEdit}
                className='icon edit'
            >
                <Icon
                    path={mdiPencil}
                    size='18px'
                />
            </div>
            <span
                className='public-key'
                onClick={onChoose}
            >
                {name || publicKey}
            </span>
            {unread > 0 && <span className='unread-count'>{unread}</span>}
            <div
                onClick={onDelete}
                className='icon delete'
            >
                <Icon
                    path={mdiDeleteOutline}
                    size='18px'
                />
            </div>
        </div>
    );
};

export default ConnectionTab;
