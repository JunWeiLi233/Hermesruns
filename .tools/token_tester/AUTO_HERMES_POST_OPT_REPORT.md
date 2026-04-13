# Token Saver Report

## Scope
- Baseline prompt: `C:\Users\Junwei\Downloads\Hermes\.tools\token_tester\tmp\auto_hermes_post_helper_pre_opt.md`
- Optimized prompt: `C:\Users\Junwei\Downloads\Hermes\.tools\token_tester\tmp\auto_hermes_post_helper_post_opt.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 98351 | 14874 | 1785 | 28402 | 22009 |
| Optimized | 97273 | 14769 | 1780 | 28078 | 21738 |

## Delta
- Character delta: -1078 (-1.10%)
- Word delta: -105 (-0.71%)
- Estimated token delta: -324 (-1.14%)
- Exact token delta: -271 (-1.23%)


## Interpretation
- optimized prompt uses fewer exact tokens
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
