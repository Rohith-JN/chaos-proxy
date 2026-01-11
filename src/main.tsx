import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { globalStyles } from './styles.ts';

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.innerText = globalStyles;
    document.head.appendChild(styleSheet);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)