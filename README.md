# 🌱 Vegan Advocacy Companion

A companion for **high-volume vegan debate** in Facebook groups (think "Vegans
V's Meat Eaters"). It's not a toy assistant: it runs a **4-stage pipeline,
battle-tested in production**, that takes you from a Facebook notification to a
posted and verified reply — written to reach the **casual lurker**, not to win
against the troll.

> **What's the product and what's the prototype.** The **4-stage pipeline built
> on `scripts/fb-lib.mjs`** is what gets used daily and what **actually
> delivers** (comments posted, debates won in front of the gallery, longitudinal
> memory of the people involved). The Chrome extension + Azure backend that also
> lives in this repo was the **original prototype** — it stays here for
> reference, but it's not the live product. See
> [Original prototype](#original-prototype--roadmap).

---

## The pipeline that works — 4 stages

This is the canonical flow. Each stage has its own GOLDEN PATH (selectors,
gotchas and verification already paid for) in a rule under
[`.claude/rules/`](.claude/rules/). The details live in
[`CLAUDE.md`](CLAUDE.md); this is the map.

| # | Stage | What it does | Entry point |
|---|---|---|---|
| 1 | **[notification-agrupation](.claude/rules/notification-agrupation.md)** (notification grouping) | Groups notifications by real `post_id`, filters out security noise, sorts by debt, emits the `openUrl` per thread | `scripts/notif-scan.mjs` |
| 2 | **[thread-actor-dossier](.claude/rules/thread-actor-dossier.md)** | Expands the whole thread, walks the tree, builds the debt table, and profiles every actor in a longitudinal dossier | `scripts/thread-extract.mjs` |
| 3 | **[coagent-advise](.claude/rules/coagent-advise.md)** | Seeds the orchestrator coagent (ChatGPT) with the board state + the highest-leverage move, so it can stress-test it and draft the reply | chrome-devtools MCP |
| 4 | **[comment-post-and-verify](.claude/rules/comment-post-and-verify.md)** | Style gate → stage the draft → **Bernard's GO** → post → paranoid verification + screenshot | `scripts/comment-prepare.mjs` + MCP |

**Shortcut:** the `/vegan-pipeline` skill chains all 4 stages and stops at the
irreversible gate in stage 4 — the publish button is Bernard's, authorized one
move at a time.

### Where the firewall sits (Art. 4)

**Reversible work gets scripted**: scraping, grouping, expanding, walking the
tree, and **staging the draft in the composer WITHOUT sending it**. The
**irreversible act** — the `Enter` that publishes, plus its verification — and
the **judgment calls** (which move to make, the dossier prose, the style gate)
are **never scripted**. That part belongs to Claude + MCP + Bernard.

---

## The automation — `scripts/` (single source of truth)

The mechanical, deterministic parts run on `playwright-core` +
`connectOverCDP` against the **debug Chrome (port 9333)**, collapsing ~6 MCP
round-trips into one `node` run without burning tokens. The scripts never touch
Bernard's tabs: they always open a fresh tab inside the logged-in context.

| Script | Stage | What it does |
|---|---|---|
| `fb-lib.mjs` | — | **The canonical lib — every script imports it** (CDP session, ephemeral/persistent tabs, age parsing) |
| `notif-scan.mjs` | 1 | Scrapes notifications, groups them by `post_id`, sorts by debt, emits `openUrl` |
| `thread-extract.mjs` | 2 | Expands everything, walks the tree, dedupes Facebook's two renders, outputs tree + debt table |
| `comment-prepare.mjs` | 4 (prep) | Finds the comment, opens Reply, pastes the tagged draft **without sending**, and leaves the tab alive for the `Enter` from Claude+MCP |

Stage 3 (coagent) is MCP on purpose — no script. ChatGPT's UI changes more often
than Facebook's, and that query needs a human-grade read.

> **Before you touch Chrome:** run the diagnostic from `~/CLAUDE.md` (the port is
> usually **9333**, not 9222). Never kill Chrome blindly.

---

## The iceberg — [`iceberg/`](iceberg/)

**Live: https://aos.bernarduriza.com/iceberg/**

A D3 page that lays out, by depth, everything that surfaces in the debate groups. Level 0
is above the waterline: the phrases exactly as people write them ("It's food", "Humans are
omnivores", "The cow gives milk", "Morality is subjective"). Every level below is what that
phrase needs in order to stand — what it presupposes, what it materially does, how the
system defends itself, how it reproduces, and the bottom. Click a node and the threads
light up from the phrase down to what it's really defending.

It's not a lore chart. Every node is derived from the moat — real threads, tagged
tactics, frameworks with a win rate — and the source of truth is [`iceberg/data.js`](iceberg/data.js).
Each processed thread that teaches something new leaves a node. Details in
[`iceberg/README.md`](iceberg/README.md).

## The doctrine — [`doctrine/`](doctrine/)

The bot started life as a Claude.ai project, **"Bot Vegano Compasivo"**, and got
imported here. That's where the founding doctrine lives
(`compassion-disruption-2025.md` plus the emotional architecture manual), along
with an 8-source **RAG** (NVC/Rosenberg, Rogers, SAMHSA trauma-informed, Bowlby,
IFS, Motivational Interviewing, Siegel, Vegan Anarchism) stored as greppable
extracted text.

The voice of every reply is governed by
[`reply-output-style`](.claude/rules/reply-output-style.md): human, not robotic;
150–350 words; **two registers pointing the same direction** (compassionate with
good faith or hurt, sharp with bad faith or posturing, nothing at all for
trolls); a kill-list of AI tells; the through-line is flipping the burden of
proof and asking the framing question — always written for the lurker.

---

## The longitudinal memory — [`analysis/`](analysis/)

- `analysis/actors/<slug>.md` — a **hard dossier per person** (side, position,
  tactics, debate verdict, dated log). It accumulates across threads, and the key
  is the `user_id`, not the display name. This is what turns the companion into
  memory: who moves the goalposts, who's persuadable, who's a bottomless pit.
- `analysis/threads/<post_id>-<slug>.md` — the full transcript of each thread.

**Privacy.** These dossiers are built only from public group posts, and the
people in them can ask to see, fix, or delete their entry. How, and under
which law, is in [`PRIVACY.md`](PRIVACY.md).

---

## How to run the pipeline

```bash
# Debug Chrome must be live on 9333 (see ~/CLAUDE.md if it doesn't answer)

# Stage 1 — triage the notifications
cd scripts && node notif-scan.mjs            # table sorted by debt; --json to pipe it

# Stage 2 — profile the thread you picked
node thread-extract.mjs "<openUrl>" --json   # tree + debt -> transcript + dossiers

# Stages 3 and 4 — through Claude + chrome-devtools MCP (coagent + posting on GO)
```

Or just invoke the **`/vegan-pipeline`** skill (with or without a URL /
`post_id`).

---

## Original prototype — roadmap

The first version of this repo was an **educational Chrome extension** that
flagged logical fallacies through a Next.js + Azure OpenAI backend. **It was a
prototype** — it's kept as reference and isn't maintained as a product. Its
pieces are still in the tree:

- `manifest.json`, `sidepanel/` (→ `backend/public/extension`), `background.js`,
  `content/`, `icons/` — the extension.
- `backend/` — Next.js API (`/api/validate-fallacy`) + Azure Key Vault integration.
- `I18N-TESTING.md`, `TESTING.md` — prototype tests.

**Roadmap (prototype features not yet in the working pipeline):**

- [ ] More fallacy types (Ad Hominem, Whataboutism…) fed into the pipeline.
- [ ] AI-generated snippets backed by `doctrine/rag/`.
- [ ] A "Mark as Debate" content script for Facebook.
- [ ] Gamification / tracking (XP, badges, streaks) — from the prototype.
- [ ] Capture `user_id` automatically while profiling (stage 2).

---

## License

MIT — private educational project.

---

Built for vegan activists fighting the war that actually matters: **the silent
reader who's still deciding what to think.**
