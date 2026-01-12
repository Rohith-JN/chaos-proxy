import React from 'react'
import { styles } from '../styles'
import { type ProxyConfigState } from '../types';

interface HeaderProps {
    status: string;
    onChange: (config: ProxyConfigState) => void;
    config: ProxyConfigState;
    hasChanges: boolean;
}

export const Header: React.FC<HeaderProps> = ({ status, onChange, config, hasChanges }) => {
    return (
        <div style={styles.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={styles.statusBadge}>{status}</div>
            </div>
            <button
                onClick={() => onChange(config)}
                disabled={!hasChanges}
                style={{
                    ...styles.mainButton,
                    opacity: hasChanges ? 1 : 0.5,
                    cursor: hasChanges ? 'pointer' : 'not-allowed'
                }}
            >
                {hasChanges ? 'APPLY CHANGES' : 'SYSTEM SYNCED'}
            </button>
        </div>
    )
}