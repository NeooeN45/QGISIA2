"""Tests pour l'outil natif ask_user — pur Python, zero dependance QGIS."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import native_tools as nt  # noqa: E402


class TestAskUser:
    def test_valid_question_options(self) -> None:
        result = nt._ask_user(
            {"question": "Quel type de PSG ?", "options": ["simple", "complet"]},
            None,
        )
        assert result["_ask_user_pause"] is True
        assert result["question"] == "Quel type de PSG ?"
        assert result["options"] == ["simple", "complet"]

    def test_missing_question(self) -> None:
        result = nt._ask_user({"options": ["A", "B"]}, None)
        assert "error" in result
        assert "question" in result["error"]

    def test_less_than_two_options(self) -> None:
        result = nt._ask_user(
            {"question": "Oui ou non ?", "options": ["oui"]}, None
        )
        assert "error" in result
        assert "options" in result["error"]

    def test_empty_options(self) -> None:
        result = nt._ask_user(
            {"question": "Question ?", "options": []}, None
        )
        assert "error" in result

    def test_execution_via_native_tools(self) -> None:
        import json
        out = nt.execute_native_tool(
            "ask_user",
            {"question": "Mode ?", "options": ["auto", "manuel"]},
        )
        parsed = json.loads(out)
        assert parsed["_ask_user_pause"] is True
        assert parsed["question"] == "Mode ?"
        assert parsed["options"] == ["auto", "manuel"]


class TestAskUserToolSpec:
    def test_ask_user_in_catalog(self) -> None:
        names = nt.native_tool_names()
        assert "ask_user" in names

    def test_openai_schema(self) -> None:
        tools = nt.to_openai_tools()
        ask_user_tool = next((t for t in tools if t["function"]["name"] == "ask_user"), None)
        assert ask_user_tool is not None
        props = ask_user_tool["function"]["parameters"]["properties"]
        assert "question" in props
        assert "options" in props
        assert ask_user_tool["function"]["parameters"].get("required") == ["question", "options"]
