# Token Saver Report

## Scope
- Baseline prompt: `.tools\token_tester\tmp\runtime_gate_after.md`
- Optimized prompt: `.tools\token_tester\tmp\runtime_gate_after_compressed.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 89672 | 13472 | 1335 | 26265 | 20381 |
| Optimized | 88721 | 13329 | 1325 | 26012 | 20192 |

## Delta
- Character delta: -951 (-1.06%)
- Word delta: -143 (-1.06%)
- Estimated token delta: -253 (-0.96%)
- Exact token delta: -189 (-0.93%)


## Interpretation
- optimized prompt uses fewer exact tokens
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
