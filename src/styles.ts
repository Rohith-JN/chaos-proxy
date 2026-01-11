import { type CSSProperties } from 'react';

const styles: { [key: string]: CSSProperties } = {
  pageContainer: {
    minHeight: '100vh',
    background: '#111',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'monospace',
    color: '#eee',
  },
  dashboardContainer: {
    width: '1600px',
    maxWidth: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '15px 25px',
    background: '#f0a500',
    color: '#222',
    fontWeight: 'bold',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '16px',
    letterSpacing: '1px',
  },
  statusBadge: {
    background: 'rgba(255,255,255,0.3)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#000',
  },
  gridContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1.2fr',
    gap: '0',
    flex: 1,
    overflow: 'hidden',
  },
  col: {
    padding: '20px',
    borderRight: '1px solid #333',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    marginBottom: '25px',
    paddingBottom: '15px',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: '#f0a500',
    marginBottom: '15px',
    letterSpacing: '1px',
    fontWeight: 'bold',
  },

  radioGroup: { display: 'flex', gap: '20px', marginBottom: '20px' },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  inputGroup: { marginBottom: '15px' },
  subLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#aaa',
    marginBottom: '5px',
  },
  textInput: {
    width: '100%',
    padding: '8px',
    background: '#111',
    border: '1px solid #444',
    color: '#fff',
    borderRadius: '4px',
    fontFamily: 'monospace',
    boxSizing: 'border-box',
  },
  presetList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  presetBtn: {
    padding: '8px',
    fontSize: '12px',
    background: '#333',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
  },

  controlRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  label: { fontSize: '12px', flex: 1 },
  inputs: { display: 'flex', alignItems: 'center', flex: 2 },
  numInput: {
    width: '60px',
    background: '#333',
    border: '1px solid #555',
    color: '#eee',
    padding: '4px',
    borderRadius: '4px',
    marginRight: '5px',
    textAlign: 'center',
    fontSize: '12px',
  },
  unit: { fontSize: '10px', color: '#888', marginRight: '10px', width: '20px' },
  slider: { flex: 1, cursor: 'pointer', margin: '0 0 0 10px' },

  failureGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  modeCard: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  modeCardActive: {
    background: 'rgba(240, 165, 0, 0.1)',
    border: '1px solid #f0a500',
    boxShadow: '0 0 10px rgba(240, 165, 0, 0.1)',
  },
  modeTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#eee',
    marginBottom: '4px',
  },
  modeTitleActive: { color: '#f0a500' },
  modeDesc: { fontSize: '10px', color: '#777', lineHeight: '1.3' },

  monitorContainer: {
    flex: 1,
    background: '#0a0a0a',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '10px',
    overflowY: 'auto',
    fontFamily: 'monospace',
  },
  logEntry: {
    marginBottom: '6px',
    background: '#141414',
    padding: '8px',
    borderRadius: '4px',
    fontSize: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logPath: {
    color: '#ddd',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
  },
  logFooter: {
    display: 'flex',
    gap: '15px',
    fontSize: '11px',
    alignItems: 'center',
  },
  tamperBadge: {
    background: '#f0a500',
    color: '#000',
    padding: '1px 4px',
    borderRadius: '2px',
    fontSize: '9px',
    fontWeight: 'bold',
  },
  emptyLog: {
    color: '#444',
    textAlign: 'center',
    padding: '20px',
    fontSize: '12px',
  },

  mainButton: {
    padding: '8px 16px',
    background: '#222',
    color: '#fff',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: '#ccc',
    background: '#222',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    border: '1px solid #333',
  },
};

const globalStyles = `
  body { margin: 0; background: #111; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; borderRadius: 4px; }
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

export { styles, globalStyles };
