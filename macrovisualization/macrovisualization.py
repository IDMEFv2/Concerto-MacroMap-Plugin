import pkg_resources
import re
import ipaddress
import xml.etree.ElementTree as ET

from prewikka import database, template, view, error, mainmenu, response
from prewikka.dataprovider import Criterion

class Macrovisualization(object):
    def __init__(self, id_, name, category, description, criteria):
        self.id_ = id_
        self.name = name
        self.category = category
        self.description = description
        self.criteria = criteria

class MapDatabase(database.DatabaseHelper):
    def get_icons_from_db(self, user_id):
        query = f"""
            SELECT id, user_id, is_default, class_name, html
            FROM Prewikka_macrovisualization_icons
            WHERE is_default = TRUE OR user_id = '{user_id}'
        """
        rows = self.query(query)
        icons = []
        for row in rows:
            icons.append({
                "id": row[0],
                "user_id": row[1],
                "is_default": row[2],
                "class_name": row[3],
                "html": row[4]
            })
        return icons

    def get_map_data_from_db(self, user_id):
        query_assets = f"""
            SELECT id, asset_name, icon_type, asset_ip, lat, lng
            FROM Prewikka_macrovisualization_assets
            WHERE user_id = '{user_id}'
        """
        assets = self.query(query_assets)

        result = {
            "asset_position_list": [
                {
                    "id": asset.get("id"),
                    "name": asset.get("asset_name"),
                    "iconType": asset.get("icon_type"),
                    "ip": asset.get("asset_ip"),
                    "lat": asset.get("lat"),
                    "lng": asset.get("lng")
                }
                for asset in assets
            ]
        }

        return result

    def insert_asset_into_db(self, user_id, asset_name, icon_type, asset_ip, lat, lng):

        message = self.validate_asset(asset_name, icon_type, asset_ip, lat, lng)

        if message != "":
            raise error.PrewikkaUserError(_("Operation refused"), message=_("The asset was rejected for the following reasons:" + message))

        insert_query = f"""
            INSERT INTO Prewikka_macrovisualization_assets (user_id, asset_name, icon_type, asset_ip, lat, lng)
            VALUES ('{user_id}', '{asset_name}', '{icon_type}', '{asset_ip}', '{lat}', '{lng}');
        """

        self.query(insert_query)
        return {"result": "Asset added"}

    def edit_asset_in_db(self, asset_id, user_id, asset_name, icon_type, asset_ip, lat, lng):

        message = self.validate_asset(asset_name, icon_type, asset_ip, lat, lng)

        if message != "":
            raise error.PrewikkaUserError(_("Operation refused"), message=_("The asset can't be edited for the following reasons:" + message))

        edit_query = f"""
            UPDATE Prewikka_macrovisualization_assets
            SET user_id = '{user_id}',
                asset_name = '{asset_name}',
                icon_type = '{icon_type}',
                asset_ip = '{asset_ip}',
                lat = '{lat}',
                lng = '{lng}'
            WHERE id = '{asset_id}';
        """

        self.query(edit_query)
        return {"result": "Asset updated"}

    def delete_asset_from_db(self, asset_id, user_id):
        delete_query = f"""
            DELETE FROM Prewikka_macrovisualization_assets
            WHERE id = '{asset_id}' AND user_id = '{user_id}';
        """

        self.query(delete_query)
        return {"result": "Asset removed"}

    def add_icon_to_db(self, user_id, class_name, html):
        message = self.validate_icon(class_name, html)

        if message != "":
            raise error.PrewikkaUserError(_("Operation refused"), message=_("The icon was rejected for the following reasons:" + message))

        insert_query = f"""
            INSERT INTO Prewikka_macrovisualization_icons (user_id, is_default, class_name, html)
            VALUES ('{user_id}', false, '{class_name}', '{html}');
        """

        self.query(insert_query)
        return {"result": "icon added"}

    # Checks if a user has ever used the map
    # If they haven't they are registered
    def get_user_settings_from_db(self, user_id):
        # Finds the user's settings
        query = f"""
            SELECT id, user_id, saved_position_lat, saved_position_lng, saved_zoom
            FROM prewikka_macrovisualization_settings
            WHERE user_id = '{user_id}'
        """
        rows = self.query(query)
        result = []

        # If they exist they are returned
        if rows:
            for row in rows:
                result.append({
                    "id": row[0],
                    "user_id": row[1],
                    "saved_position_lat": row[2],
                    "saved_position_lng": row[3],
                    "saved_zoom": row[4]
                })
        else:
            # Otherwise they are created with default values
            insert_query = f"""
                INSERT INTO prewikka_macrovisualization_settings (user_id, saved_position_lat, saved_position_lng, saved_zoom)
                VALUES ('{user_id}', 47, 10, 6)
            """
            self.query(insert_query)
            rows = self.query(query)
            if rows:
                for row in rows:
                    result.append({
                        "id": row[0],
                        "user_id": row[1],
                        "saved_position_lat": row[2],
                        "saved_position_lng": row[3],
                        "saved_zoom": row[4]
                    })
        return result

    def update_user_settings_db(self, user_id, saved_position_lat, saved_position_lng, saved_zoom):
        update_query = f"""
            UPDATE Prewikka_macrovisualization_settings
            SET saved_position_lat = '{saved_position_lat}',
                saved_position_lng = '{saved_position_lng}',
                saved_zoom = '{saved_zoom}'
            WHERE user_id = '{user_id}';
        """
        self.query(update_query)
        return {"result": "Update completed"}

    def validate_asset(self, asset_name, icon_type, asset_ip, lat, lng):
        message = ""

        if asset_ip:
            try:
                ipaddress.ip_address(asset_ip)  # Controlla sia IPv4 che IPv6
            except ValueError:
                message += "\n- The provided IP is invalid"
        else:
            message += "\n- No value provided for IP"

        if not asset_name:
            message += "\n- No value provided for name"

        if not icon_type:
            message += "\n- No value provided for icon type"

        try:
            lat = float(lat)
            if not (-90 <= lat <= 90):
                message += "\n- The provided latitude is out of range"
        except ValueError:
            message += "\n- The provided latitude is invalid"

        try:
            lng = float(lng)
            if not (-180 <= lng <= 180):
                message += "\n- The provided longitude is out of range"
        except ValueError:
            message += "\n- The provided longitude is invalid"

        return message

    def validate_icon(self, class_name, html):
        message = ""
        if not class_name:
            message += "\n- No value provided for name"
        print(html)
        if not html:
            message += "\n- No SVG provided"
        else:
            try:
                # Parsing the SVG string
                element = ET.fromstring(html)
                
                # Extract the tag name without the namespace
                tag_name = element.tag.split('}')[1] if '}' in element.tag else element.tag
                
                # Check if the tag is in the list of valid SVG tags
                if tag_name not in ["svg", "circle", "rect", "line", "path", "text", "g", "ellipse", "polygon", "polyline"]:
                    message += "\n- The provided SVG must be a valid HTML tag"
            except ET.ParseError:
                message = "\n- An error has occurred during the validation, please try again"
        return message

class macrovisualizationView(view.View):
    plugin_htdocs = (("macrovisualization", pkg_resources.resource_filename(__name__, 'htdocs')),)

    def __init__(self):
        view.View.__init__(self)
        self._db = MapDatabase()

    @view.route("/macrovisualization", methods=["GET", "POST"], permissions=[N_("IDMEF_VIEW")], menu=(N_("Alerts"), N_("Macrovisualization")))
    def listing(self):
        return view.ViewResponse(template.PrewikkaTemplate(__name__, "templates/macrovisualization.mak").render(), menu=mainmenu.HTMLMainMenu())

    @view.route("/get_alerts_by_ip", methods=["POST"])
    def get_alerts_by_ip(self):
        ip = env.request.parameters.get("ip")
        start_date = env.request.parameters.get("start_date")
        end_date = env.request.parameters.get("end_date")

        filter_for = ""
        criteria = Criterion()

        if ip is not None:  
            criteria += Criterion('idmefv2.target.ip', '=', ip)
            criteria += Criterion('idmefv2.create_time', '>=', start_date)
            criteria += Criterion('idmefv2.create_time', '<=', end_date)
            ret = env.dataprovider.query(["idmefv2.analyzer.hostname", "idmefv2.priority", "idmefv2.target.ip"], criteria)

            return {"status": "success", "data": ret}

        return {"status": "no_match", "data": []}

    @view.route("/get_icons_by_user_id", methods=["POST"])
    def get_icons_by_user_id(self):
        user_id = env.request.parameters.get("user_id")

        result = self._db.get_icons_from_db(user_id)
        return result
    
    @view.route("/get_map_data", methods=["POST"])
    def get_map_data(self):
        user_id = env.request.parameters.get("user_id")

        result = self._db.get_map_data_from_db(user_id)
        return result

    @view.route("/insert_asset", methods=["POST"])
    def insert_asset(self):
        user_id = env.request.parameters.get("user_id")
        asset_name = env.request.parameters.get("asset_name")
        icon_type = env.request.parameters.get("icon_type")
        asset_ip = env.request.parameters.get("asset_ip")
        lat = env.request.parameters.get("lat")
        lng = env.request.parameters.get("lng")

        result = self._db.insert_asset_into_db(user_id, asset_name, icon_type, asset_ip, lat, lng)
        return result

    @view.route("/edit_asset", methods=["POST"])
    def edit_asset(self):
        asset_id = env.request.parameters.get("asset_id")
        user_id = env.request.parameters.get("user_id")
        asset_name = env.request.parameters.get("asset_name")
        icon_type = env.request.parameters.get("icon_type")
        asset_ip = env.request.parameters.get("asset_ip")
        lat = env.request.parameters.get("lat")
        lng = env.request.parameters.get("lng")

        result = self._db.edit_asset_in_db(asset_id, user_id, asset_name, icon_type, asset_ip, lat, lng)
        return result

    @view.route("/delete_asset", methods=["POST"])
    def delete_asset(self):
        asset_id = env.request.parameters.get("asset_id")
        user_id = env.request.parameters.get("user_id")

        result = self._db.delete_asset_from_db(asset_id, user_id)
        return result

    @view.route("/add_icon", methods=["POST"])
    def add_icon(self):
        user_id = env.request.parameters.get("user_id")
        class_name = env.request.parameters.get("class_name")
        html = env.request.parameters.get("html")

        result = self._db.add_icon_to_db(user_id, class_name, html)
        return result

    @view.route("/get_user_id", methods=["GET"])
    def get_user_id(self):
        user_id = ""
        user_obj = env.request.__dict__.get("user")
        if user_obj:
            user_id = user_obj.id
        return {"user_id": user_id}

    @view.route("/get_user_settings", methods=["POST"])
    def get_user_settings(self):
        user_id = env.request.parameters.get("user_id")

        result = self._db.get_user_settings_from_db(user_id)
        return result


    @view.route("/update_user_settings", methods=["POST"])
    def update_user_settings(self):
        user_id = env.request.parameters.get("user_id")
        saved_position_lat = env.request.parameters.get("saved_position_lat")
        saved_position_lng = env.request.parameters.get("saved_position_lng")
        saved_zoom = env.request.parameters.get("saved_zoom")

        result = self._db.update_user_settings_db(user_id, saved_position_lat, saved_position_lng, saved_zoom)
        return result

    @view.route("/navigato_to_table", methods=["POST"])
    def navigato_to_table(self):
        ip = env.request.parameters.get("ip")
        criteria = Criterion()
        link = None
        if ip is not None:  
            criteria += Criterion('idmefv2.target.ip', '=', ip)
            linkview = env.viewmanager.get(datatype="idmefv2", keywords=["listing"])
            if linkview:
                link = linkview[-1].make_url(criteria=criteria, **env.request.menu.get_parameters())
            return response.PrewikkaRedirectResponse(link)

        return {"status": "no_match", "data": []}

    @view.route("/get_time", methods=["GET"])
    def get_time(self):
        return {
            "start_date": env.request.menu.start, 
            "end_date": env.request.menu.end
        }
        