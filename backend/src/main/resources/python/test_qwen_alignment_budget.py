from pathlib import Path
import unittest


class QwenAlignmentBudgetTests(unittest.TestCase):
    def test_course_map_alignment_worker_has_enough_output_budget(self):
        script = Path(__file__).with_name("analyze_course_map_alignment_qwen.py").read_text(encoding="utf-8")

        self.assertIn("max_new_tokens=1024", script)

    def test_course_map_alignment_worker_flushes_and_hard_exits(self):
        script = Path(__file__).with_name("analyze_course_map_alignment_qwen.py").read_text(encoding="utf-8")

        self.assertIn("sys.stdout.flush()", script)
        self.assertIn("sys.stderr.flush()", script)
        self.assertIn("os._exit(exit_code)", script)


if __name__ == "__main__":
    unittest.main()
