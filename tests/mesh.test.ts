import { describe, test, expect, beforeEach, mock } from "bun:test";
import { ErrorMesh } from "../src/core/ErrorMesh";
import { RecoveryEngine } from "../src/core/RecoveryEngine";
import { ErrorSeverity, RecoveryAction } from "../src/types";

describe("ErrorMesh", () => {
  let mesh: ErrorMesh;

  beforeEach(() => {
    mesh = new ErrorMesh();
  });

  test("should register agents", () => {
    mesh.registerAgent("agent-1");
    const state = mesh.syncState();
    expect(state.activeAgents).toContain("agent-1");
  });

  test("should report and track errors", () => {
    const error = mesh.reportError({
      agentId: "agent-1",
      code: "TEST_ERROR",
      message: "Test message",
      severity: ErrorSeverity.LOW,
      context: {}
    });

    expect(error.id).toBeDefined();
    expect(mesh.getUnrecoveredErrors().length).toBe(1);
  });

  test("should notify subscribers of new errors", () => {
    const callback = mock(() => {});
    mesh.subscribe(callback);

    mesh.reportError({
      agentId: "agent-1",
      code: "TEST_ERROR",
      message: "Test message",
      severity: ErrorSeverity.LOW,
      context: {}
    });

    expect(callback).toHaveBeenCalled();
  });

  test("should mark errors as recovered", () => {
    const error = mesh.reportError({
      agentId: "agent-1",
      code: "TEST_ERROR",
      message: "Test message",
      severity: ErrorSeverity.LOW,
      context: {}
    });

    mesh.markAsRecovered(error.id);
    expect(mesh.getUnrecoveredErrors().length).toBe(0);
  });
});

describe("RecoveryEngine", () => {
  let mesh: ErrorMesh;
  let engine: RecoveryEngine;

  beforeEach(() => {
    mesh = new ErrorMesh();
    engine = new RecoveryEngine(mesh);
  });

  test("should execute recovery strategy on new error", async () => {
    const strategy: RecoveryAction = {
      name: "MOCK_STRATEGY",
      execute: mock(async () => true)
    };

    engine.registerStrategy("AUTH_ERROR", strategy);

    mesh.reportError({
      agentId: "agent-1",
      code: "AUTH_ERROR",
      message: "Auth failed",
      severity: ErrorSeverity.HIGH,
      context: {}
    });

    // Wait for async recovery
    await new Promise(r => setTimeout(r, 100));

    expect(strategy.execute).toHaveBeenCalled();
    expect(mesh.getUnrecoveredErrors().length).toBe(0);
  });

  test("should fall back to default strategies", async () => {
    const defaultStrategy: RecoveryAction = {
      name: "DEFAULT_STRATEGY",
      execute: mock(async () => true)
    };

    engine.registerDefaultStrategy(defaultStrategy);

    mesh.reportError({
      agentId: "agent-1",
      code: "UNKNOWN_ERROR",
      message: "Unknown",
      severity: ErrorSeverity.LOW,
      context: {}
    });

    await new Promise(r => setTimeout(r, 100));

    expect(defaultStrategy.execute).toHaveBeenCalled();
  });
});
