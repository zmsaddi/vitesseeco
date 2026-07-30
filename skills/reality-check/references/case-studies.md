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

## What the pattern says

Ten defects. Zero found by reading code. Zero found by unit tests. Zero found by
type checking. Two found by adversarial review; the other eight needed **real data,
a real database, a production build, or a second host**.

Two hours of simulation against production-shaped reality found what seven hundred
tool calls of careful reading did not.
