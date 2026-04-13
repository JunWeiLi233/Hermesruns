import argparse
import math
import random
import re
from pathlib import Path

try:
    import tiktoken
except ImportError:
    tiktoken = None


CJK_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
WORD_RE = re.compile(r"[A-Za-z0-9_./:-]+")
PUNCT_RE = re.compile(r"[^\sA-Za-z0-9_./:\-\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


def estimate_tokens(text: str) -> int:
    total = 0
    i = 0
    while i < len(text):
        char = text[i]
        if char.isspace():
          i += 1
          continue

        cjk_match = CJK_RE.match(text, i)
        if cjk_match:
            total += 1
            i = cjk_match.end()
            continue

        word_match = WORD_RE.match(text, i)
        if word_match:
            chunk = word_match.group(0)
            total += max(1, math.ceil(len(chunk) / 4))
            i = word_match.end()
            continue

        punct_match = PUNCT_RE.match(text, i)
        if punct_match:
            total += len(punct_match.group(0))
            i = punct_match.end()
            continue

        total += 1
        i += 1

    return total


def exact_tokens(text: str, encoding_name: str = "cl100k_base") -> int | None:
    if tiktoken is None:
        return None
    enc = tiktoken.get_encoding(encoding_name)
    return len(enc.encode(text))


def load_text(path_str: str) -> str:
    return Path(path_str).read_text(encoding="utf-8")


def summarize(text: str) -> dict:
    words = len(re.findall(r"\S+", text))
    chars = len(text)
    lines = len(text.splitlines())
    est_tokens = estimate_tokens(text)
    exact = exact_tokens(text)
    return {
        "chars": chars,
        "words": words,
        "lines": lines,
        "estimated_tokens": est_tokens,
        "exact_tokens": exact,
    }


def percent_delta(before: int, after: int) -> float:
    if before <= 0:
        return 0.0
    return ((after - before) / before) * 100.0


def build_report(baseline_path: str, optimized_path: str, baseline_stats: dict, optimized_stats: dict) -> str:
    token_delta = optimized_stats["estimated_tokens"] - baseline_stats["estimated_tokens"]
    token_pct = percent_delta(baseline_stats["estimated_tokens"], optimized_stats["estimated_tokens"])
    exact_available = baseline_stats["exact_tokens"] is not None and optimized_stats["exact_tokens"] is not None
    exact_delta = None if not exact_available else optimized_stats["exact_tokens"] - baseline_stats["exact_tokens"]
    exact_pct = None if not exact_available else percent_delta(baseline_stats["exact_tokens"], optimized_stats["exact_tokens"])
    word_delta = optimized_stats["words"] - baseline_stats["words"]
    word_pct = percent_delta(baseline_stats["words"], optimized_stats["words"])
    char_delta = optimized_stats["chars"] - baseline_stats["chars"]
    char_pct = percent_delta(baseline_stats["chars"], optimized_stats["chars"])

    better = "optimized prompt uses fewer exact tokens" if exact_available and exact_delta < 0 else (
        "optimized prompt uses fewer estimated tokens" if token_delta < 0 else "optimized prompt does not reduce token usage"
    )

    exact_column = " Exact Tokens |" if exact_available else ""
    exact_baseline = f" {baseline_stats['exact_tokens']} |" if exact_available else ""
    exact_optimized = f" {optimized_stats['exact_tokens']} |" if exact_available else ""
    exact_delta_lines = f"- Exact token delta: {exact_delta} ({exact_pct:.2f}%)\n" if exact_available else ""
    method_line = "exact `tiktoken` count (`cl100k_base`) plus local estimate" if exact_available else "local heuristic token estimator"

    return f"""# Token Saver Report

## Scope
- Baseline prompt: `{baseline_path}`
- Optimized prompt: `{optimized_path}`
- Method: {method_line}

## Results
| Prompt | Chars | Words | Lines | Estimated Tokens |{exact_column}
|---|---:|---:|---:|---:|{"---:|" if exact_available else ""}
| Baseline | {baseline_stats["chars"]} | {baseline_stats["words"]} | {baseline_stats["lines"]} | {baseline_stats["estimated_tokens"]} |{exact_baseline}
| Optimized | {optimized_stats["chars"]} | {optimized_stats["words"]} | {optimized_stats["lines"]} | {optimized_stats["estimated_tokens"]} |{exact_optimized}

## Delta
- Character delta: {char_delta} ({char_pct:.2f}%)
- Word delta: {word_delta} ({word_pct:.2f}%)
- Estimated token delta: {token_delta} ({token_pct:.2f}%)
{exact_delta_lines}

## Interpretation
- {better}
- Both prompts are measured with the same method, so the comparison is directly usable.
- The local estimate is retained as a fallback and secondary signal.

## Saver Techniques In The Optimized Prompt
1. Removed repeated framing around loop behavior.
2. Compressed repeated field lists into `Files/Done when/Verify/Note/Blocker`.
3. Shortened long conditional instructions without changing execution intent.
4. Kept stop conditions explicit but merged overlapping lines.
"""


def find_prompt_pairs(suite_dir: str) -> list[tuple[Path, Path]]:
    root = Path(suite_dir)
    baselines = sorted(root.glob("*_without_savers.md"))
    pairs = []
    for baseline in baselines:
        optimized = baseline.with_name(baseline.name.replace("_without_savers.md", "_with_savers.md"))
        if optimized.exists():
            pairs.append((baseline, optimized))
    return pairs


def main():
    parser = argparse.ArgumentParser(description="Compare baseline vs optimized Hermes prompts.")
    parser.add_argument("--baseline", help="Path to baseline prompt")
    parser.add_argument("--optimized", help="Path to optimized prompt")
    parser.add_argument("--suite-dir", help="Directory containing *_without_savers.md and *_with_savers.md prompt pairs")
    parser.add_argument("--random-sample", action="store_true", help="Choose one random prompt pair from --suite-dir")
    parser.add_argument("--report", help="Path to write markdown report")
    args = parser.parse_args()

    if args.random_sample:
        if not args.suite_dir:
            raise SystemExit("--random-sample requires --suite-dir")
        pairs = find_prompt_pairs(args.suite_dir)
        if not pairs:
            raise SystemExit("No prompt pairs found in suite directory")
        chosen_baseline, chosen_optimized = random.choice(pairs)
        args.baseline = str(chosen_baseline)
        args.optimized = str(chosen_optimized)
        print("Random sample chosen:", chosen_baseline.name.replace("_without_savers.md", ""))

    if not args.baseline or not args.optimized:
        raise SystemExit("Provide --baseline and --optimized, or use --suite-dir with --random-sample")

    baseline_text = load_text(args.baseline)
    optimized_text = load_text(args.optimized)

    baseline_stats = summarize(baseline_text)
    optimized_stats = summarize(optimized_text)

    print("Baseline:", baseline_stats)
    print("Optimized:", optimized_stats)
    print(
        "Estimated token delta:",
        optimized_stats["estimated_tokens"] - baseline_stats["estimated_tokens"],
        f"({percent_delta(baseline_stats['estimated_tokens'], optimized_stats['estimated_tokens']):.2f}%)",
    )
    if baseline_stats["exact_tokens"] is not None and optimized_stats["exact_tokens"] is not None:
        print(
            "Exact token delta:",
            optimized_stats["exact_tokens"] - baseline_stats["exact_tokens"],
            f"({percent_delta(baseline_stats['exact_tokens'], optimized_stats['exact_tokens']):.2f}%)",
        )

    if args.report:
        report = build_report(args.baseline, args.optimized, baseline_stats, optimized_stats)
        Path(args.report).write_text(report, encoding="utf-8")
        print("Report written to", args.report)


if __name__ == "__main__":
    main()
