# Documentation index

Start with **[architecture/CURRENT.md](architecture/CURRENT.md)**. It is the one
document that describes the system as it stands, and it wins over anything that
disagrees with it.

## Current

| Document | Owns | Read it when |
|---|---|---|
| [architecture/CURRENT.md](architecture/CURRENT.md) | What is true right now: deployment, pipeline, data ownership, invariants, known-open | Before any structural change, and whenever you are not sure what ships |
| [FRONTEND_MOBILE_FIRST_AUDIT_AND_PLAN.md](FRONTEND_MOBILE_FIRST_AUDIT_AND_PLAN.md) | Evidence-backed frontend findings and the WP0–WP8 mobile-first acceptance contract | Planning or executing frontend work |
| [OWNER_ACCOUNTS_PLAYBOOK.md](OWNER_ACCOUNTS_PLAYBOOK.md) | The external-accounts session, step by step (Arabic) | Sitting down with the owner |
| [MARKETING_SESSION.md](MARKETING_SESSION.md) | The marketing working session | Picking up marketing work |
| [adr/](adr/) | Decisions and their reasoning, permanent | Wondering why something is the way it is |

The rules to follow while coding live in [../CLAUDE.md](../CLAUDE.md), not here.
CURRENT.md describes the system; CLAUDE.md tells you how to behave inside it.

## Archive

[archive/rebuild/](archive/rebuild/) holds the four documents that drove the
rebuild and its cutover. They are history: each is written in the present or
future tense about a state that passed on 2026-07-30, and each now carries a
banner saying so. They are kept because they explain why the current system is
shaped as it is — and because the cutover record lists what was deliberately
left undone.

## Method

[`skills/reality-check/`](../skills/reality-check/) is a portable skill holding
the working method: nothing is done until it has been run against
production-shaped reality, where defects actually live, and the harnesses that
find them. It is written to be copied into other projects, and its case studies
are drawn from this one.

## Retired

Four documents were removed on 2026-07-30 rather than left to rot. Git history
has them in full; nothing was summarised away that is still true.

| Removed | Why |
|---|---|
| `EXPERIENCE_RECONSTRUCTION_PLAN.md` | Declared itself superseded by the master rebuild plan, "kept for history only" |
| `PRODUCTION_UPGRADE_PLAN.md` | A backlog against the old `master`'s code. Eight of its ten security items are structural in the rebuild, one is moot, and the one still open — password reset — is in the cutover record |
| `known-issues-post-pg-primary.md` | All four issues fixed; the pipeline it describes is how the rebuild works by construction |
| `runbooks/pg-primary-activation.md` | A runbook for flipping `ENABLE_PG_PRIMARY_ORDERS`, a flag that does not exist here — PostgreSQL is primary with no alternative to switch from |
