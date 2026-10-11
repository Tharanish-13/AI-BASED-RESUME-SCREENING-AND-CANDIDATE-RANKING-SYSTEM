"""Backward-compatible entry point for the Gemini API smoke test."""

from test_gemini_api import main


if __name__ == "__main__":
    raise SystemExit(main())
