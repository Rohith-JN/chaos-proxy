import React from 'react'
import { styles } from '../styles'
import type { ProxyConfigState } from '../types'

type SetupConfigProps = {
    config: ProxyConfigState;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const SetupConfig: React.FC<SetupConfigProps> = ({ config, handleChange }) => {
    return (
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
    )
}