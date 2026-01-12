import React from 'react';
import { styles } from '../styles';

interface FailureModesProps {
    activeMode: string;
    onSelect: (modeId: string) => void;
}

export const FailureModes: React.FC<FailureModesProps> = ({ activeMode, onSelect }) => {

    const modes = [
        { id: 'normal', label: 'Normal', desc: 'No artificial errors.' },
        { id: 'timeout', label: 'Timeout', desc: 'Simulates 60s server hang.' },
        { id: 'hang_body', label: 'Hang Body', desc: 'Headers sent, body hangs forever.' },
        { id: 'close_body', label: 'Disconnect', desc: 'Connection killed mid-stream.' }
    ];

    return (
        <div style={styles.section}>
            <div style={styles.sectionTitle}>Connection Failure Modes</div>

            <div style={styles.failureGrid}>
                {modes.map((mode) => {
                    const isActive = activeMode === mode.id;
                    return (
                        <div
                            key={mode.id}
                            onClick={() => onSelect(mode.id)}
                            style={{
                                ...styles.modeCard,
                                ...(isActive ? styles.modeCardActive : {})
                            }}
                        >
                            <div style={{
                                ...styles.modeTitle,
                                ...(isActive ? styles.modeTitleActive : {})
                            }}>
                                {mode.label}
                            </div>
                            <div style={styles.modeDesc}>
                                {mode.desc}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};