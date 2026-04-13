# Token Saver Report

## Scope
- Baseline prompt: `.tools/token_tester/tmp/auto_hermes_round_close_before.md`
- Optimized prompt: `.tools/token_tester/tmp/auto_hermes_round_close_after.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 96778 | 14709 | 1774 | 27937 | 21625 |
| Optimized | 98351 | 14874 | 1785 | 28402 | 22009 |

## Delta
- Character delta: 1573 (1.63%)
- Word delta: 165 (1.12%)
- Estimated token delta: 465 (1.66%)
- Exact token delta: 384 (1.78%)


## Interpretation
- optimized prompt does not reduce token usage
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
