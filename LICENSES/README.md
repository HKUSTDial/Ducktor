# Licenses by directory

Ducktor is adapted from [Supervisor-Skills](https://github.com/HKUSTDial/Supervisor-Skills)
(skills and handbook text taken at commit 4c71810, 2026-11-20), Copyright (c) 2026 Yuyu Luo (methodology) and contributors,
licensed under CC BY-NC-SA 4.0.

| Path | License | Notes |
|---|---|---|
| `library/<skill>/` | CC-BY-NC-SA-4.0 | Unmodified copies of the 10 upstream skills, under the upstream `LICENSE`. See `CC-BY-NC-SA-4.0.txt`. Up to Supervisor-Skills 4c71810, the SKILL.md frontmatter of six of them still said `license: CC-BY-4.0`, left over from before the upstream license change in its 2.0.0; Ducktor up to 0.2.3 followed those lines. |
| `handbook/` | CC-BY-NC-SA-4.0 | Unmodified copies of the handbook text. See `CC-BY-NC-SA-4.0.txt`. |
| `skills/`, `rules/`, `cards/` | CC-BY-NC-SA-4.0 | Ducktor's own text, adapted from Supervisor-Skills. Not for commercial use. |
| `bin/`, `hooks/`, `scripts/`, `tests/` (except `tests/fixtures/`) | MIT | Code. See `MIT.txt`. Code files read the text in `rules/` at run time and do not embed it. |
| `tests/fixtures/` | `*.py`: MIT. Other files: CC-BY-NC-SA-4.0 | A synthetic project for the tests: a made-up paper, notes and code. |
| `README.md`, `i18n/README.en.md`, `INSTALL.md`, `i18n/INSTALL.en.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `AGENTS.md` (generated from `rules/`), `library/README.md` | CC-BY-NC-SA-4.0 | Ducktor's own text. |
| `evals/` | `*.js` and `*.sh`: MIT. Other files: CC-BY-NC-SA-4.0 | Evaluation cases and recorded results. The papers in the cases are synthetic, written for the evaluation. |
| `assets/` | CC-BY-NC-SA-4.0 | The logo and the README images. The README images are illustrations, not screen recordings. Their paper numbers come from Tables 2 and 3 of arXiv 1706.03762. |
| `library/upstream.lock.json`, `package.json`, `gemini-extension.json`, `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.agents/`, `.github/`, `.gitignore` | MIT | Manifests and configuration. |
| `docs/` | CC-BY-NC-SA-4.0 | Ducktor's design notes and research. Passages quoted from third-party guides and documentation remain under their authors' terms. |
| `LICENSE`, `LICENSES/` | The license texts | `LICENSE` is the short summary, and this file is the full map. The legal codes are copied unchanged. |

`CC-BY-NC-SA-4.0.txt` is the upstream `LICENSE` file, copied unchanged. The full legal code is at
https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.
