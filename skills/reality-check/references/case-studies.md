# Case studies

Real defects from a production e-commerce rebuild. Every one of them survived
typecheck, unit tests, integration tests, a full build, CI, and more than one
adversarial code review. Each was found by **running the thing**.

Use these to calibrate: this is what "green but broken" looks like.

---

## 1. The shop that sold nothing (seam: code ↔ real data)

**Symptom** — `/api/catalog/products` answered `200` with `{"items": [], "total": 144}`.

**Cause** — The parser declared `brand.name` as a translated record. In the live
dataset brands are plain strings, because brands are proper nouns and are not
translated. Strict validation rejected every branded product and logged it at
debug level. The count came from a separate query, so the totals looked right.

**Why nothing caught it** — The test fixture was written by the same author, with
the same assumption. Category names *are* translated, which made the wrong shape
feel obviously correct.

**Gate added** — Parse the whole production catalogue in CI and assert the parsed
count equals the source count.

---

## 2. Every product page returned 404 (seam: code ↔ real data, deeper)

**Symptom** — The listing rendered perfectly. Every single product page 404'd.

**Cause** — Same class as #1, on `seo.title` and `seo.description`. The listing's
projection does not select `seo`, so the summary parser never saw the field —
only the detail parser did. **A partial fix looked like a complete one.**

**Lesson** — When a data-shape bug is found, audit **every** field of that record
against real data, not only the field that failed. And check each projection
separately; they select different subsets.

---

## 3. 403 on the live alias (seam: your host ↔ your other hosts)

**Symptom** — None, on the primary domain. On the platform alias — which was live
and receiving traffic — pricing a basket, logging in and checking out all failed.

**Cause** — Same-origin was verified against a static allowlist. The platform's
`VERCEL_URL` variable holds the *unique deployment* URL, never the stable alias, so
the alias was in no list.

**Fix** — Compare `Origin` against the request's own `Host` **first**; the list
remains only for genuinely cross-domain siblings.

**Lesson** — "Same origin" means the request's own host. A list is an optimisation,
not the definition.

---

## 4. The driver that could only talk to one vendor (seam: code ↔ infrastructure)

**Symptom** — Every query failed against a locally booted PostgreSQL.

**Cause** — The serverless HTTP driver speaks the vendor's proxy protocol, not the
PostgreSQL wire protocol.

**Why nothing caught it** — Eighty integration tests ran "against a real database"
— but the harness opened its **own** connection instead of going through the
production accessor. The production connection path had never been executed by a
test.

**Rule** — Test harnesses must route through the production accessor.

---

## 5. Three green builds, every page broken (seam: build ↔ run time)

**Symptom** — Every page rendered raw translation keys instead of text.

**Cause** — A bare `@` in a locale message. In vue-i18n `@` is the linked-message
operator; it aborts the production build. **A warm build cache served the previous
bundle**, so the build reported success three times while the source was fatal.

**Rule** — Clear the build cache before trusting a build. Never conclude "it
builds" from a cached run.

---

## 6. The linter that scanned nothing (seam: the check ↔ the thing checked)

**Symptom** — "✅ No raw hex colors" for months.

**Cause** — A refactor moved source into a new directory. The scanner's roots
pointed at the old layout. It scanned **zero files** and passed.

**Rule** — Any scanner that scans zero inputs must **fail**. Print the input count
on every run.

---

## 7. €0.00 published to the storefront (seam: input ↔ validation)

**Symptom** — Clearing the price field in the admin published the product at zero.

**Cause** — `Number('') === 0`, and `0` passed every "is it a valid number" guard.

**Rule** — Blank is not zero. Parse blank to `null` at the boundary **and** require
positivity in the schema. Fix at both layers; either alone is one refactor away
from failing again.

---

## 8. Stock held forever (seam: now ↔ later)

**Symptom** — Nothing, for thirty minutes. Then unsellable inventory.

**Cause** — Cash-on-delivery orders took the same 30-minute reservation TTL as card
payments, then expired — while the order was still legitimately awaiting a driver.
Meanwhile the *paid* transition for cash never decremented stock at all: cash sales
were invisible to inventory.

**Rule** — Assert TTLs explicitly and per payment method. Assert the shelf count
moves, and moves **back** on cancellation.

---

## 9. Every date a day off (seam: server ↔ client)

**Symptom** — Order dates differed between the confirmation email and the account
page, for part of each day.

**Cause** — The platform runs in UTC; the business is in Paris. Formatting used the
runtime's timezone, and `toLocaleDateString(undefined, …)` also produced **English**
month names on the server.

**Rule** — Every date format call pins an explicit locale **and** an explicit
timezone. Enforced by a gate.

---

## 10. Checkout with no address fields (seam: process, not code)

**Symptom** — The checkout page could not collect an address. It was impossible to
buy anything.

**Cause** — The page was declared complete without ever being opened.

**Rule** — This is the whole doctrine in one line: **nothing is done until it has
been run.**

---

## 11. The documentation described a different project (seam: code ↔ its docs)

**Symptom** — None, ever. That is the point.

**Cause** — The main project document described a directory layout that a rebuild
had replaced entirely: root-level page, component and store directories, a state
library no longer used, scripts long deleted. **Seven of eight spot-checked paths
did not exist.** The `.env.example` was worse: it advertised keys for two payment
providers and an email service that no code read, while omitting five variables
the application genuinely required.

**Cost** — Every newcomer, human or machine, starts from a false map. A wrong
`.env.example` is a deployment that fails with no explanation.

**Rule** — Documentation is checked like code. Every path, command and variable it
names must exist, enforced in CI. And write it *against* the code: the act of
verifying while writing caught four false claims in the document being written to
replace the false one.

---

## 12. Four dead-code scanners, four wrong answers (seam: the check ↔ the checked)

**Symptom** — A cleanup pass reported: three unused composables, 57 unused
translation keys, 280 unused exports, one unused dependency.

**Truth** — The composables were used in seven, eleven and one files. Every
translation key was built dynamically: `` t(`privacy.data_${category}_title`) ``.
The 280 exports came from a shelled-out `git grep` that fails on Windows and
returns nothing, which reads exactly like "no usages". The dependency's name only
ever appeared *inside a URL string*.

**Rule** — Use a real tool. Verify every candidate by hand. Delete nothing on a
scanner's word alone. Expect roughly half of any dead-code report to be false.

---

## 13. The cleanup found a bug nobody was looking for (unused ≠ dead)

**Symptom** — A dead-code tool listed a session-cleanup function as an unused
export.

**Cause** — It was not obsolete. It was **never wired up**: exported, named in the
scheduled job's own description, and called by nothing. Expired session rows had
been accumulating for the lifetime of the application. Its `limit` parameter was
decorative too — the delete was unbounded and it reported a smaller number than it
had actually removed.

**And then** — Wiring it in broke nine integration tests, which was the tests
doing their job: the function reached for its own database connection instead of
the injected one, so it could not be driven by a test at all. One "unused export"
yielded three defects.

**Rule** — When a tool says unused, ask whether something was *supposed* to call
it. Grep the docs, the comments, the job definitions. Present in prose and absent
from code is the signature of an unfinished wire.

---

## 14. The gate CI never ran

**Symptom** — Ten invariant rules, written after ten real defects, each proved by
breaking it on purpose. Fully green. And the pipeline never invoked any of them —
they ran only when someone typed the command by hand.

**Rule** — A gate nothing calls protects nothing. After writing a check, open the
CI file and confirm it is listed there. This is the same defect class as #13,
wearing different clothes.

---

## What the pattern says

Fourteen defects. Zero found by reading code. Zero found by unit tests. Zero found
by type checking. Two found by adversarial review; the rest needed **real data, a
real database, a production build, a second host — or a cleanup pass that treated
deletion as an inspection**.

Two hours of simulation against production-shaped reality found what seven hundred
tool calls of careful reading did not. A cleanup that was only supposed to remove
dead weight found three more.
