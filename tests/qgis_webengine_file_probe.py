import json
import os
import tempfile

from qgis.PyQt.QtCore import QEventLoop, QTimer, QUrl
from qgis.PyQt.QtWidgets import QApplication
from qgis.utils import iface

try:
    from qgis.PyQt.QtWebEngineWidgets import QWebEngineView
except ImportError:
    from PyQt5.QtWebEngineWidgets import QWebEngineView


LOG_PATH = os.environ["GEOAI_WEBENGINE_PROBE_LOG"]


def write_log(payload):
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def finish(payload):
    write_log(payload)
    QTimer.singleShot(0, QApplication.instance().quit)


def main():
    html_path = os.path.join(tempfile.gettempdir(), "geoai_webengine_probe.html")
    with open(html_path, "w", encoding="utf-8") as handle:
        handle.write("<!doctype html><html><body><h1>GeoAI Probe</h1></body></html>")

    view = QWebEngineView()
    view.setParent(iface.mainWindow())

    loop = QEventLoop()
    result = {"ok": False, "url": html_path}

    def on_load(ok):
        result["ok"] = ok
        result["final_url"] = view.url().toString()
        loop.quit()

    view.loadFinished.connect(on_load)
    view.setUrl(QUrl.fromLocalFile(html_path))
    QTimer.singleShot(10000, loop.quit)
    loop.exec()

    finish(result)


QTimer.singleShot(1500, main)
