import React from 'react';
import { styles } from '../styles';

interface ControlRowProps {
    label: string;
    name: string;
    value: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    min: number;
    max: number;
    unit?: string;
}

export const ControlRow: React.FC<ControlRowProps> = ({
    label,
    name,
    value,
    onChange,
    min,
    max,
    unit = ""
}) => {
    return (
        <div style={styles.controlRow}>
            <label style={styles.label}>{label}</label>
            <div style={styles.inputs}>
                {/* Number Input */}
                <input
                    type="number"
                    name={name}
                    value={value}
                    onChange={onChange}
                    style={styles.numInput}
                    min={min}
                    max={max}
                />

                <span style={styles.unit}>{unit}</span>

                {/* Slider Input */}
                <input
                    type="range"
                    name={name}
                    value={value || 0}
                    onChange={onChange}
                    style={styles.slider}
                    min={min}
                    max={max}
                />
            </div>
        </div>
    );
};