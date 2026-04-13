# Token Saver Report

## Scope
- Baseline prompt: `.tools\token_tester\tmp\auto_hermes_without_new_mechanisms.md`
- Optimized prompt: `.claude\commands\auto-hermes.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 4293 | 596 | 52 | 1232 | 1009 |
| Optimized | 4113 | 642 | 94 | 1178 | 977 |

## Delta
- Character delta: -180 (-4.19%)
- Word delta: 46 (7.72%)
- Estimated token delta: -54 (-4.38%)
- Exact token delta: -32 (-3.17%)


## Interpretation
- optimized prompt uses fewer exact tokens
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
