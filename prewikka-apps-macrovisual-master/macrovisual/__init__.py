from __future__ import absolute_import, division, print_function, unicode_literals

from prewikka import template, view 
from pkg_resources import resource_filename 

class macrovisual(view.View): 

    plugin_name = "macrovisual"  
    plugin_description = "An interactive map plugin"  
    plugin_htdocs = (("macrovisual", resource_filename(__name__, "htdocs")),) 
    plugin_version = "1.0.0"  
    view_name = " macrovisual"  
    view_section = "macrovisual"  

    @view.route("/macrovisualizationplugin", menu=("MacroVisualPlugin", "MacroVisualPlugin")) 
    def render(self): 
        return template.PrewikkaTemplate(__name__, "templates/macrovisual.tmpl").render() 