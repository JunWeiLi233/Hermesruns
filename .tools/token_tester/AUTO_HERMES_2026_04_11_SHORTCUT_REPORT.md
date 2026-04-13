# Token Saver Report

## Scope
- Baseline prompt: `.claude\commands\auto-hermes.md`
- Optimized prompt: `.tools\token_tester\tmp\auto_hermes_current_shortcut.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 4113 | 642 | 94 | 1178 | 977 |
| Optimized | 35 | 4 | 1 | 8 | 10 |

## Delta
- Character delta: -4078 (-99.15%)
- Word delta: -638 (-99.38%)
- Estimated token delta: -1170 (-99.32%)
- Exact token delta: -967 (-98.98%)


## Interpretation
- optimized prompt uses fewer exact tokens
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
