import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/audit.js";
import { GovernedEngine } from "../src/engine.js";
import { Ledger } from "../src/executor.js";
import { defaultPolicy } from "../src/policy.js";
import { getScenario } from "../src/scenarios.js";

function engine(dailySpend = 0): GovernedEngine {
  const dir = mkdtempSync(join(tmpdir(), "governed-"));
  return new GovernedEngine(
    defaultPolicy(),
    new Ledger({ dailySpend, entries: [] }),
    new AuditLog(join(dir, "log.jsonl")),
  );
}

describe("governed engine", () => {
  it("auto-approves a small refund after a clean simulation and writes a receipt", () => {
    const demo = engine();
    const plan = getScenario("refund-small");
    const result = demo.run(plan);
    expect(result.executed).toBe(true);
    expect(result.policy.requiresApproval).toBe(false);
    expect(demo.ledger.getSnapshot().dailySpend).toBe(120);
    const events = demo.audit.read().map((row) => row.event);
    expect(events).toContain("previewed");
    expect(events).toContain("simulated");
    expect(events).toContain("executed");
  });

  it("holds an $800 spend until a human approves", () => {
    const demo = engine();
    const plan = getScenario("spend-needs-approval");
    const waiting = demo.run(plan);
    expect(waiting.executed).toBe(false);
    expect(waiting.message).toMatch(/Waiting for approval/);
    expect(demo.ledger.getSnapshot().dailySpend).toBe(0);

    demo.approve(plan.id, "test-operator");
    const simulated = demo.simulate(plan);
    const executed = demo.execute(plan, simulated.simulation, simulated.policy);
    expect(executed.executed).toBe(true);
    expect(demo.ledger.getSnapshot().dailySpend).toBe(800);
    expect(demo.audit.read().map((row) => row.event)).toContain("approved");
  });

  it("blocks a spend above the per-action cap", () => {
    const demo = engine();
    const plan = getScenario("spend-over-cap");
    const result = demo.run(plan);
    expect(result.executed).toBe(false);
    expect(result.policy.ok).toBe(false);
    expect(result.policy.issues.join(" ")).toMatch(/per-action cap/);
    expect(demo.ledger.getSnapshot().dailySpend).toBe(0);
  });

  it("blocks a counterpart on the deny list", () => {
    const demo = engine();
    const plan = getScenario("blocked-counterpart");
    const result = demo.run(plan);
    expect(result.executed).toBe(false);
    expect(result.policy.issues.join(" ")).toMatch(/blocked counterpart/);
  });

  it("does not move funds during simulation", () => {
    const demo = engine();
    const plan = getScenario("spend-needs-approval");
    const before = demo.ledger.getSnapshot().dailySpend;
    demo.simulate(plan);
    expect(demo.ledger.getSnapshot().dailySpend).toBe(before);
  });

  it("enforces the daily spend cap using existing ledger activity", () => {
    const demo = engine(4800);
    const plan = getScenario("spend-needs-approval");
    const result = demo.run(plan);
    expect(result.policy.ok).toBe(false);
    expect(result.policy.issues.join(" ")).toMatch(/daily cap/);
  });
});
