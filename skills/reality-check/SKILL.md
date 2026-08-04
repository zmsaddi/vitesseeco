---
name: reality-check
description: Use when finishing a feature, before declaring work done, before a release or cutover, or when the user asks why bugs keep appearing despite green tests. Builds a production-shaped local rig, simulates real usage, asserts the critical path in the datastore, and converts every defect found into an executable gate. Works for web apps, HTTP APIs, CLIs, libraries and data pipelines.
---

# Reality Check

## The one rule

**Green gates are evidence that the code agrees with itself. They are not evidence
that it works.**

A unit of work is not done when it compiles, typechecks, passes tests and builds.
It is done when it has been **run against production-shaped reality** and observed
doing the thing a real user pays for.

Everything below exists to make that sentence operational.

---

## Why green gates lie

Five structural reasons. Each one produced a real, expensive defect on a project
whose CI was fully green. Learn them as failure *modes*, not anecdotes.

**1. The same-author blind spot.** The person who wrote the wrong assumption into
the code writes the same wrong assumption into the test fixture. The test proves
internal consistency, not correctness.
> A catalogue parser expected `brand.name` to be a translated record. The fixture
> said the same. 144 products, zero rendered, tests green.

**2. Harness bypass.** The test rig connects to the resource *directly* instead of
through the production accessor — so the production accessor is never exercised.
> Eighty integration tests ran "against a real database" while opening their own
> connection. The production driver could only talk to one specific vendor's proxy.
> Nobody knew until it met an ordinary instance.

**3. Environment gap.** Dev configuration differs from prod in a way that makes a
whole class of defect *structurally unable to manifest locally*.
> Server-side rendering was enabled only on the deploy platform. Locally the app
> ran client-side, so no SSR defect — cookies, timezones, hydration — could ever
> appear before production.

**4. Field-of-view.** The check looks at the wrong set, and reports success on an
empty set.
> A style linter scanned a directory that no longer existed after a refactor. It
> printed "0 problems" for months.
> **Corollary: any scanner that scans zero inputs must FAIL, never pass.**

**5. The gate was never wired up.** The check exists, is committed, is described
in the README — and no pipeline invokes it.
> A ten-rule invariant gate ran only when someone typed the command by hand; CI
> never called it. Separately, a session-cleanup function was exported,
> documented in its job's own description, and called by nothing.
> **Corollary: "unused" and "unfinished" look identical in a diff. Whenever a
> tool reports something unused, ask whether it was supposed to be called.**

**6. The check cannot see.** Assertions measure structure — status codes, text,
counts — and are blind to what the page actually looks like.
> 114 page loads ran green through a browser simulator while the shop's entire
> design system was missing from the CSS bundle: every button transparent, every
> input a borderless white box on a white page. The functional layer was
> perfect. The paint was gone. Nothing asserted paint.
> **Corollary: some defect classes are invisible to assertions and obvious to
> eyes. Screenshot the critical journey and LOOK at the pictures.**

---

## Where the bugs actually are: the seam taxonomy

Serious defects almost never live inside a function. They live in **seams** — the
boundary between two systems where neither side can see the other. When hunting,
go straight to the seams.

| Seam | What breaks there | How to force it out |
|---|---|---|
| **code ↔ real data** | Field is a string where you assumed an object; nulls; unicode; empty collections; a shape only 3 of 10 000 records have | Run the parser over **production data**, not fixtures |
| **code ↔ real infrastructure** | Vendor-specific driver; connection pooling; TLS; a managed service's dialect | Boot a *plain* instance of the dependency and route production code at it |
| **server ↔ client** | Hydration mismatch; timezone (server UTC, user elsewhere); locale defaults; cookies not forwarded during server-side fetch | Run the **production build** locally with SSR on |
| **your host ↔ your other hosts** | Origin/CSRF allowlists that omit the platform alias, preview URL, or a second domain | Test from an origin that is *not* the primary domain |
| **build time ↔ run time** | Value baked at build, absent at runtime; stale build cache serving yesterday's bundle; **a build-tool input path that does not resolve and falls back silently** — utilities generated, the design system absent, nothing failed | Delete the build cache, rebuild from cold, then test — and **grep the built output for a sentinel from each critical layer** (a class name, a token, a version string) |
| **system ↔ system** | Webhook replay; a feed consumer that disapproves you for a mismatch; API version drift | Assert the *contract the other system checks*, not your intent |
| **the value you set ↔ the value stored** | A secret with an invisible trailing `\r` (a Windows shell pipe appends CRLF): auth headers rejected, HMAC signatures never matching — while the env listing shows the variable present and looking perfect | Round-trip it: read the stored value back and assert its **length** against the source; set secrets with `printf '%s'`, never an OS pipe |
| **now ↔ later** | Expiry, TTL, retry, cron schedules, clock skew, idempotency on replay | Assert timestamps and TTLs explicitly; replay the same event twice |
| **one actor ↔ another** | Authorisation: user A can read user B's record | Always walk the journey a **second time as a different identity** |
| **code ↔ its own documentation** | A README describing a layout that was replaced; an `.env.example` advertising keys nothing reads and omitting ones the app requires | Make the docs executable — check every path, command and variable named in prose |
| **assertions ↔ pixels** | Everything asserts true while the page is visually broken: invisible buttons, borderless inputs, anglophone number formats, a product listed twice — none of it is a status code | Screenshot every step of the critical journey, two viewports, and **look at the pictures with eyes**, yours or a vision model's |

---

## The workflow

Follow it in order. Do not skip phase 0 — it is the phase that decides whether
phases 2 and 3 can find anything at all.

### Phase 0 — Map the reality gaps (10 minutes, highest value)

Before writing any test, write down every way the environment you develop in
differs from the environment that serves users. Put the list in the repo
(`docs/reality-gaps.md`). For each gap decide: **close it, or simulate it.**

Ask exactly these:

- Does dev run the **same build mode** as production? (SSR/SSG/bundling/minification)
- Does dev use the **same kind** of datastore, or a substitute?
- Does dev talk to **real** third parties, or mocks?
- Does dev have the **same data**, or invented fixtures?
- Same **timezone**? Same **locale**? Same **clock**?
- Same **hostname/origin**? Are there aliases, previews, or extra domains?
- Same **env vars**? Which exist only in one place?
- Same **concurrency**? (one user locally vs many in production)

Anything you cannot close becomes an explicit item in the rig.

### Phase 1 — Build the rig

Make a local environment that is production-*shaped*. Three pieces, each a
committed script so the next person gets it free:

1. **Real dependencies, locally bootable.** Embedded/containerised database,
   queue, cache — the real engine, not a substitute with different semantics.
   *(Pattern: `templates/dev-infra.mjs`.)*
2. **Real data.** Pull a snapshot of production-shaped records. If the source is
   private, add an explicit, loud, opt-in flag for local reads — fail-closed by
   default. Never silently degrade.
3. **Test credentials for gated flows.** Most CAPTCHA/payment/SMS vendors publish
   sandbox keys that always succeed. Without them an automated walk stops at the
   first gate and the whole critical path stays untested forever.

Then **build and run exactly what production runs.** Not the dev server.

### Phase 2 — Simulate

Drive the software the way its consumer does, and record everything that would
have failed quietly. Not a happy-path e2e test — a sweep that is *suspicious by
default*.

Signals to catch (adapt to project type, see below):
- any 5xx, any uncaught exception, any console error
- untranslated/raw i18n keys reaching output
- a page/response that is technically 200 but effectively empty
- hydration or state mismatches
- a value that changes between two screens that must agree (price, total, count)
- missing metadata that a machine consumer requires
- a form/flow that cannot actually be completed

**Run it against the production build, cold cache, all locales/configurations.**

*(Pattern: `templates/simulate.mjs`.)*

**Then walk it with eyes.** The sweep above asserts structure and is blind to
paint: it once passed 114 page loads while every button on the shop was
transparent and every input borderless — the design system had silently missed
the bundle. So the critical journey also gets screenshotted step by step, on a
desktop AND a mobile viewport, and the pictures get **looked at** — by you, by a
vision model, by anyone with eyes. Judge what a stranger would judge:

- Is the primary action unmissable, above the fold, on both viewports?
- Do the numbers read correctly *for this locale* — "950,00 €", not "950.00 €"?
- Does anything look wrong that no assertion names — duplicate items, empty
  space where an image should be, a wireframe where a design should be?
- Capture friction facts while walking: clicks from landing to paid, form-field
  count, guest checkout possible, feedback after add-to-cart.

*(Pattern: `templates/ux-walk.mjs`.)*

### Phase 3 — Walk the critical path, and assert in the datastore

Identify the one journey where a defect costs *money or trust*, not ranking. Walk
it end to end and assert every step **in the database**, not in the UI. The UI can
show a success message while nothing was written.

For each step assert: the row exists · its status is right · the *derived*
numbers are right (totals, tax, stock) · the *side effects* happened (a
reservation, an audit entry, an outbox message) · and the **reversal** works
(cancel/refund/rollback returns the world to its prior state).

Finish by repeating a read **as a different identity** and asserting it is denied.

*(Pattern: `templates/critical-path.mjs`.)*

### Phase 4 — Convert every defect into an executable gate

A fix without a gate is a defect waiting to return under a new name. For each bug
found, ask: *what rule, if enforced mechanically, would have made this
impossible?* Write it as a check that runs in CI.

Two hard requirements, both learned the hard way:

- **Prove the gate by breaking the rule on purpose.** Confirm it fails. A gate
  never observed failing is not known to work.
- **Kill false positives immediately.** A gate that cries wolf is a gate someone
  disables — and then it protects nothing. Allow suppression only with a written
  reason, and print every suppression on every run so they stay visible.

*(Pattern: `templates/check-invariants.mjs`.)*

### Phase 5 — Clean up, and treat it as an inspection

A cleanup is not tidying. It is the cheapest inspection you will ever run, and on
a real codebase it finds defects nothing was looking for. The full method is in
[`references/dead-weight.md`](references/dead-weight.md); the three rules that
matter most:

- **Your hand-written dead-code scanner is wrong.** On one pass, four separate
  ones each reported findings and *all four were completely wrong* — dynamically
  built keys, a shelled-out command that fails silently on one OS, framework
  auto-registration, a package name that only ever appeared inside a URL. Use a
  real tool, configure it honestly, and **verify every candidate by hand before
  deleting**.
- **Unused often means unfinished.** Before deleting an unused export, grep the
  docs and job definitions for its name. Present in prose and absent from code is
  the signature of a feature that was built and never wired up.
- **Documentation is checked like code.** Every path, command and environment
  variable it names must exist — enforced, not remembered. See
  [`templates/verify-docs.mjs`](templates/verify-docs.mjs). Write docs *against*
  the code rather than from memory: on one rewrite, the act of verifying caught
  four false claims in the document being written to replace a false document.

### Phase 6 — Only now, say it is done

Report what you ran, what you found, and what you did **not** cover. "Tests pass"
is not a status. "I walked the purchase path against real data on a production
build; stock moved 5→3 on payment and back to 5 on cancellation" is.

---

## Applying this to different project types

The doctrine is constant; the surface changes.

**Web application** — simulate = headless browser over every page × every locale;
critical path = the transaction; datastore assertions on orders/stock/audit.
Seams: SSR↔client, host↔alias, server timezone↔user timezone.

**HTTP API / backend service** — simulate = call every documented endpoint with
valid, invalid, empty and hostile payloads; assert status codes, error *shapes*
and that no 500 is reachable from user input. Critical path = the write endpoints,
asserted in the store. Seams: auth boundaries, idempotency on replay, pagination
at the last page, concurrent writes.

**CLI tool** — simulate = run every subcommand and flag combination in a temp
directory; assert exit codes, stdout/stderr separation, and behaviour with no TTY,
no colour, no network, no config file, and a read-only filesystem. Seams: shell
quoting, path separators across OSes, locale-dependent formatting.

**Library / SDK** — simulate = consume the published artifact from a *separate*
throwaway project, not from inside the repo. This catches missing files in the
package, broken type declarations, and wrong entry points — the defects that only
ever appear to consumers. Seams: packaging, peer dependency versions, ESM↔CJS.

**Data pipeline / ETL** — simulate = run over a **production snapshot**, not
synthetic rows; assert record counts in and out, that no rows were silently
dropped, and that re-running is idempotent. Seams: schema drift, nulls, encodings,
timezone in timestamps, partial failure and resume.

**Mobile / desktop app** — simulate = the release build on a clean device profile,
with no network, slow network, and permissions denied. Seams: cold start, upgrade
from the previous installed version (**never test only a fresh install**).

---

## Standing rules for the agent

Apply these continuously, without being asked:

1. **Never report a feature complete without having run it.** If it could not be
   run, say exactly that and say why.
2. **Doubt your own instrument first.** When a check reports something surprising,
   verify the check before drawing a conclusion. Two comparisons that each fetch
   their own copy of a value can differ for reasons that have nothing to do with
   the code.
3. **A scanner that scanned nothing has failed.** Assert the input count.
4. **Test fixtures are a hypothesis.** At least once, validate the parser/consumer
   against real production-shaped data.
5. **Route test harnesses through production accessors.** Never open a private
   connection to the resource under test.
6. **Walk the reverse path.** Cancel, refund, delete, downgrade, roll back — the
   undo path is where money and data are actually lost.
7. **Walk it as a stranger.** Every journey gets repeated with a second identity
   that must be refused.
8. **Replay every external event twice.** Webhooks and retries are delivered more
   than once. Assert the second one changes nothing.
9. **Clear the build cache before trusting a build.** A warm cache can serve the
   previous bundle and hide a fatal error in the current source.
10. **Verify a documented fact before repeating it.** Write documentation against
    the code, with counts and paths a command can check. If a document is wrong,
    the document is the bug — fix it in the same commit.
11. **Never delete on a scanner's word.** Open the file, grep the symbol. Expect
    roughly half of any dead-code report to be false.
12. **Check dependencies in BOTH directions.** Declared-but-unused is dead weight;
    used-but-undeclared works only by your package manager's hoisting and breaks
    the day that changes.
13. **When something goes red mid-change, find out whose fault it is before
    diagnosing.** `git stash`, re-run, `git stash pop` — two seconds, and it
    replaces a guess with a fact. (And when *restoring* a file you broke on
    purpose, remember `git checkout --` reverts to HEAD — it also destroys any
    uncommitted fixes in that file. Verify the state after restoring.)
14. **When a gate blocks you, read its reason before reaching for a
    suppression.** The gate may be describing a hazard your new code genuinely
    has. One ban on server-side currency formatting existed because two ICU
    versions render the same price with different space characters — a silent
    hydration mismatch. The right fix normalised the character; a suppression
    would have shipped the hazard.
15. **Gates must ban outcomes, not mechanisms.** A rule against `Intl` currency
    calls was evaded by `toFixed(2)` — wrong format, no Intl anywhere. If the
    outcome you fear is "anglophone prices shown to French customers", write the
    rule against *displayed prices*, not against one API that produces them.
16. **Assert a sentinel in every built artifact.** A build input that fails to
    resolve can fall back silently; the build stays green while a whole layer is
    missing. After building, grep the output for one marker per critical layer —
    a component class, a design token, a version string.
17. **When the user asks "why do bugs keep appearing" — do not defend. Find the
    seam, name the phase that should have caught it, and close it.**

---

## Templates in this skill

Adapt, do not copy blindly. Each is a working starting point:

| File | Purpose |
|---|---|
| `templates/simulate.mjs` | Browser sweep: every page × locale, machine routes, purchase flow |
| `templates/ux-walk.mjs` | The funnel with eyes: screenshot per step, two viewports, friction ledger |
| `templates/critical-path.mjs` | Journey walker asserting in the datastore, with a second identity |
| `templates/check-invariants.mjs` | Project rule gate with reasoned suppressions |
| `templates/dev-infra.mjs` | Boot a real embedded PostgreSQL and apply migrations |
| `templates/contract-check.mjs` | Validate parsers against live production data shapes |
| `templates/verify-docs.mjs` | Documentation checked like code: paths, commands, env vars in both directions |

## References

| File | Read when |
|---|---|
| `references/seam-taxonomy.md` | Hunting: full catalogue of seams with real cases and probes |
| `references/reality-gaps.md` | Phase 0: the complete gap questionnaire per stack |
| `references/dead-weight.md` | Cleaning up: why your scanner lies, and why unused often means unfinished |
| `references/case-studies.md` | Convincing someone (or yourself) this matters |
