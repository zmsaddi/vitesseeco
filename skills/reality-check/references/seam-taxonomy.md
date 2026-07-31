# The seam taxonomy

Serious defects live at boundaries where neither side can see the other. This is
the hunting map: each seam, what fails there, and the probe that forces it out.

---

## 1. code ↔ real data

Your code has a mental model of the data. Production data has its own opinion.

**Failures**
- A field is a plain string where the schema-in-your-head says translated object
  (proper nouns are rarely translated: brand names, SKUs, author names).
- A field is absent on old records written before it existed.
- A collection is empty, or has exactly one element, or 10 000.
- Text contains the delimiter you split on, RTL marks, emoji, or a `null` byte.
- Sanity/CMS-style arrays carry internal keys (`_key`, `_type`) beside your data —
  a "return the first value you find" fallback can hand `h-0` to a user as text.
- Numbers arrive as strings; money as floats; dates as three different formats.

**Probes**
- Run the parser/validator over **every** production record, count rejects, and
  print the distinct reasons. Zero rejects or one reason is a suspiciously clean
  result — check you actually read the records.
- Assert the *count* of successfully parsed records, not just "no exception".
- Sort by rarity: find the records with the fewest fields populated and the most.

**Rule** — strict validation must **log every rejection loudly**. Silent dropping
turns a data-shape bug into an invisible one: the count says 144, the list shows 0.

---

## 2. code ↔ real infrastructure

**Failures**
- A vendor-specific driver that speaks the vendor's HTTP proxy, not the standard
  wire protocol — works in production, fails against any ordinary instance (and
  vice versa: works locally, fails in production).
- Connection limits, pool exhaustion, serverless cold starts.
- A managed service's SQL dialect differing on one function you rely on.
- File paths: `/` vs `\`, case-sensitivity (macOS forgives, Linux does not).

**Probes**
- Boot a *plain* instance of the dependency and point **production code** at it.
- Choose the driver by **what the URL actually is**, not by an env flag someone
  can forget to set.
- Run the test suite once with the connection routed through the production
  accessor, not a private one.

---

## 3. server ↔ client

**Failures**
- Hydration mismatch: server HTML ≠ first client render. Causes: `Date.now()`,
  random values, `localStorage` read during setup, locale-dependent formatting.
- **Timezone**: server in UTC, user in another zone → every date one day off for
  half the day. Formatting without an explicit `timeZone` is a latent bug.
- **Locale**: `toLocaleString(undefined, …)` uses the *runtime's* locale — English
  on the server, the user's in the browser. Always pass an explicit locale.
- Cookies not forwarded on a server-side fetch, so an authenticated call runs
  anonymously during SSR and the page renders logged-out then flips.

**Probes**
- Run the **production build** with SSR enabled locally; a dev server that renders
  client-only can never show these.
- Diff server HTML against the hydrated DOM for a few pages.
- Set the browser timezone and locale to something *different* from the server's.
- Load an authenticated page with a cold cache and no client-side navigation.

---

## 4. your host ↔ your other hosts

**Failures**
- CSRF/origin allowlists built from a static list that omits the platform alias,
  the preview deployment URL, or a second market domain. Every write returns 403
  on that host while the primary domain looks perfectly healthy.
- Cookie `domain`/`SameSite` scoped so it is absent on a subdomain.
- Absolute URLs hard-coded to one host, breaking canonical tags and redirects.
- CORS configured for the domain you remembered.

**Probes**
- Send a state-changing request with `Origin` set to each host that can serve the
  app: primary domain, platform alias, preview URL, every extra domain.
- **Compare against the request's own `Host` first** — same-origin means the
  request's own host, not membership in a list.

---

## 5. build time ↔ run time

**Failures**
- A value inlined at build (`process.env.X` in client code) that is absent or
  different at runtime.
- A **warm build cache** serving the previous bundle, hiding a fatal error in the
  current source. Three green builds can render a broken page.
- Tree-shaking removing something reached only dynamically.
- A generated artifact (migration snapshot, lockfile, schema) edited by hand and
  now out of sync with its generator.

**Probes**
- Delete the build cache and build from cold before trusting any build result.
- Grep the built output for values that must not be there (secrets) and for values
  that must (nonces, version strings).
- Regenerate all generated artifacts in CI and fail on any diff.

---

## 6. system ↔ system

**Failures**
- You publish a feed/API the other system validates by its own rules: a price in
  your feed that differs by one cent from the crawled page is *misrepresentation*
  and can suspend the account. Your intent is irrelevant; their check is the
  contract.
- A webhook delivered twice, out of order, or after the resource changed state.
- A file served both as a static asset and a dynamic route — the static one wins
  silently and serves stale content forever.
- API version drift; a scheduler that calls with a different HTTP method than you
  implemented (many cron platforms issue `GET`).

**Probes**
- Compare your published artifact **against the thing the other system will
  fetch** — feed price vs the rendered page price, for each variant.
- Replay every webhook twice and assert the second changes nothing.
- Assert *forward-only* state transitions: a redelivered payment event must not
  reset a shipped order.
- Check no static file shadows a server route of the same path.

---

## 7. now ↔ later

**Failures**
- A hold/reservation that never expires → stock permanently unsellable.
- A TTL that is right for one payment method and catastrophic for another
  (30 minutes for a card, useless for cash on delivery).
- A cron that never runs because the platform issues a method the handler rejects,
  or runs in UTC while the business thinks in local time.
- Retries that duplicate a side effect because the operation is not idempotent.
- Clock skew between two services.

**Probes**
- Assert TTLs explicitly (`expires_at > now() + interval '7 days'`), not just that
  a row exists.
- Run the scheduled job manually with the exact method and auth the scheduler uses.
- Execute the same request twice with the same idempotency key; assert one effect.
- Move the clock forward and assert the sweeper cleans up.

---

## 8. one actor ↔ another

**Failures**
- Authorisation checked in the UI but not the API.
- An identifier that is guessable, so a stranger can read another's record.
- An admin-only route protected by a route pattern that a slightly different path
  bypasses.
- Rate limits keyed on something the caller controls (a query string), so they
  never trigger.

**Probes**
- Every journey is walked a **second time as a different identity**, asserting a
  refusal. Prefer `404` over `403` for another user's resource — `403` confirms it
  exists.
- Call every admin endpoint with a normal user session; assert refusal on **every
  one**, not a sample.
- Key rate limits on the route path, never on caller-supplied input.

---

## 9. code ↔ its own documentation

The seam nobody instruments, because nothing breaks when it fails — it just costs
every newcomer an afternoon and teaches the team to stop trusting the docs.

**Failures**
- A README or project document describing a directory layout that a refactor
  replaced. One real case: seven of eight spot-checked paths did not exist.
- An `.env.example` advertising variables no code reads (whoever deploys goes
  hunting for credentials they do not need) and omitting variables the app
  requires (the deployment simply fails, and nothing says why).
- Documented commands that were renamed or deleted.
- Links between documents, broken the moment one is retired.
- A comment describing behaviour the function no longer has — worse than no
  comment, because it is believed.

**Probes**
- Make the docs executable: assert every path, command and environment variable
  named in prose actually exists. See `templates/verify-docs.mjs`.
- Check the environment example in **both directions**.
- Put verifiable counts in documents deliberately — "34 routes", "6 locales" —
  because a number a command can check is a number that stays true.
- Write documentation **against the code**, not from memory. The verification is
  the value: doing it caught four false claims in a document being written to
  replace a false document.

**Rule** — If a document is wrong, the document is the bug. Fix it in the same
commit as the code, and gate it in CI like anything else.

---

## 10. the check ↔ the thing it checks

The most embarrassing seam: your instrument is wrong and you trust it.

**Failures**
- A scanner whose input glob no longer matches anything, reporting success.
- Comparing two values fetched in two separate requests when each request
  legitimately produces a different value (a nonce, a token, a timestamp).
- A regex that normalises away the very difference it is meant to detect.
- A gate so noisy that it gets disabled — and then protects nothing.
- **A gate no pipeline invokes.** It exists, it is committed, it is described in
  the README, and CI never calls it.
- A shelled-out command that fails on one platform and returns nothing, which
  reads identically to "no matches found".
- A hand-written dead-code scanner. On one pass, four of them each reported
  findings and **all four were completely wrong** — dynamic key construction,
  framework auto-registration, a cross-platform command failure, and a package
  name that only ever appeared inside a URL string.

**Probes**
- **Break the rule on purpose** and confirm the gate fails. A gate never seen
  failing is not known to work.
- **Open the CI file and confirm the gate is listed there.** Writing a check and
  wiring it up are two separate acts, and only one of them is memorable.
- Assert the scanner's input count is non-zero and print it.
- Before reporting a surprising finding, re-derive it a second way.
- When something goes red mid-change, establish whose fault it is before
  diagnosing: `git stash`, re-run, `git stash pop`.

---

## 11. assertions ↔ pixels

Everything a check can assert is structure. Everything a customer judges is
paint. The two can diverge completely: 114 page loads once ran green — no 5xx,
no raw keys, no hydration mismatch — while every button on the site was
transparent and every form input a borderless white box. The design system had
silently missed the CSS bundle. Functionally perfect; visually a wireframe.

**Failures**
- A build-tool fallback drops a styling layer; utilities survive, so the page
  still *works* and nothing measurable is missing.
- Number, date and currency formats correct in structure and wrong for the
  locale: "950.00 €" with a dot, English month names, LTR punctuation in RTL.
- The primary call-to-action below the fold on mobile, or visually
  indistinguishable from body text.
- Duplicate records rendering as two identical cards side by side.
- An image slot rendering as empty space; a layout collapsing at one viewport.

**Probes**
- Screenshot every step of the critical journey — landing, listing, detail,
  add, basket, checkout — on a desktop AND a mobile viewport, and **look at
  the pictures**. Eyes, human or vision-model, are the only instrument this
  seam has.
- While walking, record friction facts: clicks from landing to paid, visible
  form fields, guest checkout possible, feedback after add-to-cart, primary
  CTA above the fold.
- Grep the built CSS/JS for a sentinel from each critical layer — a component
  class, a design token — so a silent build fallback fails loudly.
- Render one price, one date and one plural in every locale and read them.

**Rule** — the screenshots are the deliverable, the metrics are the appendix.
A funnel that has never been *looked at* has never been checked.
