# Documentation index

Five documents, each with one job. If a fact appears in two of them, the one
named here as the owner wins.

| Document | Owns | Read it when |
|---|---|---|
| [REBUILD_ARCHITECTURE.md](REBUILD_ARCHITECTURE.md) | The invariants and boundaries of the code | Before writing anything on this branch |
| [MASTER_REBUILD_PLAN.md](MASTER_REBUILD_PLAN.md) | Scope, markets, commercial intent | Deciding whether something is in scope |
| [REBUILD_EXECUTION.md](REBUILD_EXECUTION.md) | Unit-by-unit status — what is actually done | Picking up work |
| [CUTOVER.md](CUTOVER.md) | The gate for replacing `master`, and what only the owner can do | Preparing to go live |
| [OWNER_ACCOUNTS_PLAYBOOK.md](OWNER_ACCOUNTS_PLAYBOOK.md) | The external-accounts session, step by step (Arabic) | Sitting down with the owner |
| [adr/](adr/) | Decisions and their reasoning, permanent | Wondering why something is the way it is |

The project-wide facts — structure, commands, hard rules — live in
[../CLAUDE.md](../CLAUDE.md), not here.

## Method

[`skills/reality-check/`](../skills/reality-check/) is a portable skill holding the
working method: nothing is done until it has been run against production-shaped
reality, where defects actually live, and the harnesses that find them. It is
written to be copied into other projects, and its case studies are drawn from
this one.

## Retired

Four documents were removed on 2026-07-30 rather than left to rot. Git history
has them in full; nothing was summarised away that is still true.

| Removed | Why |
|---|---|
| `EXPERIENCE_RECONSTRUCTION_PLAN.md` | Declared itself superseded by the master rebuild plan, "kept for history only" |
| `PRODUCTION_UPGRADE_PLAN.md` | A backlog against `master`'s code. Eight of its ten security items are structural in the rebuild, one is moot (no address-autocomplete proxy exists here), and the one still open — password reset — is in CUTOVER.md. Its launch checklist is now CUTOVER.md §3–4. |
| `known-issues-post-pg-primary.md` | All four issues fixed; the pipeline it describes is how the rebuild works by construction |
| `runbooks/pg-primary-activation.md` | A runbook for flipping `ENABLE_PG_PRIMARY_ORDERS`, a flag that does not exist on this branch — PostgreSQL is primary with no alternative to switch from |
