interface ProxyConfig {
  Mode: 'split' | 'unified';
  TargetFrontend: string;
  TargetBackend: string;
  TargetUnified: string;
  ChaosRoutes: string[];
  LagToReq: number | string;
  LagToResp: number | string;
  bandwidthUp: number | string;
  bandwidthDown: number | string;
  jitter: number | string;
  failureMode: string;
  headerRules: HeaderRules;
  statusRules: StatusRule[];
  mockRules: MockRule[];
}

interface ProxyConfigState {
  Mode: 'split' | 'unified';
  TargetFrontend: string;
  TargetBackend: string;
  TargetUnified: string;
  ChaosRoutes: string;
  LagToReq: number;
  LagToResp: number;
  bandwidthUp: number;
  bandwidthDown: number;
  jitter: number;
  failureMode: string;
  headerRules: HeaderRules;
  statusRules: StatusRule[];
  mockRules: MockRule[];
}

interface TrafficLog {
  id: number;
  method: string;
  path: string;
  status: number;
  duration: number;
  tampered: boolean;
  tamperType?: string;
  timestamp: string;
}

interface HeaderRules {
  stripCORS: boolean;
  stripCache: boolean;
  corruptContentType: boolean;
}

interface StatusRule {
  id: string;
  pathPattern: string;
  statusCode: number;
  errorRate: number;
}

interface MockRule {
  id: string;
  pathPattern: string;
  body: string;
  active: boolean;
}

export {
  type ProxyConfig,
  type ProxyConfigState,
  type TrafficLog,
  type HeaderRules,
  type StatusRule,
  type MockRule,
};
