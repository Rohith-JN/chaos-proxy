import React from 'react';
import { styles } from '../styles';
import { type StatusRule } from '../types';

interface StatusInjectionProps {
    rules: StatusRule[];
    onChange: (newRules: StatusRule[]) => void;
}

export const StatusInjection: React.FC<StatusInjectionProps> = ({ rules = [], onChange }) => {
    const addRule = () => {
        const newRule: StatusRule = {
            id: Date.now().toString(),
            pathPattern: '',
            statusCode: 500,
            errorRate: 100
        };
        onChange([...rules, newRule]);
    };

    const updateRule = (id: string, field: keyof StatusRule, value: any) => {
        const newRules = rules.map(r => r.id === id ? { ...r, [field]: value } : r);
        onChange(newRules);
    };

    const removeRule = (id: string) => {
        onChange(rules.filter(r => r.id !== id));
    };

    // --- RENDER ---
    return (
        <div style={styles.section}>
            <div style={styles.sectionTitle}>Status Injection</div>

            {/* Status Code Rules Table */}
            <div style={{ background: '#141414', padding: '15px', borderRadius: '6px', border: '1px solid #333' }}>

                {/* Header Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#888' }}>ACTIVE RULES</span>
                    <button
                        onClick={addRule}
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

                {/* Empty State */}
                {rules.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#444', fontStyle: 'italic', textAlign: 'center', padding: '15px', border: '1px dashed #333', borderRadius: '4px' }}>
                        No active injection rules.
                    </div>
                )}

                {/* Rules List */}
                {rules.map((rule) => (
                    <div key={rule.id} style={{
                        display: 'grid',
                        gridTemplateColumns: '3fr 1fr 1fr 30px',
                        gap: '10px',
                        marginBottom: '8px',
                        alignItems: 'center'
                    }}>
                        {/* Path Input */}
                        <input
                            type="text"
                            value={rule.pathPattern}
                            onChange={(e) => updateRule(rule.id, 'pathPattern', e.target.value)}
                            style={{ ...styles.textInput, padding: '8px', fontSize: '12px', marginBottom: 0 }}
                            placeholder="/api/users"
                        />

                        {/* Status Code */}
                        <input
                            type="number"
                            value={rule.statusCode}
                            onChange={(e) => updateRule(rule.id, 'statusCode', parseInt(e.target.value))}
                            style={{ ...styles.numInput, width: '100%', fontSize: '12px', padding: '8px', textAlign: 'left', outline: "none" }}
                            placeholder="503"
                        />

                        {/* Error Rate */}
                        <div style={{ display: 'flex', alignItems: 'center', background: '#111', border: '1px solid #444', borderRadius: '4px' }}>
                            <input
                                type="number"
                                value={rule.errorRate}
                                onChange={(e) => updateRule(rule.id, 'errorRate', parseInt(e.target.value))}
                                style={{ ...styles.numInput, width: '100%', border: 'none', fontSize: '12px', padding: '8px', textAlign: 'left', outline: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                            />
                            <span style={{ fontSize: '11px', color: '#666', paddingRight: '8px' }}>%</span>
                        </div>

                        {/* Remove Button */}
                        <button
                            onClick={() => removeRule(rule.id)}
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
    );
};