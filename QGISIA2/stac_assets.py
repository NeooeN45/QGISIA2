# -*- coding: utf-8 -*-
"""
Resolution des href d'assets COG d'un item STAC (Earth Search sentinel-2-l2a).

Module pur Python (testable sans QGIS). Permet a l'agent, apres une recherche
satellite (search_satellite_imagery), de recuperer l'URL COG d'une bande pour la
charger via addRemoteRaster puis calculer un indice (computeSpectralIndex).
"""
from __future__ import annotations

from typing import List, Optional

# Bande logique -> cle d'asset Earth Search (sentinel-2-l2a)
SENTINEL2_ASSETS = {
    "BLUE": "blue",
    "GREEN": "green",
    "RED": "red",
    "NIR": "nir",
    "SWIR": "swir16",
    "SWIR2": "swir22",
}


def resolve_asset_href(item: dict, band: str) -> Optional[str]:
    """Href COG d'une bande logique (RED, NIR...) dans un item STAC. None si absent."""
    assets = (item or {}).get("assets", {}) or {}
    band = str(band or "").strip()
    if not band:
        return None
    candidates: List[str] = []
    mapped = SENTINEL2_ASSETS.get(band.upper())
    if mapped:
        candidates.append(mapped)
    candidates += [band, band.upper(), band.lower()]
    for key in candidates:
        asset = assets.get(key)
        if isinstance(asset, dict) and asset.get("href"):
            return asset["href"]
    return None


def band_assets(item: dict, bands: List[str]) -> dict:
    """{band: href} pour les bandes resolues (ignore celles sans asset)."""
    out = {}
    for band in bands:
        href = resolve_asset_href(item, band)
        if href:
            out[band] = href
    return out
