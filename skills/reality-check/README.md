# reality-check — installation

A portable skill that stops "green tests, broken product". Works for web apps,
HTTP APIs, CLIs, libraries and data pipelines.

## What it does

Teaches the agent to treat a feature as unfinished until it has been **run against
production-shaped reality**, gives it a map of where bugs actually live (the seams
between systems), and ships five working templates: a browser simulator, a
critical-path walker that asserts in the datastore, an invariant gate, a local
real-database booter, and a contract check that validates parsers against live
data.

## Install for Claude Code

**Personal — available in every project on this machine:**

```bash
cp -r skills/reality-check ~/.claude/skills/
```

```powershell
Copy-Item -Recurse skills\reality-check "$env:USERPROFILE\.claude\skills\"
```

**One project only — shared with the team through git:**

```bash
mkdir -p .claude/skills && cp -r skills/reality-check .claude/skills/
```

Restart Claude Code. Confirm with `/reality-check`, or just ask
*"is this feature actually done?"* — the description makes it trigger on its own
when finishing work, before a release, or when someone asks why bugs keep
appearing despite green tests.

## Install for Claude (claude.ai)

Settings → Capabilities → Skills → **Upload skill**, and upload the
`reality-check` folder zipped (`SKILL.md` must be at its root).

```bash
cd skills && zip -r reality-check.zip reality-check
```

## Using it on a new project

1. Ask for **phase 0** first: *"map the reality gaps for this project"* →
   produces `docs/reality-gaps.md`. This is the highest-value ten minutes; it
   decides whether the later phases can find anything at all.
2. Copy the templates you need out of `templates/` and adapt the CONFIG block at
   the top of each.
3. Wire `check-invariants` and `simulate` into CI.
4. From then on, every defect found becomes a new rule in `check-invariants` —
   **proved by breaking it on purpose once.**

## Files

```
reality-check/
├── SKILL.md                        the doctrine and the five-phase workflow
├── references/
│   ├── seam-taxonomy.md            where bugs live, with probes for each seam
│   ├── reality-gaps.md             the phase-0 questionnaire, per stack
│   └── case-studies.md             ten real green-but-broken defects
└── templates/
    ├── simulate.mjs                browser sweep: pages × locales, machine routes, purchase
    ├── critical-path.mjs           journey walker asserting in the datastore
    ├── check-invariants.mjs        project rule gate with reasoned suppressions
    ├── dev-infra.mjs               boot a real embedded PostgreSQL + migrations
    └── contract-check.mjs          parsers vs live production data, with a shape census
```

## Origin

Distilled from a production e-commerce rebuild where ten serious defects — a shop
that rendered zero of 144 products, every product page returning 404, every write
failing with 403 on the live platform alias, stock that never moved on cash sales
— all survived typecheck, unit tests, integration tests, a full build, CI and more
than one adversarial code review. Every one was found by running the thing against
real data. See `references/case-studies.md`.
