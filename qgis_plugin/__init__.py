# -*- coding: utf-8 -*-
def classFactory(iface):
    from .geoai_assistant import GeoAIAssistant
    return GeoAIAssistant(iface)
