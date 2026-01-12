// src/components/PresetSection.tsx
import React from 'react';
import { styles } from '../styles';
import { type ProxyConfigState } from '../types';

interface PresetItem {
    id: string;
    label: string;
    config: Partial<ProxyConfigState>;
}

interface PresetsProps {
    title: string;
    presets: PresetItem[];
    activeMode: string;
    onSelect: (id: string, config: Partial<ProxyConfigState>) => void;
}

export const Presets: React.FC<PresetsProps> = ({
    title,
    presets,
    activeMode,
    onSelect
}) => {

    const getButtonStyle = (isActive: boolean) => ({
        ...styles.presetBtn,
        ...(isActive ? {
            background: '#f0a500',
            color: '#222',
            borderColor: '#f0a500',
            fontWeight: 'bold' as const
        } : {})
    });

    return (
        <div style={styles.section}>
            <div style={styles.sectionTitle}>{title}</div>
            <div style={styles.presetList}>
                {presets.map((preset) => (
                    <button
                        key={preset.id}
                        style={getButtonStyle(activeMode === preset.id)}
                        onClick={() => onSelect(preset.id, preset.config)}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>
        </div>
    );
};