# -*- coding: utf-8 -*-
"""Tests de la couche HTTP de sécurité du bridge (module pur, sans QGIS)."""
import io
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "QGISIA2"))

import bridge_http as bh  # noqa: E402


class _FakeHandler:
    def __init__(self, headers, body=b""):
        self.headers = headers
        self.rfile = io.BytesIO(body)


# ── is_local_origin ───────────────────────────────────────────────────────────

def test_local_origins_allowed():
    for o in ("http://localhost:3000", "http://127.0.0.1", "https://localhost:8157"):
        assert bh.is_local_origin(o) is True


def test_remote_origins_rejected():
    for o in ("http://evil.com", "https://attacker.localhost.com", "", None):
        assert bh.is_local_origin(o) is False


# ── parse_content_length ──────────────────────────────────────────────────────

def test_parse_content_length():
    assert bh.parse_content_length("5") == 5
    assert bh.parse_content_length(None) == 0
    assert bh.parse_content_length("abc") == 0


# ── read_json_body ────────────────────────────────────────────────────────────

def test_read_valid_json():
    body = json.dumps({"query": "buffer"}).encode("utf-8")
    h = _FakeHandler({"Content-Length": str(len(body))}, body)
    assert bh.read_json_body(h) == {"query": "buffer"}


def test_read_empty_body():
    h = _FakeHandler({"Content-Length": "0"})
    assert bh.read_json_body(h) == {}


def test_oversized_body_rejected_without_reading():
    logged = []
    h = _FakeHandler({"Content-Length": str(bh.MAX_REQUEST_BYTES + 1)}, b"x")
    out = bh.read_json_body(h, log_fn=logged.append)
    assert out == {}
    assert logged  # un message d'avertissement a été émis
    # le corps n'a pas été lu (anti-DoS)
    assert h.rfile.tell() == 0


def test_non_dict_json_returns_empty():
    body = b"[1, 2, 3]"
    h = _FakeHandler({"Content-Length": str(len(body))}, body)
    assert bh.read_json_body(h) == {}


def test_invalid_json_returns_empty():
    body = b"{not json"
    h = _FakeHandler({"Content-Length": str(len(body))}, body)
    assert bh.read_json_body(h) == {}
