import React, { useState, useCallback, type CSSProperties, useEffect } from 'react';

const ADMIN_API_URL = 'http://localhost:9000/api/config';

interface ProxyConfig {
    LagTime: number;
    JitterTime: number;
    ThrottleBps: number;
    ErrorRate: number;
}

interface ProxyConfigState {
    LagTime: number | string;
    JitterTime: number | string;
    ThrottleBps: number | string;
    ErrorRate: number | string;
}

const ChaosPanel: React.FC = () => {
    const [config, setConfig] = useState<ProxyConfigState>({
        LagTime: 0,
        JitterTime: 0,
        ThrottleBps: 0,
        ErrorRate: 0,
    });

    const [status, setStatus] = useState<string>('Ready');
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [hasChanges, setHasChanges] = useState<boolean>(false);

    useEffect(() => {
        const syncWithServer = async () => {
            try {
                const response = await fetch(ADMIN_API_URL);
                if (response.ok) {
                    const serverConfig = await response.json();

                    setConfig(prev => ({
                        ...prev,
                        ...serverConfig
                    }));
                }
            } catch (err) {
                console.error("Failed to sync chaos state");
            }
        };

        syncWithServer();
    }, []);

    const sendConfig = useCallback(async (currentConfig: ProxyConfigState) => {
        setStatus('Syncing...');
        try {
            const payload: ProxyConfig = {
                LagTime: Number(currentConfig.LagTime) || 0,
                JitterTime: Number(currentConfig.JitterTime) || 0,
                ThrottleBps: Number(currentConfig.ThrottleBps) || 0,
                ErrorRate: Number(currentConfig.ErrorRate) || 0,
            };

            const response = await fetch(ADMIN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                setStatus('✅ Synced');
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const key = name as keyof ProxyConfigState;
        const newValue = type === 'checkbox' ? checked : value;

        setConfig(prev => ({ ...prev, [key]: newValue }));
        setHasChanges(true);
        setStatus('⚠️ Unsaved');
    };

    const applyPreset = (bps: number) => {
        setConfig(prev => ({ ...prev, ThrottleBps: bps }));
        setStatus('⚠️ Unsaved');
    }

    const renderControl = (
        label: string,
        name: keyof ProxyConfigState,
        min: number,
        max: number,
        unit: string = ""
    ) => (

        <div style={styles.controlRow}>
            <label style={styles.label}>{label}</label>
            <div style={styles.inputs}>
                <input
                    type="number"
                    name={name}
                    value={config[name].toString()}
                    onChange={handleChange}
                    style={styles.numInput}
                    min={min}
                    max={max}
                />
                <span style={styles.unit}>{unit}</span>
                <input
                    type="range"
                    name={name}
                    value={Number(config[name]) || 0}
                    onChange={handleChange}
                    style={styles.slider}
                    min={min}
                    max={max}
                />
            </div>
        </div>
    );

    if (!isExpanded) {
        return (
            <button onClick={() => setIsExpanded(true)} style={styles.floatingButton}>
                Chaos
            </button>
        );
    }

    return (
        <div style={styles.panel}>
            <div style={styles.header}>
                <span>Chaos Controls</span>
                <button onClick={() => setIsExpanded(false)} style={styles.closeBtn}>X</button>
            </div>

            <div style={styles.section}>
                <div style={styles.sectionTitle}>Network Timing</div>
                {renderControl("Lag Base", "LagTime", 0, 5000, "ms")}
                {renderControl("Jitter (+/-)", "JitterTime", 0, 2000, "ms")}
            </div>

            <div style={styles.section}>
                <div style={styles.sectionTitle}>Bandwidth (The Slicer)</div>
                <div style={styles.presetButtons}>
                    <button style={styles.presetBtn} onClick={() => applyPreset(0)}>Unlimited</button>
                    <button style={styles.presetBtn} onClick={() => applyPreset(150000)}>Fast 3G</button>
                    <button style={styles.presetBtn} onClick={() => applyPreset(50000)}>Slow 3G</button>
                    <button style={styles.presetBtn} onClick={() => applyPreset(10240)}>EDGE (Extreme)</button>
                </div>
                {renderControl("Raw Limit", "ThrottleBps", 0, 500000, "bps")}
            </div>

            <div style={styles.section}>
                <div style={styles.sectionTitle}>Reliability</div>
                {renderControl("Error Rate", "ErrorRate", 0, 100, "%")}
            </div>

            <div style={styles.footer}>
                <div style={styles.statusRow}>
                    Status: <span style={status.includes('✅') ? styles.success : styles.waiting}>{status}</span>
                </div>
                <button
                    onClick={() => sendConfig(config)}
                    style={{
                        paddingLeft: 5,
                        paddingRight: 5,
                        paddingTop: 2,
                        paddingBottom: 2,
                        borderRadius: '4px',
                        border: 'none',
                        opacity: hasChanges ? 1 : 0.5,
                        cursor: hasChanges ? 'pointer' : 'default'
                    }}
                >
                    APPLY CHANGES
                </button>
            </div>
        </div>
    );
};

interface StylesDictionary {
    [key: string]: CSSProperties;
}

const styles: StylesDictionary = {
    floatingButton: {
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
        padding: '10px 15px', background: '#222', color: '#f0a500',
        border: '2px solid #f0a500', borderRadius: '30px', cursor: 'pointer',
        fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
    },
    panel: {
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
        width: '320px', background: 'rgba(30, 30, 30, 0.95)', color: '#eee', borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)',
        border: '1px solid #444', fontFamily: 'monospace'
    },
    header: {
        padding: '12px', background: '#f0a500', color: '#222', fontWeight: 'bold',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTopLeftRadius: '8px', borderTopRightRadius: '8px'
    },
    closeBtn: { background: 'none', border: 'none', color: '#222', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' },
    section: { padding: '15px', borderBottom: '1px solid #444' },
    sectionTitle: { fontSize: '12px', textTransform: 'uppercase', color: '#888', marginBottom: '10px', letterSpacing: '1px' },
    controlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
    label: { fontSize: '13px', flex: 1 },
    killLabel: { fontSize: '13px', flex: 1, color: '#ff4444', fontWeight: 'bold' },
    inputs: { display: 'flex', alignItems: 'center', flex: 2 },
    numInput: {
        width: '60px', background: '#333', border: '1px solid #555', color: '#eee',
        padding: '4px', borderRadius: '4px', marginRight: '5px',
        textAlign: 'center' // <-- CHANGE 1: Centered text
    },
    unit: { fontSize: '11px', color: '#888', marginRight: '10px', width: '20px' },
    slider: {
        flex: 1,
        cursor: 'pointer',
        margin: '0 0 0 10px',
        padding: 0,
        verticalAlign: 'middle'
    },
    presetButtons: { display: 'flex', gap: '5px', marginBottom: '15px', flexWrap: 'wrap' },
    presetBtn: { flex: 1, padding: '4px 8px', fontSize: '11px', letterSpacing: '1px', background: '#444', color: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    footer: {
        padding: '10px', fontSize: '11px', background: '#111', color: '#888',
        borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' // <-- CHANGE 2: Flex footer
    },

    success: { color: '#4caf50' },
    waiting: { color: '#f0a500' },
    switch: { position: 'relative', display: 'inline-block', width: '40px', height: '20px' },

};

// CSS injection for pseudo-elements (Toggle switch animation)
const toggleStyles = `
  input:checked + span { background-color: #ff4444 !important; }
  input:checked + span:before { 
    content: ""; position: absolute; height: 16px; width: 16px; 
    left: 2px; bottom: 2px; background-color: transparent; 
    transition: .4s; border-radius: 50%;
    transform: translateX(20px); 
  }
  input:not(:checked) + span:before {
    content: ""; position: absolute; height: 16px; width: 16px; 
    left: 2px; bottom: 2px; background-color: transparent; 
    transition: .4s; border-radius: 50%;
  }
  input[type=range] { accent-color: #f0a500; }
  input[type=number]::-webkit-inner-spin-button, 
  input[type=number]::-webkit-outer-spin-button { 
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    margin: 0; 
}
`;

// Safe check for document existence (in case of SSR)
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = toggleStyles;
    document.head.appendChild(styleSheet);
}

export default ChaosPanel;