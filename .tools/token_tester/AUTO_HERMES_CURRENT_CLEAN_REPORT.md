# Token Saver Report

## Scope
- Baseline prompt: `.tools\token_tester\tmp\auto_hermes_with_new_mechanisms.md`
- Optimized prompt: `.claude\commands\auto-hermes.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 5488 | 771 | 59 | 1569 | 1245 |
| Optimized | 3372 | 517 | 84 | 977 | 818 |

## Delta
- Character delta: -2116 (-38.56%)
- Word delta: -254 (-32.94%)
- Estimated token delta: -592 (-37.73%)
- Exact token delta: -427 (-34.30%)


## Interpretation
- optimized prompt uses fewer exact tokens
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
