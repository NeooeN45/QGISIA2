# -*- coding: utf-8 -*-
"""Run SAM reel (vit_b) sur une ortho telechargee. A lancer via le python de QGIS."""
import os
import sys
import tempfile
import time
import traceback

sys.path.insert(0, os.path.join(os.getcwd(), "QGISIA2"))


def main():
    try:
        try:
            from samgeo.common import tms_to_geotiff
        except Exception:
            from leafmap import tms_to_geotiff
        from samgeo_tool import SAMGeoSegmenter

        tmp = tempfile.gettempdir()
        tif = os.path.join(tmp, "_sam_in.tif")
        out = os.path.join(tmp, "_sam_out.geojson")
        t0 = time.time()
        tms_to_geotiff(output=tif, bbox=[1.440, 43.600, 1.448, 43.606],
                       zoom=18, source="Satellite", overwrite=True)
        print(f"ortho OK ({round(time.time()-t0,1)}s) -> {tif}", flush=True)

        seg = SAMGeoSegmenter(model="vit_b")
        res = seg.segment_automatic(tif, out, min_area_px=100)
        print(f"SAM OK: {res.feature_count} polygones | {res.message}", flush=True)
    except Exception as exc:
        print(f"SAM FAIL: {type(exc).__name__}: {exc}", flush=True)
        traceback.print_exc()


if __name__ == "__main__":
    main()
