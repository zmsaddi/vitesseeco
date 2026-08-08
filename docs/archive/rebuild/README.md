# Archive — the rebuild and its cutover

**Everything in this folder is a historical record. None of it is an instruction.**

These four documents drove the rebuild of the shop and its replacement of the
old `master`. That work finished: the cutover happened on **2026-07-30**, and
`origin/master` and `origin/rebuild` have pointed at the same commit ever since.

They are kept because they explain *why* the current system is shaped the way it
is, and because the cutover record lists which steps were taken, which were
deliberately not, and what only the owner can do. Nothing here was summarised
away.

They are archived because they are written in the present and future tense about
a state that has passed — "`master` stays deployable until this replaces it",
"The switch — each step is minutes, in this order" — and a reader who found them
first would act on a plan that has already been executed.

| Document | What it was for | Read it to learn |
|---|---|---|
| [REBUILD_ARCHITECTURE.md](REBUILD_ARCHITECTURE.md) | The contract the rebuild was written against | Why the invariants exist and what they replaced |
| [MASTER_REBUILD_PLAN.md](MASTER_REBUILD_PLAN.md) | Scope, markets, commercial intent | What was in and out of scope, and why |
| [REBUILD_EXECUTION.md](REBUILD_EXECUTION.md) | Unit-by-unit progress tracker | What was actually built, unit by unit |
| [CUTOVER.md](CUTOVER.md) | The acceptance gate for going live | What was provisioned, what was proven, and the steps deliberately left to the owner |

**For what is true now, read
[../../architecture/CURRENT.md](../../architecture/CURRENT.md).**

One item in CUTOVER.md is still open rather than done: making the Sanity dataset
private (§5, step 7). It is listed under "Known open" in the current-state
document.
