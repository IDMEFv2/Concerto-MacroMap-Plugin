from prewikka import pluginmanager, version

from .macro_map import macroMapView


class Macro_Map(pluginmanager.PluginPreload): 
    plugin_name = "Macro_Map"
    plugin_author = version.__author__
    plugin_license = version.__license__
    plugin_version = version.__version__
    plugin_copyright = version.__copyright__
    plugin_description = N_("Map page")
    # plugin_database_branch = version.__branch__
    # plugin_database_version = "0"
    plugin_classes = [macroMapView]