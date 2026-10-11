"""Live smoke test for the Gemini API used by the backend.

Run from the backend directory with: python test_gemini_api.py
Use `python test_gemini_api.py feedback` to test interview feedback generation.
Set GEMINI_MODEL or GEMINI_MODELS to override the default model list.
"""

import os
import sys
import time

from google import genai
from google.genai import types
from dotenv import load_dotenv


def main() -> int:
    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("FAIL: Set GOOGLE_API_KEY or GEMINI_API_KEY in backend/.env.")
        return 1

    configured_models = os.getenv("GEMINI_MODELS") or os.getenv("GEMINI_MODEL")
    model_names = [
        name.strip()
        for name in (configured_models or "gemini-3.1-flash-lite,gemini-flash-latest,gemini-3.8-flash").split(",")
        if name.strip()
    ]
    model_name = model_names[0]
    feedback_mode = len(sys.argv) > 1 and sys.argv[1].lower() == "feedback"
    if feedback_mode:
        prompt = (
            "You are an experienced interview coach. Evaluate the candidate's answer for a "
            "Data Scientist role. Return 120 to 180 words using exactly these sections: "
            "Overall assessment, Strengths, Missing or weak points, and Specific improvements. "
            "Use complete sentences and concrete advice. Do not stop after one sentence.\n\n"
            "Interview question: How would you handle severe class imbalance in a fraud detection model?\n"
            "Candidate answer: I would balance the data and use accuracy to evaluate the model."
        )
    else:
        prompt = (
            "Write one complete interview question for a Data Scientist role. "
            "Return only the question, with enough context to answer meaningfully."
        )

    try:
        client = genai.Client(api_key=api_key)
        thinking_fields = getattr(types.ThinkingConfig, "model_fields", {})
        thinking_config = None
        if "thinking_level" in thinking_fields:
            thinking_config = types.ThinkingConfig(thinking_level="minimal")
        elif "thinking_budget" in thinking_fields:
            thinking_config = types.ThinkingConfig(thinking_budget=0)

        config_options = {"max_output_tokens": 1000}
        if thinking_config is not None:
            config_options["thinking_config"] = thinking_config
        response = None
        model_name = None
        last_error = None
        for candidate_model in model_names:
            model_name = candidate_model
            for attempt in range(2):
                try:
                    response = client.models.generate_content(
                        model=candidate_model,
                        contents=prompt,
                        config=types.GenerateContentConfig(**config_options),
                    )
                    break
                except Exception as exc:
                    last_error = exc
                    if "503" not in str(exc) and "UNAVAILABLE" not in str(exc).upper():
                        break
                    if attempt == 0:
                        time.sleep(2)
            if response is not None:
                break
        if response is None:
            raise RuntimeError(f"all configured models failed; last error: {last_error}")

        answer = (getattr(response, "text", None) or "").strip()
        if not answer:
            print(f"FAIL: {model_name} returned no text. Response: {response!r}")
            return 1
        if feedback_mode and len(answer) < 300:
            print(f"FAIL: feedback response is too short ({len(answer)} characters).")
            print(f"Response: {answer}")
            return 1

        candidates = getattr(response, "candidates", None) or []
        finish_reason = getattr(candidates[0], "finish_reason", None) if candidates else None
        # Finish reason 2 is MAX_TOKENS in the Gemini Python SDK's enum.
        if str(finish_reason).upper().endswith("MAX_TOKENS") or finish_reason == 2:
            print(f"FAIL: {model_name} stopped at the output-token limit.")
            print(f"Partial response: {answer}")
            return 1

        print(f"PASS: Gemini API responded with {model_name}.")
        print(f"Generated {'feedback' if feedback_mode else 'question'}: {answer}")
        print(f"Finish reason: {finish_reason}")
        return 0
    except Exception as exc:
        print(f"FAIL: Gemini request using {model_name} failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
