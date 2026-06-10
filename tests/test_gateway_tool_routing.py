# -*- coding: utf-8 -*-
"""
Tests du routage tool-calling du gateway : les modeles NVIDIA passent par le
provider openai/ (qui supporte 'tools') quand des outils sont fournis.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2" / "vendor"))
sys.path.insert(0, str(ROOT / "QGISIA2"))

import llm_gateway as g  # noqa: E402

TOOLS = [{
    "type": "function",
    "function": {"name": "getLayersList", "parameters": {"type": "object", "properties": {}}},
}]


def _build(model, tools):
    return g._build_completion_kwargs(
        model=model, messages=[], api_keys={"nvidia_nim": "k", "ollama_base_url": "http://x"},
        stream=False, temperature=None, max_tokens=None, tools=tools,
    )


def test_nvidia_with_tools_routes_via_openai_provider():
    kw = _build("nvidia_nim/nvidia/nemotron-3-super-120b-a12b", TOOLS)
    assert kw["model"] == "openai/nvidia/nemotron-3-super-120b-a12b"
    assert kw["api_base"] == "https://integrate.api.nvidia.com/v1"
    assert kw["api_key"] == "k"
    assert kw["tool_choice"] == "auto"
    assert kw["tools"] == TOOLS


def test_nvidia_without_tools_routes_via_openai_provider():
    kw = _build("nvidia_nim/meta/llama-3.3-70b-instruct", None)
    assert kw["model"] == "openai/meta/llama-3.3-70b-instruct"
    assert kw["api_base"] == "https://integrate.api.nvidia.com/v1"
    assert "tool_choice" not in kw


def test_non_nvidia_with_tools_sets_tool_choice():
    kw = _build("openrouter/anthropic/claude-3.5-sonnet", TOOLS)
    assert kw["model"] == "openrouter/anthropic/claude-3.5-sonnet"
    assert kw["tool_choice"] == "auto"
