from __future__ import absolute_import, division, print_function, unicode_literals

from prewikka import template, view, response
from pkg_resources import resource_filename 
from prewikka.dataprovider import Criterion

class map(view.View): 

    plugin_name = "map"  
    plugin_description = "An interactive map plugin"  
    plugin_htdocs = (("map", resource_filename(__name__, "htdocs")),) 
    plugin_version = "1.0.0"  
    view_name = " map"  
    view_section = "map"

    @view.route("/mapplugin", menu=("MapPlugin", "MapPlugin")) 
    def render(self): 
        return template.PrewikkaTemplate(__name__, "templates/map.tmpl").render() 
    
    # @view.route("/api/hello", methods=["GET"])
    # def get_map_data(self):
    #     return response.PrewikkaResponse({"message": "hello"})
    
    @view.route("/get_db", methods=["GET"])
    def json_db(self):
        json = {
            "inventory": [
                {
                    "id": 1,
                    "username": "admin",
                    "asset_position_list": [
                        {"name": "NRD", "ip": "0", "iconType": "building", "lat": 54.6872, "lng": 25.2797, "marker": None, "id": 0},
                        {"name": "BeDisruptive", "ip": "0", "iconType": "building", "lat": 40.4168, "lng": -3.7038, "marker": None, "id": 1},
                        {"name": "Elmisoftware", "ip": "195.103.203.230", "iconType": "building", "lat": 38.1157, "lng": 13.3615, "marker": None, "id": 2},
                        {"name": "Nicos", "ip": "0", "iconType": "building", "lat": 51.9607, "lng": 7.6261, "marker": None, "id": 3},
                        {"name": "CEA", "ip": "0", "iconType": "central_soc", "lat": 43.6047, "lng": 1.4442, "marker": None, "id": 4}
                    ],
                    "default_position": "POSIZIONE_DI_DEFAULT",
                    "saved_position": {"lat": 37.51735099503349, "lng": 13.833160400390627}
                },
                {
                    "id": 2,
                    "username": "compagno",
                    "asset_position_list": [
                        {"name": "NRD", "iconType": "building", "lat": 54.6872, "lng": 25.2797, "marker": None, "id": 0},
                        {"name": "BeDisruptive", "iconType": "building", "lat": 40.4168, "lng": -3.7038, "marker": None, "id": 1},
                        {"name": "Elmisoftware", "iconType": "building", "lat": 38.1157, "lng": 13.3615, "marker": None, "id": 2},
                        {"name": "Nicos", "iconType": "building", "lat": 51.9607, "lng": 7.6261, "marker": None, "id": 3},
                        {"name": "CEA", "iconType": "central_soc", "lat": 43.6047, "lng": 1.4442, "marker": None, "id": 4}
                    ],
                    "default_position": "POSIZIONE_DI_DEFAULT",
                    "saved_position": "POSIZIONE_SALVATA"
                }
            ]
        }
        return response.PrewikkaResponse(json)

    @view.route("/get_alerts_by_name/<name>/<ip>", methods=["POST"])
    def get_alerts_by_name(self, name=None, ip=None):
        filter_for = ""
        criteria = Criterion()
        if (ip != "0" and ip != None):  
            criteria += Criterion("idmefv2.target.ip", "!=", "195.103.203.230")
            ret = env.dataprovider.query(["idmefv2.target.ip", "idmefv2.priority"], criteria)

            filtered_results = []

            for item in ret:
                if item[0] == "['" + ip + "']":
                    filtered_results.append(item)

            return {"status": "success", "data": filtered_results}
        else:
            match name:
                case "Elmisoftware":
                    filter_for = "analyzer.elmisoftware.it"
                case "Nicos":
                    filter_for = "analyzer.nicos.de"
                case "BeDisruptive":
                    filter_for = "analyzer.bedisruptive.sp"
                case "NRD":
                    filter_for = "analyzer.nrd.lt"
                case _:
                    return {"status": "no_match", "data": []}  # Aggiungi un messaggio più chiaro

            criteria += Criterion("idmefv2.analyzer.hostname", "=", filter_for)
            ret = env.dataprovider.query(["idmefv2.analyzer.hostname", "idmefv2.priority", "idmefv2.target.ip"], criteria)

            return {"status": "success", "data": ret}  # Includi i dati in una struttura più chiara

