# Removing dead weight without breaking things

A cleanup is not tidying. It is an **inspection that happens to delete things** —
and on a real project it will surface defects that no test was looking for.
Everything below was learned deleting things from a live codebase.

---

## The first rule: your scanner is wrong

On one cleanup pass, four separate hand-written "find the dead code" scripts each
reported findings. **All four were wrong.** Not partially — completely.

| What the scanner said | What was actually true |
|---|---|
| 3 composables never referenced | Used in 7, 11 and 1 files respectively |
| 57 translation keys unused | Every one built dynamically: `` t(`privacy.data_${category}_title`) `` |
| 280 exports never used | `git grep` inside the script failed on this OS; every result was an empty search |
| A dependency in use | Its name only ever appeared **inside a URL string** (`oauth2.googleapis.com`) |

The lesson is not "be careful". It is procedural:

1. **Use a real tool** — `knip`, `ts-prune`, `depcheck`, `vulture`, `deadcode`,
   whatever your ecosystem's is. They understand module resolution, re-exports
   and framework conventions. Yours does not.
2. **Configure it once, honestly.** An unconfigured tool drowns you in
   framework-convention noise and you stop reading it. A tool with stale ignores
   hides real findings. Both are the same failure.
3. **Verify every single candidate by hand before deleting.** Open the file. Grep
   the symbol. A verified deletion is cheap; an unverified one is a debugging
   session next month.
4. **Never delete on a scanner's word alone.** Not once.

### Why static analysis specifically fails

- **Dynamic construction.** `` t(`ns.${key}_title`) ``, `require(path)`,
  `getattr(obj, name)`, reflection, DI containers. The string never appears whole.
- **Convention-based frameworks.** Nuxt, Next, Rails, Spring: files in the right
  directory are registered by *location*, so nothing imports them and everything
  looks dead.
- **Multi-app repositories.** A studio, a mobile app, a functions directory — each
  with its own manifest. A root-level scan calls all of it unused.
- **Name collisions.** A package name inside a URL, a comment, or unrelated prose.
- **Platform differences.** A shelled-out command that fails silently returns "no
  matches", which reads exactly like "nothing uses this".

---

## The second rule: unused often means unfinished

This is the part that turns a cleanup into a bug hunt.

When a tool says *"this export is never used"*, there are three possibilities,
and only the first is dead code:

| | Reading | What to do |
|---|---|---|
| 1 | Genuinely obsolete — its caller was removed | Delete it |
| 2 | **A feature that was never wired up** | **Fix it. This is a bug.** |
| 3 | A public API of a library, used by consumers you cannot see | Keep, and say so |

Case 2 is common and expensive. A real example: `pruneExpiredSessions` existed,
was exported, was **named in the scheduled job's own documentation**, and had no
caller anywhere. Expired session rows had been accumulating for the lifetime of
the application. The dead-code tool found an operational defect, not dead code.

**So before deleting any unused export, ask: was something supposed to call
this?** Grep the docs, the comments, the config, the job definitions. The name
appearing in prose while absent from code is the signature of an unfinished wire.

---

## The third rule: deletion is a change, so verify like one

A cleanup commit that "only removes things" still needs the full gate. Two
findings from one pass:

**Removing an unused export broke nine tests** — which was the tests doing their
job. The removal was fine; wiring the *unwired* function in was what broke them,
because that function reached for its own database connection instead of the
injected one. The failure revealed a second, deeper defect: a service that cannot
be driven by a test. Both were real. Neither was visible before.

**Is this failure mine?** When something goes red mid-cleanup, find out before
diagnosing:

```bash
git stash && <run the failing thing>   # green here means you broke it
git stash pop
```

Two seconds, and it replaces a guess with a fact.

---

## Dependencies

Run in both directions. Most people only run one.

**Declared but unused** — dead weight, install time, attack surface. Verify each:
the name may appear only inside a string, a URL, or a comment.

**Used but undeclared** — the dangerous direction, and the one most tools report
last. A package imported by dozens of files while nothing declares it is working
purely by your package manager's hoisting. Change the manager, change the
version, run a stricter install mode, and every one of those files breaks at once.
Declare it.

```bash
npx knip            # both directions, JS/TS
npx depcheck        # declared-but-unused only
pip install deptry && deptry .   # Python, both directions
cargo +nightly udeps             # Rust
```

---

## What "clean" actually means

Not "small". A cleanup is finished when each of these is true and *checked*:

- [ ] Every file is reachable from an entry point, or is itself one
- [ ] Every declared dependency is imported; every imported package is declared
- [ ] Every exported symbol has a caller, is a deliberate public API, or was a
      **bug you just fixed**
- [ ] Every translation key is reachable — including the dynamically built ones
- [ ] Every documented path, command and variable exists (see
      [`templates/verify-docs.mjs`](../templates/verify-docs.mjs))
- [ ] Every environment variable in the example file is read by code, and every
      variable code reads is in the example file
- [ ] The dead-code tool is configured and reports **nothing**, so the next run
      is meaningful
- [ ] Full gate green from a **cold** build

---

## Order of operations

Do it in this order; each step makes the next cheaper and safer.

1. **Inventory** — what exists, how big, when last touched
2. **Real tool, configured** — get the candidate list from something that
   understands your module system
3. **Verify every candidate by hand** — expect roughly half to be false
4. **Triage the survivors** — obsolete (delete) vs unwired (fix) vs public (keep)
5. **Dependencies, both directions**
6. **Documentation last** — it is the part most likely to be wrong, and writing
   it against the verified code catches the last mistakes
7. **Full gate, cold build, then commit** — with what you deleted and *why* in the
   message, because a deletion's reasoning is invisible in the diff
