import importlib.util
import os
import sys
import traceback
from pathlib import Path

from qgis.PyQt.QtCore import QTimer
from qgis.utils import iface


PLUGIN_PARENT = Path(os.environ["GEOAI_PLUGIN_PARENT"])
LOG_PATH = Path(os.environ["GEOAI_UI_LOG"])


def write_log(message: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(f"{message}\n")


def load_plugin():
    plugin_dir = PLUGIN_PARENT / "qgis_plugin"
    init_path = plugin_dir / "__init__.py"
    spec = importlib.util.spec_from_file_location(
        "qgis_plugin",
        init_path,
        submodule_search_locations=[str(plugin_dir)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Impossible de charger le plugin depuis {init_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules["qgis_plugin"] = module
    spec.loader.exec_module(module)
    return module.classFactory(iface)


def launch():
    try:
        plugin = load_plugin()
        plugin.initGui()
        plugin.run()
        write_log("STATUS=ok")

        if getattr(plugin, "external_ui_url", None):
            write_log(f"URL={plugin.external_ui_url}")
        elif getattr(plugin, "view", None) is not None:
            write_log(f"URL={plugin.view.url().toString()}")
        else:
            write_log("URL=")
    except Exception:
        write_log("STATUS=error")
        write_log(traceback.format_exc())


write_log("STATUS=boot")
QTimer.singleShot(1500, launch)
