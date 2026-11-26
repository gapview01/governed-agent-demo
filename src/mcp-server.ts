/**
 * Minimal MCP stdio server. No API keys. Speaks JSON-RPC 2.0 over stdin/stdout.
 * Tools: preview_plan, simulate_plan, request_approval, get_audit_log.
 */
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { AuditLog } from "./audit.js";
import { GovernedEngine } from "./engine.js";
import { Ledger } from "./executor.js";
import { createPlan } from "./planner.js";
import { defaultPolicy } from "./policy.js";
import { Action, Plan } from "./types.js";

const engine = new GovernedEngine(
  defaultPolicy(),
  new Ledger(),
  new AuditLog(resolve("audit/mcp-log.jsonl")),
);

const plans = new Map<string, Plan>();

interface RpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}

interface ToolContent {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const tools = [
  {
    name: "preview_plan",
    description:
      "Build and preview a plan of refund, spend or notify steps. Returns the policy decision and a human-readable summary. Does not execute.",
    inputSchema: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["refund", "spend", "notify"] },
              amount: { type: "number" },
              counterpart: { type: "string" },
              memo: { type: "string" },
            },
            required: ["type", "amount", "counterpart", "memo"],
          },
        },
      },
      required: ["steps"],
    },
  },
  {
    name: "simulate_plan",
    description:
      "Simulate a previously previewed plan (or a new plan of steps) without moving any funds. Records the dry-run in the audit log.",
    inputSchema: {
      type: "object",
      properties: {
        planId: { type: "string" },
        steps: { type: "array" },
      },
    },
  },
  {
    name: "request_approval",
    description:
      "Approve or reject a plan that is waiting on a human decision, then optionally execute it.",
    inputSchema: {
      type: "object",
      properties: {
        planId: { type: "string" },
        approve: { type: "boolean" },
        decidedBy: { type: "string" },
        execute: { type: "boolean" },
      },
      required: ["planId", "approve"],
    },
  },
  {
    name: "get_audit_log",
    description: "Return the audit trail of previews, simulations, approvals and executions.",
    inputSchema: { type: "object", properties: {} },
  },
];

function ok(text: string): ToolContent {
  return { content: [{ type: "text", text }] };
}

function err(text: string): ToolContent {
  return { content: [{ type: "text", text }], isError: true };
}

function resolvePlan(params: Record<string, unknown>): Plan {
  const planId = typeof params.planId === "string" ? params.planId : undefined;
  if (planId) {
    const existing = plans.get(planId);
    if (!existing) throw new Error(`Unknown planId ${planId}. Preview or simulate a plan first.`);
    return existing;
  }
  const steps = params.steps as Array<{
    type: Action["type"];
    amount: number;
    counterpart: string;
    memo: string;
  }>;
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Provide planId or a non-empty steps array.");
  }
  const plan = createPlan(
    steps.map((step) => ({
      type: step.type,
      amount: step.amount,
      currency: "AUD",
      counterpart: step.counterpart,
      memo: step.memo,
    })),
  );
  plans.set(plan.id, plan);
  return plan;
}

function callTool(name: string, params: Record<string, unknown>): ToolContent {
  try {
    if (name === "preview_plan") {
      const plan = resolvePlan(params);
      const result = engine.preview(plan);
      return ok(
        JSON.stringify(
          { planId: plan.id, summary: result.summary, policy: result.policy },
          null,
          2,
        ),
      );
    }
    if (name === "simulate_plan") {
      const plan = resolvePlan(params);
      const result = engine.simulate(plan);
      return ok(
        JSON.stringify(
          { planId: plan.id, policy: result.policy, simulation: result.simulation },
          null,
          2,
        ),
      );
    }
    if (name === "request_approval") {
      const planId = String(params.planId);
      const plan = plans.get(planId);
      if (!plan) throw new Error(`Unknown planId ${planId}.`);
      if (params.approve) engine.approve(planId, String(params.decidedBy ?? "mcp-operator"));
      else engine.reject(planId, String(params.decidedBy ?? "mcp-operator"));
      if (params.execute && params.approve) {
        const simulated = engine.simulate(plan);
        const executed = engine.execute(plan, simulated.simulation, simulated.policy);
        return ok(JSON.stringify({ planId, ...executed }, null, 2));
      }
      return ok(JSON.stringify({ planId, state: engine.approvals.get(planId) }, null, 2));
    }
    if (name === "get_audit_log") {
      return ok(JSON.stringify(engine.audit.read(), null, 2));
    }
    return err(`Unknown tool: ${name}`);
  } catch (error) {
    return err(error instanceof Error ? error.message : String(error));
  }
}

function handle(message: RpcRequest): unknown {
  if (message.method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "governed-agent-demo", version: "0.1.0" },
      capabilities: { tools: {} },
    };
  }
  if (message.method === "notifications/initialized" || message.method?.startsWith("notifications/")) {
    return undefined;
  }
  if (message.method === "ping") return {};
  if (message.method === "tools/list") return { tools };
  if (message.method === "tools/call") {
    const params = (message.params ?? {}) as { name: string; arguments?: Record<string, unknown> };
    return callTool(params.name, params.arguments ?? {});
  }
  throw new Error(`Unsupported method: ${message.method}`);
}

function write(id: RpcRequest["id"], result?: unknown, error?: { code: number; message: string }) {
  if (id === undefined || id === null) return;
  const payload = error
    ? { jsonrpc: "2.0", id, error }
    : { jsonrpc: "2.0", id, result };
  stdout.write(JSON.stringify(payload) + "\n");
}

let buffer = "";
stdin.setEncoding("utf8");
stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let newline: number;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let message: RpcRequest;
    try {
      message = JSON.parse(line) as RpcRequest;
    } catch {
      continue;
    }
    try {
      const result = handle(message);
      if (result !== undefined) write(message.id, result);
    } catch (error) {
      write(message.id, undefined, {
        code: -32601,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

stdin.on("end", () => process.exit(0));
