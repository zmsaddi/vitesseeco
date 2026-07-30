# Phase 0 — the reality-gap questionnaire

Fill this in **before** writing tests. Every unclosed gap is a class of defect that
cannot appear locally, which means it will first appear to a user.

Write the answers into `docs/reality-gaps.md` in the project and keep it current.
For each gap choose one: **CLOSE** (make dev match prod) or **SIMULATE** (build the
rig piece that fakes it faithfully) or **ACCEPT** (state the risk explicitly).

---

## Universal questions

| # | Question | Why it matters |
|---|---|---|
| 1 | Does dev run the **same build** as prod? (minified, bundled, SSR/SSG mode) | A different render mode makes a whole defect class impossible locally |
| 2 | Is the **datastore the same engine**, same major version? | Dialects, drivers, transaction semantics differ |
| 3 | Is the **data real** or invented? | Fixtures encode your assumptions; real data does not |
| 4 | Are third parties **real, sandboxed, or mocked**? | Mocks agree with you by construction |
| 5 | Same **timezone**? Same **locale**? Same **clock**? | Server UTC + user elsewhere = off-by-one-day everywhere |
| 6 | Same **hostname**? Any aliases, previews, extra domains? | Origin/CSRF/cookie/CORS logic is host-sensitive |
| 7 | Which **env vars exist in only one** environment? | Absent at runtime ≠ absent at build |
| 8 | Same **concurrency**? | One local user never reproduces a race |
| 9 | Same **network conditions**? Latency, failures, timeouts | Everything succeeds instantly on localhost |
| 10 | Same **identity model**? Are you always logged in as an admin locally? | Authorisation bugs hide behind a privileged session |
| 11 | Is there a **CAPTCHA / MFA / payment gate** blocking automation? | If yes, get the vendor's sandbox keys or the critical path stays untested forever |
| 12 | Does the **upgrade path** get tested, or only fresh installs? | Migration and upgrade defects only hit existing users |

---

## Per stack

### Web application
- SSR/SSG enabled locally? Service worker registered? HTTP/2? Compression?
- Content Security Policy applied locally, or only in production? *(A CSP with
  `strict-dynamic` that is only active in prod will block every script there.)*
- Are you testing all locales, or only your own?
- Real image/CDN pipeline, or raw local files?

### HTTP API / service
- Same auth middleware chain locally? Same rate limits (or disabled)?
- Are error responses the same **shape** in both environments? (Stack traces leak
  in dev; the shape consumers parse must be identical.)
- Same body-size limits, timeouts, and proxy in front?

### CLI
- Tested with **no TTY**, piped stdout, `NO_COLOR`, no network, no config file,
  read-only filesystem, and a path containing spaces and non-ASCII?
- Tested on every OS you claim to support? Path separators and line endings.

### Library / SDK
- Do you test the **published artifact** from a separate project, or the source
  from inside the repo? Only the former catches missing files, wrong entry points
  and broken type declarations.
- ESM and CJS consumers both? Minimum supported runtime version?

### Data pipeline
- Run over a **production snapshot**, with real volume?
- Is re-running idempotent? What happens on partial failure and resume?
- Schema drift: what happens when a source column changes type or disappears?

### Mobile / desktop
- Release build, clean device profile, and **upgrade from the previous installed
  version** — not only a fresh install.
- Permissions denied, offline, low storage, background-killed mid-flow.

---

## The output

A short table, committed:

```markdown
| Gap | Reality | Decision |
|---|---|---|
| SSR only on the deploy platform | Local runs client-only | SIMULATE: `npm run sim` builds and serves the prod build |
| Managed database vendor | Local has none | CLOSE: `scripts/dev-infra.mjs` boots a real embedded instance |
| CAPTCHA on checkout | Blocks automation | CLOSE: vendor sandbox keys in the sim env |
| Payment provider | Live only | ACCEPT: adapter contract-tested; live smoke test at cutover |
```

Then build the rig for every SIMULATE and CLOSE row.
