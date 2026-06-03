export enum AgentCategory {
  DEPLOYMENT = 'deployment',
  PREDICTIVE = 'predictive',
  MONITORING = 'monitoring',
  RELIABILITY = 'reliability',
  INFRASTRUCTURE = 'infrastructure',
}

export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  ERROR = 'error',
  DISABLED = 'disabled',
}

export type InputType = 'code' | 'perf-log' | 'monitor' | 'machine-params' | 'incident';
