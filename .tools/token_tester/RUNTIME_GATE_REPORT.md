# Token Saver Report

## Scope
- Baseline prompt: `.tools\token_tester\tmp\runtime_gate_before.md`
- Optimized prompt: `.tools\token_tester\tmp\runtime_gate_after.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 87355 | 13166 | 1309 | 25614 | 19908 |
| Optimized | 89672 | 13472 | 1335 | 26265 | 20381 |

## Delta
- Character delta: 2317 (2.65%)
- Word delta: 306 (2.32%)
- Estimated token delta: 651 (2.54%)
- Exact token delta: 473 (2.38%)


## Interpretation
- optimized prompt does not reduce token usage
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
