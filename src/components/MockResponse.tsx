import { styles } from "../styles";
import type { MockRule } from "../types";

interface MockResponseProps {
    rules: MockRule[];
    onChange: (newRules: MockRule[]) => void;
}
export const MockResponse: React.FC<MockResponseProps> = ({ rules = [], onChange }) => {

    const addMockRule = () => {
        const newRule: MockRule = {
            id: Date.now().toString(),
            pathPattern: "",
            body: '{\n  "status": "ok",\n  "data": []\n}',
            active: true
        };
        onChange([...(rules || []), newRule]);
    };

    const updateMockRule = (id: string, field: keyof MockRule, value: any) => {
        const newRules = rules.map(r => r.id === id ? { ...r, [field]: value } : r);
        onChange(newRules);
    };

    const removeMockRule = (id: string) => {
        const newRules = rules.filter(r => r.id !== id);
        onChange(newRules);
    };

    return (<div style={styles.section}>
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

            {(!rules || rules.length === 0) && (
                <div style={{ fontSize: '12px', color: '#444', fontStyle: 'italic', textAlign: 'center', padding: '15px', border: '1px dashed #333', borderRadius: '4px' }}>
                    No active mock rules.
                </div>
            )}

            {rules?.map((rule) => (
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
    </div>);
}