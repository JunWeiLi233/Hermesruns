# Token Saver Report

## Scope
- Baseline prompt: `.tools\token_tester\tmp\auto_hermes_without_new_mechanisms.md`
- Optimized prompt: `.tools\token_tester\tmp\auto_hermes_with_new_mechanisms.md`
- Method: exact `tiktoken` count (`cl100k_base`) plus local estimate

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens | Exact Tokens |
|---|---:|---:|---:|---:|---:|
| Baseline | 4293 | 596 | 52 | 1232 | 1009 |
| Optimized | 5488 | 771 | 59 | 1569 | 1245 |

## Delta
- Character delta: 1195 (27.84%)
- Word delta: 175 (29.36%)
- Estimated token delta: 337 (27.35%)
- Exact token delta: 236 (23.39%)


## Interpretation
- optimized prompt does not reduce token usage
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
