import React, { useState, useCallback, type CSSProperties, useEffect } from 'react';

const ADMIN_API_URL = 'http://localhost:9000/api/config';

interface ProxyConfig {
    // --- New Connection Settings ---
    Mode: 'split' | 'unified';
    TargetFrontend: string;
    TargetBackend: string;
    TargetUnified: string;
    ChaosRoutes: string[]; // Sent as array to server

    // --- Existing Chaos Settings ---
    LagToReq: number | string;
    LagToResp: number | string;

    bandwidthUp: number | string;
    bandwidthDown: number | string;

    jitter: number | string;

}

interface ProxyConfigState {
    Mode: 'split' | 'unified';
    TargetFrontend: string;
    TargetBackend: string;
    TargetUnified: string;
    ChaosRoutes: string; // Kept as string for the text input (comma separated)

    LagToReq: number | string;
    LagToResp: number | string;

    bandwidthUp: number | string;
    bandwidthDown: number | string;

    jitter: number | string;

}

const App: React.FC = () => {
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

        jitter: 0

    });

    const [status, setStatus] = useState<string>('Connecting...');
    const [hasChanges, setHasChanges] = useState<boolean>(false);

    // --- 1. Load Config on Mount ---
    useEffect(() => {
        const syncWithServer = async () => {
            try {
                const response = await fetch(ADMIN_API_URL);
                if (response.ok) {
                    const serverConfig = await response.json();

                    // Convert array back to string for input field
                    const routesStr = serverConfig.ChaosRoutes ? serverConfig.ChaosRoutes.join(', ') : '/graphql';

                    setConfig(prev => ({
                        ...prev,
                        ...serverConfig,
                        ChaosRoutes: routesStr
                    }));
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

    // --- 2. Send Config to Server ---
    const sendConfig = useCallback(async (currentConfig: ProxyConfigState) => {
        setStatus('Syncing...');
        try {
            // Prepare payload (Convert types)
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
            console.error(err);
            setStatus('❌ Connection Failed');
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        const key = name as keyof ProxyConfigState;

        // Handle Checkbox vs Text
        const newValue = type === 'checkbox' ? checked : value;

        setConfig(prev => ({ ...prev, [key]: newValue }));
        setHasChanges(true);
        setStatus('⚠️ Unsaved');
    };

    // --- Helper to render Chaos Sliders ---
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
            <div style={styles.card}>
                {/* HEADER */}
                <div style={styles.header}>
                    <div style={styles.statusBadge}>
                        {status}
                    </div>
                </div>

                <div style={styles.scrollArea}>

                    {/* SECTION 1: CONNECTION SETUP */}
                    <div style={styles.section}>
                        <div style={styles.sectionTitle}>Target Configuration</div>

                        <div style={styles.radioGroup}>
                            <label style={{ ...styles.radioLabel, opacity: config.Mode === 'split' ? 1 : 0.5 }}>
                                <input
                                    type="radio" name="Mode" value="split"
                                    checked={config.Mode === 'split'}
                                    onChange={handleChange}
                                />
                                Split Mode (Frontend + Backend)
                            </label>
                            <label style={{ ...styles.radioLabel, opacity: config.Mode === 'unified' ? 1 : 0.5 }}>
                                <input
                                    type="radio" name="Mode" value="unified"
                                    checked={config.Mode === 'unified'}
                                    onChange={handleChange}
                                />
                                Unified Mode (Single URL)
                            </label>
                        </div>

                        {config.Mode === 'split' ? (
                            <>
                                <div style={styles.inputGroup}>
                                    <label style={styles.subLabel}>Frontend URL</label>
                                    <input type="text" name="TargetFrontend" value={config.TargetFrontend} onChange={handleChange} style={styles.textInput} placeholder="http://localhost:3000" />
                                </div>
                                <div style={styles.inputGroup}>
                                    <label style={styles.subLabel}>Backend URL</label>
                                    <input type="text" name="TargetBackend" value={config.TargetBackend} onChange={handleChange} style={styles.textInput} placeholder="http://localhost:4000" />
                                </div>
                            </>
                        ) : (
                            <div style={styles.inputGroup}>
                                <label style={styles.subLabel}>Target URL</label>
                                <input type="text" name="TargetUnified" value={config.TargetUnified} onChange={handleChange} style={styles.textInput} placeholder="http://localhost:80 or https://staging.api.com" />
                            </div>
                        )}

                        <div style={styles.inputGroup}>
                            <label style={styles.subLabel}>Chaos Routes (Prefixes)</label>
                            <input type="text" name="ChaosRoutes" value={config.ChaosRoutes} onChange={handleChange} style={styles.textInput} placeholder="/api, /graphql" />
                            <div style={styles.hint}>Requests starting with these will be delayed/throttled.</div>
                        </div>
                    </div>

                    {/* SECTION 2: CHAOS CONTROLS */}
                    <div style={styles.section}>
                        <div style={styles.sectionTitle}>Throttling</div>
                        <div style={styles.presetButtons}>
                            <button style={styles.presetBtn} onClick={() => {
                                setConfig(prev => ({
                                    ...prev, LagToReq: 0,
                                    LagToResp: 0,

                                    bandwidthUp: 0,
                                    bandwidthDown: 0,

                                    jitter: 0
                                }));
                                setHasChanges(true);

                                setStatus('⚠️ Unsaved');
                            }}>Unlimited</button>
                            <button style={styles.presetBtn} onClick={() => {
                                setConfig(prev => ({
                                    ...prev,

                                    // Latency (TTFB)
                                    LagToReq: 50,
                                    LagToResp: 80,

                                    // Bandwidth (KB/s)
                                    bandwidthUp: 750,     // ~6 Mbps
                                    bandwidthDown: 2000,  // ~16 Mbps

                                    // Jitter
                                    jitter: 30
                                }));
                                setHasChanges(true);

                                setStatus('⚠️ Unsaved');

                            }}>Fast 4G</button>
                            <button style={styles.presetBtn} onClick={() => {
                                setConfig(prev => ({
                                    ...prev,

                                    LagToReq: 150,
                                    LagToResp: 200,

                                    bandwidthUp: 250,     // ~2 Mbps
                                    bandwidthDown: 750,   // ~6 Mbps

                                    jitter: 120
                                }));
                                setHasChanges(true);

                                setStatus('⚠️ Unsaved');


                            }}>Slow 4G</button>
                            <button style={styles.presetBtn} onClick={() => {
                                setConfig(prev => ({
                                    ...prev,

                                    LagToReq: 300,
                                    LagToResp: 400,

                                    bandwidthUp: 40,      // ~300 kbps
                                    bandwidthDown: 100,   // ~800 kbps

                                    jitter: 200
                                }));
                                setHasChanges(true);

                                setStatus('⚠️ Unsaved');

                            }}>3G</button>
                            <button style={styles.presetBtn} onClick={() => {
                                setConfig(prev => ({
                                    ...prev,

                                    LagToReq: 600,
                                    LagToResp: 800,

                                    bandwidthUp: 10,      // ~80 kbps
                                    bandwidthDown: 30,    // ~240 kbps

                                    jitter: 500
                                }));
                                setHasChanges(true);

                                setStatus('⚠️ Unsaved');


                            }}>EDGE (Extreme)</button>
                        </div>

                        {/* 1. UPLOAD CONTROL */}
                        <div style={{ marginBottom: '15px' }}>
                            {renderControl("Request Delay", "LagToReq", 0, 5000, "ms")}
                            <div style={styles.hint}>TTFB (upload)</div>
                        </div>

                        {/* 2. DOWNLOAD CONTROL */}
                        <div style={{ marginBottom: '15px' }}>
                            {renderControl("Response Delay", "LagToResp", 0, 5000, "ms")}
                            <div style={styles.hint}>TTFB (download)</div>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            {renderControl("Bandwidth Upload", "bandwidthUp", 0, 500000, "bps")}

                            <div style={styles.hint}>Upload bandwidth</div>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            {renderControl("Bandwidth Download", "bandwidthDown", 0, 500000, "bps")}

                            <div style={styles.hint}>Download bandwidth</div>
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            {renderControl("Jitter", "jitter", 0, 500000, "bps")}

                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div style={styles.footer}>
                    <div style={{ color: '#666' }}>
                        Changes apply immediately upon save.
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
                        {hasChanges ? 'APPLY CHANGES' : 'SAVED'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- STYLES ---
interface StylesDictionary { [key: string]: CSSProperties }

const styles: StylesDictionary = {
    pageContainer: {
        minHeight: '100vh',
        background: '#111',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'monospace',
        color: '#eee'
    },
    card: {
        width: '600px',
        maxWidth: '95%',
        background: '#1e1e1e',
        borderRadius: '8px',
        border: '1px solid #333',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh' // Prevent overflow on small screens
    },
    header: {
        padding: '20px',
        background: '#f0a500',
        color: '#222',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px'
    },
    statusBadge: {
        background: 'rgba(0,0,0,0.1)',
        padding: '4px 10px',
        borderRadius: '4px',
        fontSize: '12px'
    },
    scrollArea: {
        padding: '20px',
        overflowY: 'auto'
    },
    section: {
        marginBottom: '25px',
        paddingBottom: '25px',
        borderBottom: '1px solid #333'
    },
    sectionTitle: {
        fontSize: '12px',
        textTransform: 'uppercase',
        color: '#f0a500',
        marginBottom: '15px',
        letterSpacing: '1px',
        fontWeight: 'bold'
    },
    // Form Styles
    radioGroup: { display: 'flex', gap: '20px', marginBottom: '20px' },
    radioLabel: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' },
    inputGroup: { marginBottom: '15px' },
    subLabel: { display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '5px' },
    textInput: {
        width: '100%', padding: '10px', background: '#111', border: '1px solid #444',
        color: '#fff', borderRadius: '4px', fontFamily: 'monospace', boxSizing: 'border-box'
    },
    hint: { fontSize: '11px', color: '#666', marginTop: '5px', fontStyle: 'italic' },

    // Chaos Control Styles
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    label: { fontSize: '13px', flex: 1 },
    inputs: { display: 'flex', alignItems: 'center', flex: 2 },
    numInput: {
        width: '70px', background: '#333', border: '1px solid #555', color: '#eee',
        padding: '6px', borderRadius: '4px', marginRight: '5px', textAlign: 'center'
    },
    unit: { fontSize: '11px', color: '#888', marginRight: '10px', width: '20px' },
    slider: { flex: 1, cursor: 'pointer', margin: '0 0 0 10px' },

    // Buttons
    presetButtons: { display: 'flex', gap: '5px', marginBottom: '20px' },
    presetBtn: {
        flex: 1, padding: '6px', fontSize: '11px', background: '#333',
        color: '#ccc', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer'
    },
    footer: {
        padding: '20px',
        background: '#151515',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    mainButton: {
        padding: '10px 20px',
        background: '#f0a500',
        color: '#222',
        fontWeight: 'bold',
        border: 'none',
        borderRadius: '4px',
        fontSize: '14px'
    }
};

// Inject CSS for slider thumb and scrollbar
const globalStyles = `
  body { margin: 0; background: #111; }
  
  /* Custom Scrollbar */
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #444; borderRadius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #f0a500; }
  input[type=range] { accent-color: #f0a500; }
  input[type=number]::-webkit-inner-spin-button, 
  input[type=number]::-webkit-outer-spin-button { 
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    margin: 0; 
}
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = globalStyles;
    document.head.appendChild(styleSheet);
}

export default App;