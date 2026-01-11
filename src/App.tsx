import React, { useState, useCallback, useEffect, useRef } from 'react';
import { styles } from './styles';
import type {
    ProxyConfig,
    ProxyConfigState,
    TrafficLog,
    StatusRule,
    MockRule,
} from './types';
import { ADMIN_API_URL } from './constants';

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
    const logsEndRef = useRef<HTMLDivElement>(null);

    const addMockRule = () => {
        const newRule: MockRule = {
            id: Date.now().toString(),
            pathPattern: "",
            body: '{\n  "status": "ok",\n  "data": []\n}',
            active: true
        };
        setConfig(prev => ({ ...prev, mockRules: [...(prev.mockRules || []), newRule] }));
        setHasChanges(true);
    };

    const updateMockRule = (id: string, field: keyof MockRule, value: any) => {
        setConfig(prev => ({
            ...prev,
            mockRules: prev.mockRules.map(r => r.id === id ? { ...r, [field]: value } : r)
        }));
        setHasChanges(true);
    };

    const removeMockRule = (id: string) => {
        setConfig(prev => ({
            ...prev,
            mockRules: prev.mockRules.filter(r => r.id !== id)
        }));
        setHasChanges(true);
    };

    const addStatusRule = () => {
        const newRule: StatusRule = {
            id: Date.now().toString(),
            pathPattern: '/api/',
            statusCode: 500,
            errorRate: 100
        };
        setConfig(prev => ({
            ...prev,
            statusRules: [...(prev.statusRules || []), newRule]
        }));
        setHasChanges(true);
    };

    const removeStatusRule = (id: string) => {
        setConfig(prev => ({
            ...prev,
            statusRules: prev.statusRules.filter(r => r.id !== id)
        }));
        setHasChanges(true);
    };

    const updateStatusRule = (id: string, field: keyof StatusRule, value: any) => {
        setConfig(prev => ({
            ...prev,
            statusRules: prev.statusRules.map(r =>
                r.id === id ? { ...r, [field]: value } : r
            )
        }));
        setHasChanges(true);
    };

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
                statusRules: currentConfig.statusRules,
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
                    value={config[name] as string | number}
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
                        {/* --- SECTION: HEADER MANIPULATION --- */}
                        <div style={styles.section}>
                            <div style={styles.sectionTitle}>Header Tampering</div>

                            <div style={styles.failureGrid}>
                                {/* 1. NO TAMPERING (Default / Clear All) */}
                                <div
                                    onClick={() => {
                                        setConfig(prev => ({
                                            ...prev,
                                            headerRules: {
                                                stripCORS: false,
                                                stripCache: false,
                                                corruptContentType: false
                                            }
                                        }));
                                        setHasChanges(true);
                                        setStatus('⚠️ Unsaved');
                                    }}
                                    style={{
                                        ...styles.modeCard,
                                        // Active if ALL flags are false
                                        ...((!config.headerRules?.stripCORS &&
                                            !config.headerRules?.stripCache &&
                                            !config.headerRules?.corruptContentType)
                                            ? styles.modeCardActive : {})
                                    }}
                                >
                                    <div style={{
                                        ...styles.modeTitle,
                                        ...((!config.headerRules?.stripCORS &&
                                            !config.headerRules?.stripCache &&
                                            !config.headerRules?.corruptContentType)
                                            ? styles.modeTitleActive : {})
                                    }}>
                                        No Tampering
                                    </div>
                                    <div style={styles.modeDesc}>
                                        Headers are passed through to the client unmodified.
                                    </div>
                                </div>

                                {/* 2. STRIP CORS */}
                                <div
                                    onClick={() => {
                                        setConfig(prev => ({
                                            ...prev,
                                            headerRules: { ...prev.headerRules, stripCORS: !prev.headerRules.stripCORS }
                                        }));
                                        setHasChanges(true);
                                        setStatus('⚠️ Unsaved');
                                    }}
                                    style={{
                                        ...styles.modeCard,
                                        ...(config.headerRules?.stripCORS ? styles.modeCardActive : {})
                                    }}
                                >
                                    <div style={{
                                        ...styles.modeTitle,
                                        ...(config.headerRules?.stripCORS ? styles.modeTitleActive : {})
                                    }}>
                                        Strip CORS
                                    </div>
                                    <div style={styles.modeDesc}>
                                        Removes Access-Control-Allow-Origin headers. Triggers browser security errors.
                                    </div>
                                </div>

                                {/* 3. DISABLE CACHE */}
                                <div
                                    onClick={() => {
                                        setConfig(prev => ({
                                            ...prev,
                                            headerRules: { ...prev.headerRules, stripCache: !prev.headerRules.stripCache }
                                        }));
                                        setHasChanges(true);
                                        setStatus('⚠️ Unsaved');
                                    }}
                                    style={{
                                        ...styles.modeCard,
                                        ...(config.headerRules?.stripCache ? styles.modeCardActive : {})
                                    }}
                                >
                                    <div style={{
                                        ...styles.modeTitle,
                                        ...(config.headerRules?.stripCache ? styles.modeTitleActive : {})
                                    }}>
                                        Disable Cache
                                    </div>
                                    <div style={styles.modeDesc}>
                                        Strips ETag/Last-Modified and forces no-store.
                                    </div>
                                </div>

                                {/* 4. CORRUPT CONTENT-TYPE */}
                                <div
                                    onClick={() => {
                                        setConfig(prev => ({
                                            ...prev,
                                            headerRules: { ...prev.headerRules, corruptContentType: !prev.headerRules.corruptContentType }
                                        }));
                                        setHasChanges(true);
                                        setStatus('⚠️ Unsaved');
                                    }}
                                    style={{
                                        ...styles.modeCard,
                                        ...(config.headerRules?.corruptContentType ? styles.modeCardActive : {})
                                    }}
                                >
                                    <div style={{
                                        ...styles.modeTitle,
                                        ...(config.headerRules?.corruptContentType ? styles.modeTitleActive : {})
                                    }}>
                                        Corrupt Type
                                    </div>
                                    <div style={styles.modeDesc}>
                                        Changes JSON content-type to text/plain or garbage.
                                    </div>
                                </div>
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


                        {/* --- SECTION: STATUS INJECTION --- */}
                        <div style={styles.section}>
                            <div style={styles.sectionTitle}>Status Injection</div>

                            {/* Status Code Rules Table */}
                            <div style={{ background: '#141414', padding: '15px', borderRadius: '6px', border: '1px solid #333' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>ACTIVE RULES</span>
                                    <button
                                        onClick={addStatusRule}
                                        style={{
                                            background: '#333', border: '1px solid #444', color: '#f0a500',
                                            cursor: 'pointer', fontSize: '16px', padding: '2px 8px', borderRadius: '4px',
                                            lineHeight: '1'
                                        }}
                                        title="Add New Rule"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Table Header Row */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '3fr 1fr 1fr 30px',
                                    gap: '10px',
                                    marginBottom: '5px',
                                    paddingLeft: '4px'
                                }}>
                                    <span style={{ fontSize: '10px', color: '#777', textTransform: 'uppercase' }}>Route Path</span>
                                    <span style={{ fontSize: '10px', color: '#777', textTransform: 'uppercase' }}>Status</span>
                                    <span style={{ fontSize: '10px', color: '#777', textTransform: 'uppercase' }}>Rate %</span>
                                    <span></span>
                                </div>

                                {(!config.statusRules || config.statusRules.length === 0) && (
                                    <div style={{ fontSize: '12px', color: '#444', fontStyle: 'italic', textAlign: 'center', padding: '15px', border: '1px dashed #333', borderRadius: '4px' }}>
                                        No active injection rules.
                                    </div>
                                )}

                                {config.statusRules?.map((rule) => (
                                    <div key={rule.id} style={{
                                        display: 'grid',
                                        gridTemplateColumns: '3fr 1fr 1fr 30px',
                                        gap: '10px',
                                        marginBottom: '8px',
                                        alignItems: 'center'
                                    }}>
                                        <input
                                            type="text"
                                            value={rule.pathPattern}
                                            onChange={(e) => updateStatusRule(rule.id, 'pathPattern', e.target.value)}
                                            style={{ ...styles.textInput, padding: '8px', fontSize: '12px', }}
                                            placeholder="/api/users"
                                        />
                                        <input
                                            type="number"
                                            value={rule.statusCode}
                                            onChange={(e) => updateStatusRule(rule.id, 'statusCode', parseInt(e.target.value))}
                                            style={{ ...styles.numInput, width: '100%', fontSize: '12px', padding: '8px', textAlign: 'left', outline: "none" }}
                                            placeholder="503"
                                        />
                                        <div style={{ display: 'flex', alignItems: 'center', background: '#111', border: '1px solid #444', borderRadius: '4px' }}>
                                            <input
                                                type="number"
                                                value={rule.errorRate}
                                                onChange={(e) => updateStatusRule(rule.id, 'errorRate', parseInt(e.target.value))}
                                                style={{ ...styles.numInput, width: '100%', border: 'none', fontSize: '12px', padding: '8px', textAlign: 'left', outline: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                                            />
                                            <span style={{ fontSize: '11px', color: '#666', paddingRight: '8px' }}>%</span>
                                        </div>

                                        <button
                                            onClick={() => removeStatusRule(rule.id)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#ff4444',
                                                cursor: 'pointer',
                                                fontSize: '18px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: '100%',
                                                padding: '0'
                                            }}
                                            title="Remove Rule"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* --- SECTION: RESPONSE MOCKING --- */}
                        <div style={styles.section}>
                            <div style={styles.sectionTitle}>Response Body Mocking</div>

                            <div style={{ background: '#141414', padding: '15px', borderRadius: '6px', border: '1px solid #333' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>ACTIVE MOCKS</span>
                                    <button
                                        onClick={addMockRule}
                                        style={{
                                            background: '#333', border: '1px solid #444', color: '#f0a500',
                                            cursor: 'pointer', fontSize: '16px', padding: '2px 8px', borderRadius: '4px',
                                            lineHeight: '1'
                                        }}
                                        title="Add Mock Rule"
                                    >
                                        +
                                    </button>
                                </div>

                                {(!config.mockRules || config.mockRules.length === 0) && (
                                    <div style={{ fontSize: '12px', color: '#444', fontStyle: 'italic', textAlign: 'center', padding: '15px', border: '1px dashed #333', borderRadius: '4px' }}>
                                        No active mock rules.
                                    </div>
                                )}

                                {config.mockRules?.map((rule) => (
                                    <div key={rule.id} style={{
                                        marginBottom: '15px',
                                        borderBottom: '1px solid #222',
                                        paddingBottom: '15px'
                                    }}>
                                        {/* Row 1: Route + Controls */}
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                value={rule.pathPattern}
                                                onChange={(e) => updateMockRule(rule.id, 'pathPattern', e.target.value)}
                                                style={{ ...styles.textInput, flex: 1, padding: '8px', fontSize: '12px', color: 'white' }}
                                                placeholder="/api/v1/user/profile"
                                            />

                                            <button
                                                onClick={() => removeMockRule(rule.id)}
                                                style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '18px' }}
                                                title="Remove"
                                            >
                                                ×
                                            </button>
                                        </div>

                                        {/* Row 2: JSON Body Textarea */}
                                        <textarea
                                            value={rule.body}
                                            onChange={(e) => updateMockRule(rule.id, 'body', e.target.value)}
                                            style={{
                                                width: '100%',
                                                background: '#0a0a0a',
                                                boxSizing: 'border-box',
                                                color: '#f0a500',
                                                border: '1px solid #333',
                                                borderRadius: '4px',
                                                fontFamily: 'monospace',
                                                fontSize: '11px',
                                                padding: '8px',
                                                minHeight: '80px',
                                                resize: 'vertical'
                                            }}
                                            spellCheck={false}
                                            placeholder='{"status": "ok"}'
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* COLUMN 3: TRAFFIC MONITOR */}
                    <div style={styles.col}>
                        <div style={{
                            flexShrink: 0, height: '100%', display: 'flex', flexDirection: 'column'
                        }}>
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
            </div >
        </div >
    );
};

export default App;