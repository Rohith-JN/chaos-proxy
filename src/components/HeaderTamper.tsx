import React from 'react';
import { styles } from '../styles';
import { type HeaderRules } from '../types';

interface HeaderTamperProps {
    rules: HeaderRules;
    onChange: (newRules: HeaderRules) => void;
}

export const HeaderTamper: React.FC<HeaderTamperProps> = ({ rules, onChange }) => {

    const isClean = !rules.stripCORS && !rules.stripCache && !rules.corruptContentType;

    const options = [
        {
            id: 'RESET',
            title: 'No Tampering',
            desc: 'Headers are passed through to the client unmodified.',
            isActive: isClean,
            onClick: () => onChange({ stripCORS: false, stripCache: false, corruptContentType: false })
        },
        {
            id: 'stripCORS',
            title: 'Strip CORS',
            desc: 'Removes Access-Control-Allow-Origin headers. Triggers browser security errors.',
            isActive: rules.stripCORS,
            onClick: () => onChange({ ...rules, stripCORS: !rules.stripCORS })
        },
        {
            id: 'stripCache',
            title: 'Disable Cache',
            desc: 'Strips ETag/Last-Modified and forces no-store.',
            isActive: rules.stripCache,
            onClick: () => onChange({ ...rules, stripCache: !rules.stripCache })
        },
        {
            id: 'corruptContentType',
            title: 'Corrupt Type',
            desc: 'Changes JSON content-type to text/plain or garbage.',
            isActive: rules.corruptContentType,
            onClick: () => onChange({ ...rules, corruptContentType: !rules.corruptContentType })
        }
    ];

    return (
        <div style={styles.section}>
            <div style={styles.sectionTitle}>Header Tampering</div>

            <div style={styles.failureGrid}>
                {options.map((opt) => (
                    <div
                        key={opt.id}
                        onClick={opt.onClick}
                        style={{
                            ...styles.modeCard,
                            ...(opt.isActive ? styles.modeCardActive : {})
                        }}
                    >
                        <div style={{
                            ...styles.modeTitle,
                            ...(opt.isActive ? styles.modeTitleActive : {})
                        }}>
                            {opt.title}
                        </div>
                        <div style={styles.modeDesc}>
                            {opt.desc}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};