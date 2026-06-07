# -*- coding: utf-8 -*-
"""L'orchestrateur doit gerer toutes les actions produites par study_plan."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import study_actions as sa  # noqa: E402
import study_plan as sp  # noqa: E402


def test_all_plan_actions_are_supported():
    for theme in sp.list_themes():
        for step in sp.build_plan(theme, {}):
            assert sa.is_supported(step["action"]), \
                f"action non geree par autoStudy: {step['action']}"


def test_report_template_per_theme():
    for theme in sp.list_themes():
        assert theme in sa.REPORT_TEMPLATE_BY_THEME
