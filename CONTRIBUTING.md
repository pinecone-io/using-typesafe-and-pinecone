# Contributing

Thanks for wanting to add something here. This repo collects examples of using Pinecone and
TypeSafe together, and we'd love more of them.

## Open an issue first

**Please open an issue before you open a pull request.** For a new example that saves you building
something we've already got in flight, or that we'd want shaped differently. For a change to an
existing example it lets us agree on the approach before you write code.

- **Requesting an example** — tell us the retrieval problem and the judgment you want on top of it.
  You don't need to build it; a good request is useful on its own.
- **Proposing an example** — say what it shows that the existing ones don't.
- **Reporting a bug** — include the example name, what you ran, and what happened.

We may reject pull requests that are created without issues!

## Pull requests

Every change reaches `main` through a pull request, and every pull request needs a review from
[@arjunpatel7](https://github.com/arjunpatel7) before it merges.
Before you open one:

```bash
node scripts/check-examples.mjs   # repo conventions

cd examples/<example>
npm run check                     # typecheck, lint, format, tests — no credits spent
npm run build
```

CI runs both on every pull request. Keep them green.

In the PR description, link the issue, say what you changed, and note anything you measured.

## Adding a new example

**_Be sure to first open an issue and wait for a maintainer to review before adding a new example!_

1. Create `examples/<your-example>/` with its own `package.json`. Examples are self-contained and
   don't import from each other.
2. Read API keys from the repo-root `.env`. Add any new variable to `.env.example` and to the
   table in the root `README.md`.
3. Provide the same scripts the existing example does, so CI and contributors find what they
   expect: `check`, `build`, `test`, `typecheck`, `lint`, `format`.
4. Add a `README.md` so clicking into the directory lands somewhere.
5. Add a section to the root `README.md`.

CI discovers examples automatically — any directory under `examples/` with a `package.json` gets
its own job. There is no list to update.

Check your example follows the conventions before pushing:

```bash
node scripts/check-examples.mjs
```

It verifies the required scripts, exactly pinned dependencies, a committed lockfile, and a README. 6. Add a demo gif if possible! We have a skill that can help with this in the repo!

## House rules

**Pin your dependencies exactly.** No `^` or `~`. Examples should still build a year from now.

**Tests must not spend credits.** Everything `npm run check` runs is offline. Keep anything that
calls a paid API in a script someone runs deliberately, not in the test suite.

**Don't commit keys.** `.env` is gitignored; `.env.example` holds the variable names only.

**Quote numbers you measured.** If you claim a latency or a cost, say how you got it. Provider
pricing moves, so cite the source and the date next to the constant.

**Comments earn their place.** Write them for a non-obvious _why_ — a constraint you hit, a
decision that looks wrong until explained. Skip the ones that restate the code.
