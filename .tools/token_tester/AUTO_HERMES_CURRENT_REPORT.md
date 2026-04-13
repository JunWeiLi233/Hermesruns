# Token Saver Report

## Scope
- Baseline prompt: `.tools/token_tester/prompts/claude_loop_without_savers.md`
- Optimized prompt: `.tools/token_tester/prompts/claude_loop_with_savers.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 806 | 129 | 8 | 226 | 163 |
| Optimized | 543 | 80 | 9 | 151 | 118 |

## Delta
- Character delta: -263 (-32.63%)
- Word delta: -49 (-37.98%)
- Estimated token delta: -75 (-33.19%)
- Exact token delta: -45 (-27.61%)


## Interpretation
- optimized prompt uses fewer exact tokens
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
