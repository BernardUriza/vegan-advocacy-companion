# Git hooks

Version-controlled hooks for this repo. They are **not** installed automatically —
`.git/hooks` is local/per-clone and never committed, so each clone opts in once.

## `pre-commit`

Runs `node scripts/validate-data.mjs` and **blocks the commit** if the JSON data
layer (`data/{actors,tactics,frameworks}.json`) fails integrity validation
(undefined tactic refs, duplicate ids, missing required fields, broken
bidirectional links, etc.).

## Install (pick one)

### Option A — point git at this directory (recommended)

```sh
git config core.hooksPath scripts/hooks
```

One command, picks up every hook in `scripts/hooks/` and any future ones. To
revert: `git config --unset core.hooksPath`.

### Option B — symlink the single hook into `.git/hooks`

```sh
ln -sf ../../scripts/hooks/pre-commit .git/hooks/pre-commit
```

The relative path is resolved from inside `.git/hooks/`, so it points back at
`scripts/hooks/pre-commit`. Re-running it after edits is unnecessary — the symlink
always reads the current file.

## Bypass (when you know what you're doing)

```sh
git commit --no-verify
```
