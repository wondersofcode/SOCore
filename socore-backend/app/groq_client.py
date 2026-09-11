"""
Thin shared wrapper around Groq's OpenAI-compatible chat completions API.

Separate from ai_explainer.py's own inline call (that one is alert-shaped and
has its own mock fallback) — this one is for the newer, more general features
(assistant chat, shift summary) that just need "send messages, get text back".
"""
from __future__ import annotations

import logging
import os

import requests

logger = logging.getLogger("socore.groq_client")

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
_GROQ_MODEL = "openai/gpt-oss-120b"


def is_configured() -> bool:
    return bool(os.environ.get("GROQ_API_KEY", "").strip())


def chat(messages: list[dict], max_tokens: int = 600, temperature: float = 0.3) -> str | None:
    """Sends a chat-completion request. Returns the reply text, or None if no
    key is configured or the call fails for any reason — callers decide the
    fallback, this never raises."""
    key = os.environ.get("GROQ_API_KEY", "").strip()
    if not key:
        return None
    try:
        resp = requests.post(
            _GROQ_URL,
            headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
            json={
                "model": _GROQ_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
            timeout=20,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"].strip()
        return text or None
    except Exception as exc:
        logger.warning("Groq call failed: %s", exc)
        return None
