import React from 'react';
import { styles } from '../styles';
import { ControlRow } from './ControlRow';
import { type ProxyConfigState } from '../types';

interface NetworkDynamicProps {
    config: ProxyConfigState;
    handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const NetworkDynamic: React.FC<NetworkDynamicProps> = ({ config, handleChange }) => {

    const controls: {
        label: string;
        name: keyof ProxyConfigState;
        min: number;
        max: number;
        unit: string
    }[] = [
            { label: "Req Delay", name: "LagToReq", min: 0, max: 5000, unit: "ms" },
            { label: "Resp Delay", name: "LagToResp", min: 0, max: 5000, unit: "ms" },
            { label: "Bandwidth Up", name: "bandwidthUp", min: 0, max: 500000, unit: "kbps" },
            { label: "Bandwidth Down", name: "bandwidthDown", min: 0, max: 500000, unit: "kbps" },
            { label: "Jitter", name: "jitter", min: 0, max: 1000, unit: "ms" }
        ];

    return (
        <div style={styles.section}>
            <div style={styles.sectionTitle}>Network Dynamics</div>

            {controls.map((ctrl) => (
                <ControlRow
                    key={ctrl.name}
                    label={ctrl.label}
                    name={ctrl.name}
                    value={Number(config[ctrl.name]) || 0}
                    onChange={handleChange}
                    min={ctrl.min}
                    max={ctrl.max}
                    unit={ctrl.unit}
                />
            ))}
        </div>
    );
};