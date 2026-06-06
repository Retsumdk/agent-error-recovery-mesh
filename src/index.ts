#!/usr/bin/env bun
import { Command } from "commander";
import { ErrorMesh } from "./core/ErrorMesh.js";
import { RecoveryEngine } from "./core/RecoveryEngine.js";
import { StateSyncManager } from "./core/StateSync.js";
import { ErrorSeverity } from "./types.js";
import { log } from "./utils/helpers.js";
import { RefreshTokenStrategy, SwitchEndpointStrategy, RestartServiceStrategy } from "./strategies/NetworkStrategies.js";

async function runDemo() {
  log("--- Initializing Agent Error Recovery Mesh ---");
  
  const mesh = new ErrorMesh();
  const engine = new RecoveryEngine(mesh);
  const sync = new StateSyncManager("node-primary");

  // Setup strategies
  engine.registerStrategy("AUTH_EXPIRED", RefreshTokenStrategy);
  engine.registerStrategy("TIMEOUT", SwitchEndpointStrategy);
  engine.registerDefaultStrategy(RestartServiceStrategy);

  // Register agents
  mesh.registerAgent("agent-alpha");
  mesh.registerAgent("agent-beta");
  mesh.registerAgent("agent-gamma");

  // Simulate remote peer for sync
  sync.addPeer("http://agent-mesh-peer-1:3000");

  log("--- Simulating Swarm Activity ---");

  // Report some errors
  mesh.reportError({
    agentId: "agent-alpha",
    code: "AUTH_EXPIRED",
    message: "JWT token has expired",
    severity: ErrorSeverity.MEDIUM,
    context: { lastLogin: Date.now() - 3600000 }
  });

  mesh.reportError({
    agentId: "agent-beta",
    code: "TIMEOUT",
    message: "Primary API endpoint timed out",
    severity: ErrorSeverity.HIGH,
    context: { endpoint: "https://api-primary.example.com" }
  });

  mesh.reportError({
    agentId: "agent-gamma",
    code: "UNKNOWN_FAILURE",
    message: "Unexpected process crash",
    severity: ErrorSeverity.CRITICAL,
    context: { exitCode: 137 }
  });

  // Wait for recovery sequences to run (async)
  await new Promise(r => setTimeout(r, 5000));

  log("--- Mesh State After Recovery ---");
  const finalState = mesh.syncState();
  
  const unrecovered = mesh.getUnrecoveredErrors();
  log(`Total Errors: ${finalState.errors.length}`);
  log(`Unrecovered: ${unrecovered.length}`);
  
  if (unrecovered.length === 0) {
    log("ALL ERRORS SUCCESSFULLY RECOVERED ✅", "info");
  } else {
    log(`${unrecovered.length} ERRORS REMAIN UNRESOLVED ❌`, "error");
  }

  // Demonstrate sync broadcast
  await sync.broadcastState(finalState);
  
  log("Demo complete.");
}

const program = new Command();
program
  .name("agent-error-recovery-mesh")
  .description("Distributed error handling and state synchronization for AI agent swarms")
  .version("1.0.0");

program
  .command("run")
  .description("Run the mesh in demo mode")
  .action(async () => {
    try {
      await runDemo();
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  });

program
  .command("monitor")
  .description("Monitor mesh activity (mock)")
  .action(() => {
    log("Monitoring mode active. Listening for mesh broadcasts...");
    // Mock persistent process
    setInterval(() => {
      log("Heartbeat: Mesh node healthy. Active agents: 3");
    }, 10000);
  });

program.parse(process.argv);
