from prewikka import pluginmanager, version

from .macrovisualization import macrovisualizationView


class Macrovisualization(pluginmanager.PluginPreload): 
    plugin_name = "Macrovisualization"
    plugin_author = version.__author__
    plugin_license = version.__license__
    plugin_version = version.__version__
    plugin_copyright = version.__copyright__
    plugin_description = N_("Map page")
    plugin_database_branch = version.__branch__
    plugin_database_version = "0"
    plugin_classes = [macrovisualizationView]
    