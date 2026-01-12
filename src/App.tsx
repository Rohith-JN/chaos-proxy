import React, { useState, useCallback, useEffect } from 'react';
import { styles } from './styles';
import type {
    ProxyConfig,
    ProxyConfigState,
    TrafficLog,
} from './types';
import { ADMIN_API_URL, NETWORK_PRESETS } from './constants';
import { MockResponse } from './components/MockResponse';
import { Header } from './components/Header';
import { SetupConfig } from './components/SetupConfig';
import { Presets } from './components/Presets';
import { HeaderTamper } from './components/HeaderTamper';
import { NetworkDynamic } from './components/NetworkDynamic';
import { FailureModes } from './components/FailureModes';
import { StatusInjection } from './components/StatusInjection';
import { TrafficMonitor } from './components/TrafficMonitor';

const App: React.FC = () => {
    const [config, setConfig] = useState<ProxyConfigState>({
        Mode: 'split',
        TargetFrontend: 'http://localhost:3000',
        TargetBackend: 'http://localhost:4000',
        TargetUnified: 'http://localhost:3000',
        ChaosRoutes: '/api, /graphql',
        LagToReq: 0,
        LagToResp: 0,
        bandwidthUp: 0,
        bandwidthDown: 0,
        jitter: 0,
        failureMode: 'normal',
        headerRules: { stripCORS: false, stripCache: false, corruptContentType: false },
        statusRules: [],
        mockRules: []
    });

    const [status, setStatus] = useState<string>('Connecting...');
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [throttleMode, setThrottleMode] = useState<string>('unlimited');

    const [logs, setLogs] = useState<TrafficLog[]>([]);

    useEffect(() => {
        const syncWithServer = async () => {
            try {
                const response = await fetch(ADMIN_API_URL);
                if (response.ok) {
                    const serverConfig = await response.json();
                    const routesStr = serverConfig.ChaosRoutes ? serverConfig.ChaosRoutes.join(', ') : '/graphql';

                    setConfig(prev => ({ ...prev, ...serverConfig, ChaosRoutes: routesStr }));

                    const isZero = (v: any) => !v || Number(v) === 0;
                    if (isZero(serverConfig.LagToReq) && isZero(serverConfig.bandwidthDown) && serverConfig.failureMode === 'normal') {
                        setThrottleMode('unlimited');
                    } else {
                        setThrottleMode('custom');
                    }
                    setStatus('Ready');
                } else {
                    setStatus('Server Error');
                }
            } catch (err) {
                console.error("Failed to sync chaos state");
                setStatus('Offline (Is Go Server Running?)');
            }
        };
        syncWithServer();
    }, []);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch('http://localhost:9000/api/activity');
                if (res.ok) {
                    const data = await res.json();
                    setLogs(data);
                }
            } catch (e) {
                console.error("Failed to fetch logs");
            }
        };

        const interval = setInterval(fetchLogs, 1000);
        fetchLogs();

        return () => clearInterval(interval);
    }, []);

    const sendConfig = useCallback(async (currentConfig: ProxyConfigState) => {
        setStatus('Syncing...');
        try {
            const payload: ProxyConfig = {
                Mode: currentConfig.Mode,
                TargetFrontend: currentConfig.TargetFrontend,
                TargetBackend: currentConfig.TargetBackend,
                TargetUnified: currentConfig.TargetUnified,
                ChaosRoutes: currentConfig.ChaosRoutes.split(',').map(s => s.trim()).filter(s => s !== ''),
                LagToReq: Number(currentConfig.LagToReq) || 0,
                LagToResp: Number(currentConfig.LagToResp) || 0,
                bandwidthUp: Number(currentConfig.bandwidthUp) || 0,
                bandwidthDown: Number(currentConfig.bandwidthDown) || 0,
                jitter: Number(currentConfig.jitter) || 0,
                failureMode: String(currentConfig.failureMode) || 'normal',
                statusRules: currentConfig.statusRules || [],
                headerRules: currentConfig.headerRules,
                mockRules: currentConfig.mockRules
            };

            const response = await fetch(ADMIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setStatus('✅ Active');
                setHasChanges(false);
                setTimeout(() => setStatus('Ready'), 2000);
            } else {
                setStatus('❌ Error');
            }
        } catch (err) {
            setStatus('❌ Connection Failed');
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        const key = name as keyof ProxyConfigState;
        const newValue = type === 'checkbox' ? checked : value;

        setConfig(prev => ({ ...prev, [key]: newValue }));

        if (['LagToReq', 'LagToResp', 'bandwidthUp', 'bandwidthDown', 'jitter'].includes(key)) {
            setThrottleMode('custom');
        }
        setHasChanges(true);
        setStatus('⚠️ Unsaved');
    };

    return (
        <div style={styles.pageContainer}>
            <div style={styles.dashboardContainer}>
                <Header status={status} onChange={() => sendConfig(config)} config={config} hasChanges={hasChanges} />
                <div style={styles.gridContent}>

                    <div style={styles.col}>
                        <SetupConfig config={config} handleChange={handleChange} />
                        <Presets
                            title="Quick Presets"
                            presets={NETWORK_PRESETS}
                            activeMode={throttleMode}
                            onSelect={(id, presetConfig) => {
                                setThrottleMode(id);
                                setConfig(prev => ({ ...prev, ...presetConfig }));
                                setHasChanges(true);
                            }}
                        />
                        <HeaderTamper
                            rules={config.headerRules}
                            onChange={(newRules) => {
                                setConfig(prev => ({ ...prev, headerRules: newRules }));
                                setHasChanges(true);
                            }}
                        />
                    </div>

                    <div style={styles.col}>
                        <NetworkDynamic config={config} handleChange={handleChange} />
                        <FailureModes
                            activeMode={config.failureMode}
                            onSelect={(modeId) => {
                                setConfig(prev => ({ ...prev, failureMode: modeId }));
                                setHasChanges(true);
                            }}
                        />
                        <StatusInjection
                            rules={config.statusRules || []}
                            onChange={(newRules) => {
                                setConfig(prev => ({ ...prev, statusRules: newRules }));
                                setHasChanges(true);
                            }}
                        />
                        <MockResponse rules={config.mockRules}
                            onChange={(newRules) => {
                                setConfig(prev => ({ ...prev, mockRules: newRules }));
                                setHasChanges(true);
                            }} />
                    </div>

                    <div style={styles.col}>
                        <TrafficMonitor logs={logs} />
                    </div>
                </div>
            </div >
        </div >
    );
};

export default App;