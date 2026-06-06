export enum ErrorSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL"
}

export interface AgentError {
  id: string;
  agentId: string;
  timestamp: number;
  code: string;
  message: string;
  severity: ErrorSeverity;
  context: Record<string, any>;
  recovered: boolean;
  recoveryAttempts: number;
}

export interface RecoveryAction {
  name: string;
  execute: (error: AgentError) => Promise<boolean>;
}

export interface MeshState {
  errors: AgentError[];
  lastSync: number;
  activeAgents: string[];
}
