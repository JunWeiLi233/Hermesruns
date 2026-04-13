# Token Saver Report

## Scope
- Baseline prompt: `.tools/token_tester/prompts/prompt_without_savers.md`
- Optimized prompt: `.tools/token_tester/prompts/prompt_with_savers.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 806 | 129 | 8 | 226 | 162 |
| Optimized | 613 | 92 | 9 | 171 | 131 |

## Delta
- Character delta: -193 (-23.95%)
- Word delta: -37 (-28.68%)
- Estimated token delta: -55 (-24.34%)
- Exact token delta: -31 (-19.14%)


## Interpretation
- optimized prompt uses fewer exact tokens
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
