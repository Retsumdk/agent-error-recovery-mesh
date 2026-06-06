import { AgentError, RecoveryAction, ErrorSeverity } from "../types.js";
import { ErrorMesh } from "./ErrorMesh.js";
import { withExponentialBackoff, log } from "../utils/helpers.js";

export class RecoveryEngine {
  private mesh: ErrorMesh;
  private strategies: Map<string, RecoveryAction[]> = new Map();
  private defaultStrategies: RecoveryAction[] = [];

  constructor(mesh: ErrorMesh) {
    this.mesh = mesh;
    this.mesh.subscribe(this.handleNewError.bind(this));
  }

  public registerStrategy(errorCode: string, action: RecoveryAction) {
    const existing = this.strategies.get(errorCode) || [];
    this.strategies.set(errorCode, [...existing, action]);
    log(`Registered recovery strategy '${action.name}' for error code '${errorCode}'`);
  }

  public registerDefaultStrategy(action: RecoveryAction) {
    this.defaultStrategies.push(action);
    log(`Registered default recovery strategy '${action.name}'`);
  }

  private async handleNewError(error: AgentError) {
    if (error.severity === ErrorSeverity.CRITICAL) {
      log(`CRITICAL error detected: ${error.id}. Initiating immediate recovery sequence.`, "error");
    }
    
    await this.attemptRecovery(error);
  }

  public async attemptRecovery(error: AgentError): Promise<boolean> {
    const strategies = this.strategies.get(error.code) || this.defaultStrategies;

    if (strategies.length === 0) {
      log(`No recovery strategies available for error ${error.code}`, "warn");
      return false;
    }

    for (const strategy of strategies) {
      log(`Attempting recovery for ${error.id} using strategy: ${strategy.name}`);
      this.mesh.incrementRecoveryAttempt(error.id);

      try {
        const success = await withExponentialBackoff(
          async () => await strategy.execute(error),
          3,
          500
        );

        if (success) {
          log(`Recovery successful for ${error.id} using ${strategy.name}`);
          this.mesh.markAsRecovered(error.id);
          return true;
        }
      } catch (e) {
        log(`Strategy ${strategy.name} failed for ${error.id}: ${e}`, "warn");
      }
    }

    log(`All recovery strategies exhausted for ${error.id}`, "error");
    return false;
  }

  public async runHealthCheck(agentId: string, checkFn: () => Promise<boolean>) {
    try {
      const healthy = await checkFn();
      if (!healthy) {
        this.mesh.reportError({
          agentId,
          code: "HEALTH_CHECK_FAILED",
          message: "Periodic health check failed",
          severity: ErrorSeverity.MEDIUM,
          context: { checkTimestamp: Date.now() }
        });
      }
    } catch (e) {
      this.mesh.reportError({
        agentId,
        code: "HEALTH_CHECK_ERROR",
        message: `Health check encountered error: ${e}`,
        severity: ErrorSeverity.HIGH,
        context: { error: String(e) }
      });
    }
  }
}
