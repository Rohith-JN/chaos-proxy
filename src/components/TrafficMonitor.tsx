import React from 'react';
import { styles } from '../styles';
import type { TrafficLog } from '../types';

interface TrafficMonitorProps {
    logs: TrafficLog[];
}

export const TrafficMonitor: React.FC<TrafficMonitorProps> = ({ logs }) => {

    return (
        <div style={{ flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={styles.monitorContainer}>

                {logs.length === 0 && (
                    <div style={styles.emptyLog}>Waiting for traffic...</div>
                )}

                {logs.map(log => (
                    <div key={log.id} style={{
                        ...styles.logEntry,
                        borderLeft: log.tampered ? '3px solid #f0a500' : '3px solid transparent',
                        opacity: log.tampered ? 1 : 0.7
                    }}>
                        <div style={styles.logHeader}>
                            <span style={{
                                fontWeight: 'bold',
                                color: log.method === 'GET' ? '#61affe' : '#49cc90'
                            }}>
                                {log.method}
                            </span>
                            <span style={styles.logPath} title={log.path}>
                                {log.path}
                            </span>
                            <span style={{ fontSize: '10px', color: '#666' }}>
                                {log.timestamp}
                            </span>
                        </div>

                        <div style={styles.logFooter}>
                            <span style={{
                                color: log.status >= 400 || log.status === 0 ? '#ff6060' : '#fff'
                            }}>
                                {log.status === 0 ? 'PENDING' : log.status}
                            </span>
                            <span style={{ color: '#aaa' }}>{log.duration}ms</span>

                            {log.tampered && (
                                <span style={styles.tamperBadge}>
                                    {log.tamperType || 'TAMPERED'}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};