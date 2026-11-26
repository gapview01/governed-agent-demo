import { resolve } from "node:path";
import { AuditLog } from "./audit.js";
import { GovernedEngine } from "./engine.js";
import { Ledger } from "./executor.js";
import { loadPolicy } from "./policy.js";
import { getScenario, listScenarios } from "./scenarios.js";

function usage(): never {
  console.log(`Usage:
  npm run preview  -- --scenario <name>
  npm run simulate -- --scenario <name>
  npm run run      -- --scenario <name> [--approve]
  npm run audit

Scenarios: ${listScenarios().join(", ")}
`);
  process.exit(1);
}

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

const command = process.argv[2];
if (!command) usage();

const auditPath = resolve("audit/log.jsonl");
const policy = loadPolicy(resolve("policy/example.json"));
const audit = new AuditLog(auditPath);
const engine = new GovernedEngine(policy, new Ledger(), audit);

if (command === "audit") {
  const rows = audit.read();
  if (rows.length === 0) {
    console.log("Audit log is empty.");
  } else {
    for (const row of rows) {
      console.log(`${row.at}  ${row.event.padEnd(18)}  ${row.planId}  ${row.detail}`);
    }
  }
  process.exit(0);
}

const name = arg("--scenario") ?? "refund-small";
const plan = getScenario(name);

if (command === "preview") {
  const result = engine.preview(plan);
  console.log(result.summary);
  if (result.policy.ok) {
    console.log("Policy: OK");
    for (const reason of result.policy.reasons) console.log(`  - ${reason}`);
  } else {
    console.log("Policy: BLOCKED");
    for (const issue of result.policy.issues) console.log(`  - ${issue}`);
  }
} else if (command === "simulate") {
  const result = engine.simulate(plan);
  console.log(result.policy.ok ? "Policy: OK" : "Policy: BLOCKED");
  for (const line of result.policy.ok ? result.policy.reasons : result.policy.issues) {
    console.log(`  - ${line}`);
  }
  console.log("Simulation:");
  for (const message of result.simulation.messages) console.log(`  - ${message}`);
} else if (command === "run") {
  const simulated = engine.simulate(plan);
  if (simulated.policy.requiresApproval && has("--approve") && simulated.policy.ok) {
    engine.approve(plan.id, "cli-operator");
  }
  const result = engine.execute(plan, simulated.simulation, simulated.policy);
  console.log(result.message);
  process.exit(result.executed ? 0 : 2);
} else {
  usage();
}
