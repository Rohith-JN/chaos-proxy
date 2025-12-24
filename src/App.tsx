import React, { useState, useCallback, type CSSProperties, useEffect, useRef } from 'react';

const ADMIN_API_URL = 'http://localhost:9000/api/config';

// --- Interfaces ---
interface ProxyConfig {
    Mode: 'split' | 'unified';
    TargetFrontend: string;
    TargetBackend: string;
    TargetUnified: string;
    ChaosRoutes: string[];
    LagToReq: number | string;
    LagToResp: number | string;
    bandwidthUp: number | string;
    bandwidthDown: number | string;
    jitter: number | string;
    failureMode: string;
}

interface ProxyConfigState {
    Mode: 'split' | 'unified';
    TargetFrontend: string;
    TargetBackend: string;
    TargetUnified: string;
    ChaosRoutes: string;
    LagToReq: number | string;
    LagToResp: number | string;
    bandwidthUp: number | string;
    bandwidthDown: number | string;
    jitter: number | string;
    failureMode: string;
}

interface TrafficLog {
    id: number;
    method: string;
    path: string;
    status: number;
    duration: number;
    tampered: boolean;
    tamperType?: string; // e.g., "DELAY", "503", "HANG"
    timestamp: string;
}

const App: React.FC = () => {
    // --- State ---
    const [config, setConfig] = useState<ProxyConfigState>({
        Mode: 'split',
        TargetFrontend: 'http://localhost:3000',
        TargetBackend: 'http://localhost:4000',
        TargetUnified: 'http://localhost:80',
        ChaosRoutes: '/api, /graphql',
        LagToReq: 0,
        LagToResp: 0,
        bandwidthUp: 0,
        bandwidthDown: 0,
        jitter: 0,
        failureMode: 'normal'
    });

    const [status, setStatus] = useState<string>('Connecting...');
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [throttleMode, setThrottleMode] = useState<string>('unlimited');

    // Traffic Log State (Mocked for UI layout)
    const [logs, setLogs] = useState<TrafficLog[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // --- Effects ---

    // 1. Load Config
    useEffect(() => {
        const syncWithServer = async () => {
            try {
                const response = await fetch(ADMIN_API_URL);
                if (response.ok) {
                    const serverConfig = await response.json();
                    const routesStr = serverConfig.ChaosRoutes ? serverConfig.ChaosRoutes.join(', ') : '/graphql';

                    setConfig(prev => ({ ...prev, ...serverConfig, ChaosRoutes: routesStr }));

                    // Smart Preset Detection
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

    // 2. Mock Traffic Generator (For UI visualization only)
    useEffect(() => {
        const interval = setInterval(() => {
            const methods = ['GET', 'POST', 'PUT', 'GET'];
            const paths = ['/api/users', '/api/orders', '/static/main.js', '/graphql', '/api/auth'];
            const randomMethod = methods[Math.floor(Math.random() * methods.length)];
            const randomPath = paths[Math.floor(Math.random() * paths.length)];

            // Simulate chaos based on config
            const isTampered = Math.random() > 0.6 || config.failureMode !== 'normal';
            let status = 200;
            let tamperType = undefined;
            let duration = Math.floor(Math.random() * 100) + 20;

            if (isTampered) {
                if (config.failureMode === 'timeout') {
                    status = 0; // pending
                    tamperType = 'TIMEOUT';
                    duration = 60000;
                } else if (config.failureMode === 'close_body') {
                    status = 499; // Client Closed
                    tamperType = 'CUT-OFF';
                } else if (Number(config.LagToResp) > 0) {
                    duration += Number(config.LagToResp);
                    tamperType = `LAG +${config.LagToResp}ms`;
                } else {
                    status = 503;
                    tamperType = 'INJECT 503';
                }
            }

            const newLog: TrafficLog = {
                id: Date.now(),
                method: randomMethod,
                path: randomPath,
                status: status,
                duration: duration,
                tampered: isTampered,
                tamperType: tamperType,
                timestamp: new Date().toLocaleTimeString()
            };

            setLogs(prev => {
                const updated = [...prev, newLog];
                if (updated.length > 20) updated.shift(); // Keep last 20
                return updated;
            });
        }, 2000);

        return () => clearInterval(interval);
    }, [config]);

    // Scroll to bottom of logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);


    // --- Handlers ---
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
                failureMode: String(currentConfig.failureMode) || 'normal'
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

    const getButtonStyle = (isActive: boolean) => ({
        ...styles.presetBtn,
        ...(isActive ? {
            background: '#f0a500',
            color: '#222',
            borderColor: '#f0a500',
            fontWeight: 'bold' as const
        } : {})
    });

    const renderControl = (label: string, name: keyof ProxyConfigState, min: number, max: number, unit: string = "") => (
        <div style={styles.controlRow}>
            <label style={styles.label}>{label}</label>
            <div style={styles.inputs}>
                <input
                    type="number"
                    name={name}
                    value={config[name]}
                    onChange={handleChange}
                    style={styles.numInput}
                    min={min} max={max}
                />
                <span style={styles.unit}>{unit}</span>
                <input
                    type="range"
                    name={name}
                    value={Number(config[name]) || 0}
                    onChange={handleChange}
                    style={styles.slider}
                    min={min} max={max}
                />
            </div>
        </div>
    );

    return (
        <div style={styles.pageContainer}>
            <div style={styles.dashboardContainer}>

                {/* HEADER */}
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={styles.statusBadge}>{status}</div>
                    </div>
                    <button
                        onClick={() => sendConfig(config)}
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

                <div style={styles.gridContent}>

                    {/* COLUMN 1: CONFIGURATION & PRESETS */}
                    <div style={styles.col}>
                        <div style={styles.section}>
                            <div style={styles.sectionTitle}>Target Setup</div>
                            <div style={styles.radioGroup}>
                                <label style={{ ...styles.radioLabel, opacity: config.Mode === 'split' ? 1 : 0.5 }}>
                                    <input type="radio" name="Mode" value="split" checked={config.Mode === 'split'} onChange={handleChange} />
                                    Split Mode
                                </label>
                                <label style={{ ...styles.radioLabel, opacity: config.Mode === 'unified' ? 1 : 0.5 }}>
                                    <input type="radio" name="Mode" value="unified" checked={config.Mode === 'unified'} onChange={handleChange} />
                                    Unified
                                </label>
                            </div>

                            {config.Mode === 'split' ? (
                                <>
                                    <div style={styles.inputGroup}>
                                        <label style={styles.subLabel}>Frontend URL</label>
                                        <input type="text" name="TargetFrontend" value={config.TargetFrontend} onChange={handleChange} style={styles.textInput} />
                                    </div>
                                    <div style={styles.inputGroup}>
                                        <label style={styles.subLabel}>Backend URL</label>
                                        <input type="text" name="TargetBackend" value={config.TargetBackend} onChange={handleChange} style={styles.textInput} />
                                    </div>
                                </>
                            ) : (
                                <div style={styles.inputGroup}>
                                    <label style={styles.subLabel}>Target URL</label>
                                    <input type="text" name="TargetUnified" value={config.TargetUnified} onChange={handleChange} style={styles.textInput} />
                                </div>
                            )}

                            <div style={styles.inputGroup}>
                                <label style={styles.subLabel}>Chaos Routes</label>
                                <input type="text" name="ChaosRoutes" value={config.ChaosRoutes} onChange={handleChange} style={styles.textInput} />
                            </div>
                        </div>

                        <div style={styles.section}>
                            <div style={styles.sectionTitle}>Quick Presets</div>
                            <div style={styles.presetList}>
                                <button style={getButtonStyle(throttleMode === 'unlimited')} onClick={() => {
                                    setThrottleMode('unlimited');
                                    setConfig(prev => ({ ...prev, LagToReq: 0, LagToResp: 0, bandwidthUp: 0, bandwidthDown: 0, jitter: 0 }));
                                    setHasChanges(true);
                                }}>Unlimited / Clear</button>

                                <button style={getButtonStyle(throttleMode === 'fast4g')} onClick={() => {
                                    setThrottleMode('fast4g');
                                    setConfig(prev => ({ ...prev, LagToReq: 50, LagToResp: 80, bandwidthUp: 750, bandwidthDown: 2000, jitter: 30 }));
                                    setHasChanges(true);
                                }}>Fast 4G</button>

                                <button style={getButtonStyle(throttleMode === 'slow4g')} onClick={() => {
                                    setThrottleMode('slow4g');
                                    setConfig(prev => ({ ...prev, LagToReq: 150, LagToResp: 200, bandwidthUp: 250, bandwidthDown: 750, jitter: 120 }));
                                    setHasChanges(true);
                                }}>Slow 4G</button>

                                <button style={getButtonStyle(throttleMode === '3g')} onClick={() => {
                                    setThrottleMode('3g');
                                    setConfig(prev => ({ ...prev, LagToReq: 300, LagToResp: 400, bandwidthUp: 40, bandwidthDown: 100, jitter: 200 }));
                                    setHasChanges(true);
                                }}>3G</button>

                                <button style={getButtonStyle(throttleMode === 'edge')} onClick={() => {
                                    setThrottleMode('edge');
                                    setConfig(prev => ({ ...prev, LagToReq: 600, LagToResp: 800, bandwidthUp: 10, bandwidthDown: 30, jitter: 500 }));
                                    setHasChanges(true);
                                }}>EDGE</button>
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 2: FINE TUNING (TAMPERING) */}
                    <div style={styles.col}>
                        <div style={styles.section}>
                            <div style={styles.sectionTitle}>Network Dynamics</div>
                            {renderControl("Req Delay", "LagToReq", 0, 5000, "ms")}
                            {renderControl("Resp Delay", "LagToResp", 0, 5000, "ms")}
                            {renderControl("Bandwidth Up", "bandwidthUp", 0, 500000, "bps")}
                            {renderControl("Bandwidth Down", "bandwidthDown", 0, 500000, "bps")}
                            {renderControl("Jitter", "jitter", 0, 500000, "bps")}
                        </div>

                        <div style={styles.section}>
                            <div style={styles.sectionTitle}>Connection Failure Modes</div>
                            <div style={styles.failureGrid}>
                                {[
                                    { id: 'normal', label: 'Normal', desc: 'No artificial errors.' },
                                    { id: 'timeout', label: 'Timeout', desc: 'Simulates 60s server hang.' },
                                    { id: 'hang_body', label: 'Hang Body', desc: 'Headers sent, body hangs forever.' },
                                    { id: 'close_body', label: 'Disconnect', desc: 'Connection killed mid-stream.' }
                                ].map((mode) => {
                                    const isActive = config.failureMode === mode.id;
                                    return (
                                        <div
                                            key={mode.id}
                                            onClick={() => {
                                                setConfig(prev => ({ ...prev, failureMode: mode.id }));
                                                setHasChanges(true);
                                                setStatus('⚠️ Unsaved');
                                            }}
                                            style={{ ...styles.modeCard, ...(isActive ? styles.modeCardActive : {}) }}
                                        >
                                            <div style={{ ...styles.modeTitle, ...(isActive ? styles.modeTitleActive : {}) }}>{mode.label}</div>
                                            <div style={styles.modeDesc}>{mode.desc}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 3: TRAFFIC MONITOR */}
                    <div style={styles.col}>
                        <div style={{ ...styles.section, height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={styles.sectionTitle}>Live Traffic Feed</div>
                            <div style={styles.monitorContainer}>
                                {logs.length === 0 && <div style={styles.emptyLog}>Waiting for traffic...</div>}
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
                                            }}>{log.method}</span>
                                            <span style={styles.logPath} title={log.path}>{log.path}</span>
                                            <span style={{ fontSize: '10px', color: '#666' }}>{log.timestamp}</span>
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
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- STYLES ---
const styles: { [key: string]: CSSProperties } = {
    pageContainer: {
        minHeight: '100vh',
        background: '#111',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'monospace',
        color: '#eee',
    },
    dashboardContainer: {
        width: '1600px', // Wider container for 3 cols
        maxWidth: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        padding: '15px 25px',
        background: '#f0a500',
        color: '#222',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '16px',
        letterSpacing: '1px'
    },
    statusBadge: {
        background: 'rgba(255,255,255,0.3)',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#000'
    },
    gridContent: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1.2fr', // Col 3 is slightly wider
        gap: '0',
        flex: 1,
        overflow: 'hidden' // Important so inner columns scroll independently
    },
    col: {
        padding: '20px',
        borderRight: '1px solid #333',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
    },
    section: {
        marginBottom: '25px',
        paddingBottom: '15px',
        borderBottom: '1px solid #2a2a2a',
        flexShrink: 0
    },
    sectionTitle: {
        fontSize: '12px',
        textTransform: 'uppercase',
        color: '#f0a500',
        marginBottom: '15px',
        letterSpacing: '1px',
        fontWeight: 'bold'
    },

    // --- Config Inputs ---
    radioGroup: { display: 'flex', gap: '20px', marginBottom: '20px' },
    radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' },
    inputGroup: { marginBottom: '15px' },
    subLabel: { display: 'block', fontSize: '11px', color: '#aaa', marginBottom: '5px' },
    textInput: {
        width: '100%', padding: '8px', background: '#111', border: '1px solid #444',
        color: '#fff', borderRadius: '4px', fontFamily: 'monospace', boxSizing: 'border-box'
    },
    presetList: { display: 'flex', flexDirection: 'column', gap: '8px' },
    presetBtn: {
        padding: '8px', fontSize: '12px', background: '#333',
        color: '#ccc', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer',
        textAlign: 'left'
    },

    // --- Sliders ---
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    label: { fontSize: '12px', flex: 1 },
    inputs: { display: 'flex', alignItems: 'center', flex: 2 },
    numInput: {
        width: '60px', background: '#333', border: '1px solid #555', color: '#eee',
        padding: '4px', borderRadius: '4px', marginRight: '5px', textAlign: 'center', fontSize: '12px'
    },
    unit: { fontSize: '10px', color: '#888', marginRight: '10px', width: '20px' },
    slider: { flex: 1, cursor: 'pointer', margin: '0 0 0 10px' },

    // --- Failure Mode Cards ---
    failureGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
    modeCard: {
        background: '#1a1a1a', border: '1px solid #333', borderRadius: '6px',
        padding: '10px', cursor: 'pointer', transition: 'all 0.2s ease',
    },
    modeCardActive: {
        background: 'rgba(240, 165, 0, 0.1)', border: '1px solid #f0a500',
        boxShadow: '0 0 10px rgba(240, 165, 0, 0.1)'
    },
    modeTitle: { fontSize: '12px', fontWeight: 'bold', color: '#eee', marginBottom: '4px' },
    modeTitleActive: { color: '#f0a500' },
    modeDesc: { fontSize: '10px', color: '#777', lineHeight: '1.3' },

    // --- Traffic Monitor (Col 3) ---
    monitorContainer: {
        flex: 1,
        background: '#0a0a0a',
        border: '1px solid #333',
        borderRadius: '6px',
        padding: '10px',
        overflowY: 'auto',
        fontFamily: 'monospace',
    },
    logEntry: {
        marginBottom: '6px',
        background: '#141414',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    logPath: { color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' },
    logFooter: { display: 'flex', gap: '15px', fontSize: '11px', alignItems: 'center' },
    tamperBadge: {
        background: '#f0a500', color: '#000', padding: '1px 4px', borderRadius: '2px', fontSize: '9px', fontWeight: 'bold'
    },
    emptyLog: { color: '#444', textAlign: 'center', padding: '20px', fontSize: '12px' },

    mainButton: {
        padding: '8px 16px', background: '#222', color: '#fff',
        fontWeight: 'bold', border: 'none', borderRadius: '4px', fontSize: '12px'
    }
};

// Inject CSS for slider thumb and scrollbar
const globalStyles = `
  body { margin: 0; background: #111; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; borderRadius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #f0a500; }
  input[type=range] { accent-color: #f0a500; }
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = globalStyles;
    document.head.appendChild(styleSheet);
}

export default App;