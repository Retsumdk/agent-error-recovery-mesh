import { AgentError, ErrorSeverity, MeshState } from "../types.js";
import { generateId, log } from "../utils/helpers.js";

export class ErrorMesh {
  private state: MeshState;
  private subscribers: ((error: AgentError) => void)[] = [];

  constructor() {
    this.state = {
      errors: [],
      lastSync: Date.now(),
      activeAgents: []
    };
  }

  public registerAgent(agentId: string) {
    if (!this.state.activeAgents.includes(agentId)) {
      this.state.activeAgents.push(agentId);
      log(`Agent ${agentId} joined the mesh`);
    }
  }

  public reportError(error: Omit<AgentError, "id" | "timestamp" | "recovered" | "recoveryAttempts">): AgentError {
    const fullError: AgentError = {
      ...error,
      id: generateId(),
      timestamp: Date.now(),
      recovered: false,
      recoveryAttempts: 0
    };

    this.state.errors.push(fullError);
    log(`Error reported from ${error.agentId}: ${error.code} (${error.severity})`, "error");
    
    this.notifySubscribers(fullError);
    return fullError;
  }

  public subscribe(callback: (error: AgentError) => void) {
    this.subscribers.push(callback);
  }

  private notifySubscribers(error: AgentError) {
    this.subscribers.forEach(cb => {
      try {
        cb(error);
      } catch (e) {
        log(`Failed to notify subscriber: ${e}`, "warn");
      }
    });
  }

  public getErrorsByAgent(agentId: string): AgentError[] {
    return this.state.errors.filter(e => e.agentId === agentId);
  }

  public getUnrecoveredErrors(): AgentError[] {
    return this.state.errors.filter(e => !e.recovered);
  }

  public markAsRecovered(errorId: string) {
    const error = this.state.errors.find(e => e.id === errorId);
    if (error) {
      error.recovered = true;
      log(`Error ${errorId} marked as recovered`);
    }
  }

  public incrementRecoveryAttempt(errorId: string) {
    const error = this.state.errors.find(e => e.id === errorId);
    if (error) {
      error.recoveryAttempts++;
    }
  }

  public syncState(): MeshState {
    this.state.lastSync = Date.now();
    // In a real distributed system, this would involve network calls
    return { ...this.state };
  }

  public purgeOldErrors(maxAgeMs: number = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const originalCount = this.state.errors.length;
    this.state.errors = this.state.errors.filter(e => 
      !e.recovered || (now - e.timestamp) < maxAgeMs
    );
    const purged = originalCount - this.state.errors.length;
    if (purged > 0) {
      log(`Purged ${purged} old recovered errors from mesh`);
    }
  }
}
