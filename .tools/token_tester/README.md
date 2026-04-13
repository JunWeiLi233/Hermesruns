# Hermes Token Tester

Lightweight local prompt-token comparison tool for Hermes.

Purpose:
- compare a baseline prompt against a saver-optimized prompt
- estimate token cost without external APIs
- generate a repeatable Markdown report

Why estimate:
- `tiktoken` is not installed in this repo
- this tool uses a local heuristic so it works offline

Built-in saver ideas used in the sample optimized prompt:
1. collapse repeated phrasing
2. shorten list-style instructions with slash notation
3. remove redundant framing
4. keep only execution-critical constraints

Run:

```powershell
python .tools/token_tester/token_tester.py `
  --baseline .tools/token_tester/prompts/prompt_without_savers.md `
  --optimized .tools/token_tester/prompts/prompt_with_savers.md `
  --report .tools/token_tester/TOKEN_SAVER_REPORT.md
```

Random sample from the suite:

```powershell
$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:ALL_PROXY=''; $env:http_proxy=''; $env:https_proxy=''; $env:all_proxy='';
python .tools/token_tester/token_tester.py `
  --suite-dir .tools/token_tester/prompts `
  --random-sample `
  --report .tools/token_tester/TOKEN_SAVER_REPORT.md
```

Output:
- console summary
- Markdown report at `.tools/token_tester/TOKEN_SAVER_REPORT.md`
