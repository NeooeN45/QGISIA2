"""
Patch Chat.tsx — passe onSendMessage à WorkspaceSidebar pour les panneaux Devin.
IMPLÉMENTÉ PAR DEVIN CLI (Cognition AI) — Superviseur : Claude Code 4.8 — 2026-06-08
"""
import pathlib

path = pathlib.Path("src/components/Chat.tsx")
c = path.read_text(encoding="utf-8")

OLD = ('          onToggleLayerSelection={onToggleLayerSelection}\n'
       '          onToggleOpen={toggleSidebar}\n'
       '          onZoomToLayer={onZoomToLayer}\n'
       '        />')
NEW = ('          onToggleLayerSelection={onToggleLayerSelection}\n'
       '          onToggleOpen={toggleSidebar}\n'
       '          onZoomToLayer={onZoomToLayer}\n'
       '          onSendMessage={(msg) => void onSendMessage(msg)}\n'
       '        />')
assert OLD in c, "WorkspaceSidebar closing props not found"
c = c.replace(OLD, NEW, 1)
print("WorkspaceSidebar onSendMessage OK")

path.write_text(c, encoding="utf-8")
print("Done.")
