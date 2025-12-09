import React from 'react';
import { createRoot } from 'react-dom/client';
import ChaosPanel from './chaos';

export function initChaos() {
    // 1. Safety Check: Don't run on server (SSR)
    if (typeof window === 'undefined') return;

    // 2. Singleton Check: Don't mount twice
    if (document.getElementById('chaos-widget-root')) return;

    // 3. Create the Container
    const container = document.createElement('div');
    container.id = 'chaos-widget-root';
    // Force high Z-Index so it floats above everything
    container.style.position = 'fixed';
    container.style.zIndex = '2147483647';
    container.style.bottom = '0';
    container.style.right = '0';
    document.body.appendChild(container);

    // 4. Mount React (Isolated)
    const root = createRoot(container);
    root.render(React.createElement(ChaosPanel));
}

initChaos()