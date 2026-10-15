import re
import ipaddress
import xml.etree.ElementTree as ET
import pkg_resources

from dataclasses import dataclass
from prewikka import template, view, mainmenu

from .db import MacroMapDatabase
from .views_presets import PresetsViewMixin
from .views_alerts import AlertsViewMixin
from .views_state import StateViewMixin
from .views_icons import IconsViewMixin


class Macro_Map(object):
    def __init__(self, id_, name, category, description, criteria):
        self.id_ = id_
        self.name = name
        self.category = category
        self.description = description
        self.criteria = criteria



class macroMapView(AlertsViewMixin, PresetsViewMixin, StateViewMixin, IconsViewMixin, view.View):
    plugin_htdocs = (("macro_map", pkg_resources.resource_filename(__name__, 'htdocs')),)


    def __init__(self):
        view.View.__init__(self)
        self._db = MacroMapDatabase()


    @view.route("/macro_map", methods=["GET", "POST"], permissions=[N_("IDMEF_VIEW")], menu=(N_("Alerts"), N_("Macro Map")))
    def listing(self):
        return view.ViewResponse(template.PrewikkaTemplate(__name__, "templates/macro_map.mak").render(), menu=mainmenu.HTMLMainMenu())

