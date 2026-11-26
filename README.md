# Governed Agent Demo

A small, runnable example of an agent that cannot act until a plan has been previewed, simulated, and — when the amount is material — approved by a human.

Applied agentic AI fails in a business if it skips controls. This repo shows the control path: **plan → policy check → simulate → human approval → execute → audit receipt**, including a dollar cost limit.

This is not a production payments system and not a crypto or wallet project. It is a personal build from an AI career break, generalised into a business-operations scenario (customer refunds and campaign spend) with fictional counterparties.

## Controls

- **Tool allowlist** — only `refund`, `spend` and `notify` are permitted
- **Simulate-before-act** — a dry-run against a fictional ledger, with no funds moved
- **Human approval above a threshold** — amounts at or above A$500 need an operator decision
- **Cost / budget limit** — per-action (A$2,000), per-plan (A$3,000) and daily (A$5,000) caps
- **Immutable audit log** — JSON lines written under `audit/`

Policy lives in [`policy/example.json`](policy/example.json) and can be edited without changing code.

## Quick start

```bash
npm install
npm test
```

Preview a small goodwill refund (auto-approved, because it is under A$500):

```bash
npm run preview  -- --scenario refund-small
npm run run      -- --scenario refund-small
```

See a spend that is valid but needs a human:

```bash
npm run simulate -- --scenario spend-needs-approval
npm run run      -- --scenario spend-needs-approval
# exits 2, waiting for approval

npm run run      -- --scenario spend-needs-approval --approve
```

See policy block a spend that is too large, or a blocked counterpart:

```bash
npm run preview -- --scenario spend-over-cap
npm run preview -- --scenario blocked-counterpart
```

Read the audit trail:

```bash
npm run audit
```

## Scenarios

| Name | What it shows |
|---|---|
| `refund-small` | A$120 refund + a notification. Auto-approved after simulation. |
| `spend-needs-approval` | A$800 campaign spend. Valid, but held for a human. |
| `spend-over-cap` | A$4,500 spend. Blocked by the per-action cap. |
| `blocked-counterpart` | A counterpart on the deny list. Blocked before simulation matters. |

All names (`riverlane-coffee.example`, `northshore-media.example`) are fictional.

## MCP

The same engine is also exposed as a stdio MCP server:

```bash
npm run mcp
```

Tools:

- `preview_plan` — build a plan from steps and return the policy decision
- `simulate_plan` — dry-run a plan and write the simulation to the audit log
- `request_approval` — approve or reject a waiting plan, optionally execute it
- `get_audit_log` — read the audit trail

Example Cursor / Claude Desktop snippet:

```json
{
  "mcpServers": {
    "governed-agent-demo": {
      "command": "npx",
      "args": ["tsx", "src/mcp-server.ts"],
      "cwd": "/path/to/governed-agent-demo"
    }
  }
}
```

No API keys are required. The server speaks JSON-RPC 2.0, one message per line, on stdin/stdout.

## What this is not

- Not a production payments, CRM or banking integration
- Not a crypto, wallet, token or NFT project
- Not connected to any live customer or vendor system

## License

MIT. See [LICENSE](LICENSE).
