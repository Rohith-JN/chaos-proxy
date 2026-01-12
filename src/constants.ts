export const ADMIN_API_URL = 'http://localhost:9000/api/config';

// src/constants.ts
import { type ProxyConfigState } from './types';

// We only need a subset of the full config for these network presets
type NetworkPreset = Partial<ProxyConfigState>;

export const NETWORK_PRESETS: {
  id: string;
  label: string;
  config: NetworkPreset;
}[] = [
  {
    id: 'unlimited',
    label: 'Unlimited / Clear',
    config: {
      LagToReq: 0,
      LagToResp: 0,
      bandwidthUp: 0,
      bandwidthDown: 0,
      jitter: 0,
    },
  },
  {
    id: 'fast4g',
    label: 'Fast 4G',
    config: {
      LagToReq: 50,
      LagToResp: 80,
      bandwidthUp: 750,
      bandwidthDown: 2000,
      jitter: 30,
    },
  },
  {
    id: 'slow4g',
    label: 'Slow 4G',
    config: {
      LagToReq: 150,
      LagToResp: 200,
      bandwidthUp: 250,
      bandwidthDown: 750,
      jitter: 120,
    },
  },
  {
    id: '3g',
    label: '3G',
    config: {
      LagToReq: 300,
      LagToResp: 400,
      bandwidthUp: 40,
      bandwidthDown: 100,
      jitter: 200,
    },
  },
  {
    id: 'edge',
    label: 'EDGE',
    config: {
      LagToReq: 600,
      LagToResp: 800,
      bandwidthUp: 10,
      bandwidthDown: 30,
      jitter: 500,
    },
  },
];
