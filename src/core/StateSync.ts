import { MeshState, AgentError } from "../types.js";
import { log } from "../utils/helpers.js";

export class StateSyncManager {
  private nodeId: string;
  private peerNodes: string[] = [];
  private syncInterval: number;

  constructor(nodeId: string, syncInterval: number = 5000) {
    this.nodeId = nodeId;
    this.syncInterval = syncInterval;
  }

  public addPeer(nodeUrl: string) {
    if (!this.peerNodes.includes(nodeUrl)) {
      this.peerNodes.push(nodeUrl);
    }
  }

  public async broadcastState(state: MeshState) {
    log(`Node ${this.nodeId} broadcasting state to ${this.peerNodes.length} peers...`);
    
    const results = await Promise.allSettled(
      this.peerNodes.map(peer => this.sendToPeer(peer, state))
    );

    const successCount = results.filter(r => r.status === "fulfilled").length;
    log(`State broadcast complete. Success: ${successCount}/${this.peerNodes.length}`);
  }

  private async sendToPeer(peer: string, state: MeshState): Promise<void> {
    // Simulation: HTTP POST to peer's sync endpoint
    // In a real implementation, we would use fetch() or a websocket
    await new Promise(r => setTimeout(r, Math.random() * 500));
    if (Math.random() < 0.05) throw new Error("Network timeout");
  }

  public mergeStates(local: MeshState, remote: MeshState): MeshState {
    log(`Merging remote state (lastSync: ${remote.lastSync}) into local state`);
    
    // Deduplicate errors by ID
    const errorMap = new Map<string, AgentError>();
    local.errors.forEach(e => errorMap.set(e.id, e));
    
    remote.errors.forEach(e => {
      const existing = errorMap.get(e.id);
      if (!existing || e.timestamp > existing.timestamp || (e.recovered && !existing.recovered)) {
        errorMap.set(e.id, e);
      }
    });

    const mergedAgents = Array.from(new Set([...local.activeAgents, ...remote.activeAgents]));

    return {
      errors: Array.from(errorMap.values()),
      lastSync: Math.max(local.lastSync, remote.lastSync),
      activeAgents: mergedAgents
    };
  }

  public startAutoSync(getState: () => MeshState, onSync: (newState: MeshState) => void) {
    log(`Starting auto-sync for node ${this.nodeId} every ${this.syncInterval}ms`);
    setInterval(async () => {
      const currentState = getState();
      await this.broadcastState(currentState);
    }, this.syncInterval);
  }
}
