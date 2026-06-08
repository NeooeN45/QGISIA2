import pathlib

path = pathlib.Path("src/components/WorkspaceSidebar.tsx")
c = path.read_text(encoding="utf-8")
c = c.replace("WrenchIcon", "Wrench")
path.write_text(c, encoding="utf-8")
print("WrenchIcon -> Wrench OK")
