import re
import ipaddress
import xml.etree.ElementTree as ET
import os
import base64
import mimetypes
import pkg_resources
import csv
import io
import json

from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Tuple, Any, Optional
from prewikka import database, template, view, error, mainmenu, response
from prewikka.dataprovider import Criterion

class FieldGroup(Enum):
    FreeText = "FreeText"
    Coordinates = "Coordinates"
    Directions = "Directions"
    Integers = "Integers"
    # Icon = "Icon"  # future development

DIRECTIONS_ALLOWED = {"Up", "Down", "Left", "Right"}

FIELD_GROUP_MAP = {
    "Town": FieldGroup.FreeText,

    "Latitude": FieldGroup.Coordinates,
    "Longitude": FieldGroup.Coordinates,

    "NamePosition": FieldGroup.Directions,
    "AlertPosition": FieldGroup.Directions,

    "IconSize": FieldGroup.Integers,
    "NameVisibleZoom": FieldGroup.Integers,
    "AlertVisibleZoom": FieldGroup.Integers,

    # "Icon": FieldGroup.Icon,  # none for now
}

class Macro_Map(object):
    def __init__(self, id_, name, category, description, criteria):
        self.id_ = id_
        self.name = name
        self.category = category
        self.description = description
        self.criteria = criteria

class MacroMapDatabase(database.DatabaseHelper):
    REQUIRED_COLUMNS = ["EntityName", "Town", "Nationality", "Latitude", "Longitude"]

    OPTIONAL_DEFAULTS = {
        "Icon": "Airport",
        "IconSize": "32",
        "NamePosition": "Up",
        "NameVisibleZoom": "7",
        "AlertPosition": "Right",
        "AlertVisibleZoom": "7",
        "LinksTo": "",
    }

    def save_assets_on_db(self, user_id: str, csv_content: str):
        validation = self.validate_assets(csv_content)

        # future development: persist assets to DB
        # self._persist_assets(user_id, validation["rows"])

        return {
            "status": "success",
            "message": "CSV validated (not saved yet)",
            "assets": validation.get("assets", [])
        }

    def validate_assets(self, csv_content: str):
        header, rows = self._parse_csv(csv_content)

        missing_cols = [c for c in self.REQUIRED_COLUMNS if c not in (header or [])]
        if missing_cols:
            raise error.PrewikkaUserError(
                _("Operation refused"),
                message=_("The CSV was rejected for the following reasons:") +
                        "\n" + _("Missing required columns: ") + ", ".join(missing_cols)
            )

        message = ""
        normalized_assets = []

        for idx, row in enumerate(rows, start=2):
            row_errors = self._validate_row(row)
            if row_errors:
                message += f"\nRow {idx}:"
                for e in row_errors:
                    message += f"\n{e}"
                continue

            normalized_assets.append(self._normalize_row(row))

        if message:
            raise error.PrewikkaUserError(
                _("Operation refused"),
                message=_("The CSV was rejected for the following reasons:") + message
            )

        return {
            "status": "success",
            "header": header,
            "rows_count": len(rows),
            "assets": normalized_assets
        }

    def _parse_csv(self, csv_content: str):
        if csv_content is None:
            raise error.PrewikkaUserError(_("Operation refused"), message=_("No CSV content provided"))

        text = csv_content.lstrip("\ufeff").strip()
        if not text:
            raise error.PrewikkaUserError(_("Operation refused"), message=_("CSV is empty"))

        buf = io.StringIO(text)
        reader = csv.DictReader(buf, delimiter=';')

        header = reader.fieldnames or []
        header = [h.strip() for h in header if h is not None]

        rows: List[Dict[str, Any]] = []
        for _, row in enumerate(reader, start=2):
            normalized = {}
            for k, v in (row or {}).items():
                if k is None:
                    continue
                key = k.strip()
                val = v.strip() if isinstance(v, str) else v
                normalized[key] = val

            if any((v not in (None, "", " ") for v in normalized.values())):
                rows.append(normalized)

        return header, rows

    def _normalize_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        entity_name = (row.get("EntityName") or "").strip()
        icon_value = self._get_optional_value(row, "Icon")
        icon_size_value = self._get_optional_value(row, "IconSize")
        name_position_value = self._get_optional_value(row, "NamePosition")
        name_visible_zoom_value = self._get_optional_value(row, "NameVisibleZoom")
        alert_position_value = self._get_optional_value(row, "AlertPosition")
        alert_visible_zoom_value = self._get_optional_value(row, "AlertVisibleZoom")
        links_to_value = self._get_optional_value(row, "LinksTo")

        return {
            "name": entity_name,
            "town": (row.get("Town") or "").strip(),
            "lat": self._as_float(row.get("Latitude")),
            "lng": self._as_float(row.get("Longitude")),
            "iconType": str(icon_value).strip(),  # no validation yet
            "marker_size": self._as_int(icon_size_value) or 0,
            "name_position": str(name_position_value).strip(),
            "name_visible": self._as_int(name_visible_zoom_value) or 0,
            "display_position": str(alert_position_value).strip(),
            "display_visible": self._as_int(alert_visible_zoom_value) or 0,
            "entity_name": entity_name,
            "links_to": str(links_to_value).strip(),
            "nationality": (row.get("Nationality") or "").strip(),
        }

    def _validate_row(self, row: Dict[str, Any]) -> List[str]:
        errors: List[str] = []

        errors.extend(self._validate_free_text("EntityName", row.get("EntityName")))
        errors.extend(self._validate_free_text("Town", row.get("Town")))

        errors.extend(self._validate_coordinates(row))

        errors.extend(self._validate_directions("NamePosition", self._get_optional_value(row, "NamePosition")))
        errors.extend(self._validate_directions("AlertPosition", self._get_optional_value(row, "AlertPosition")))

        errors.extend(self._validate_non_negative_int("IconSize", self._get_optional_value(row, "IconSize")))

        errors.extend(self._validate_int_range("NameVisibleZoom", self._get_optional_value(row, "NameVisibleZoom"), 3, 12))
        errors.extend(self._validate_int_range("AlertVisibleZoom", self._get_optional_value(row, "AlertVisibleZoom"), 3, 12))

        return errors

    def _get_optional_value(self, row: Dict[str, Any], field: str) -> Any:
        value = row.get(field)
        if value is None:
            return self.OPTIONAL_DEFAULTS[field]

        if isinstance(value, str) and value.strip() == "":
            return self.OPTIONAL_DEFAULTS[field]

        return value

    def _validate_free_text(self, field: str, value: Any) -> List[str]:
        s = "" if value is None else str(value).strip()
        if s == "":
            return [f"- {field}: must be a non-empty string"]
        return []

    def _validate_coordinates(self, row: Dict[str, Any]) -> List[str]:
        errors: List[str] = []

        lat = self._as_float(row.get("Latitude"))
        lng = self._as_float(row.get("Longitude"))

        if lat is None:
            errors.append("- Latitude: must be a number")
        elif not (-90.0 <= lat <= 90.0):
            errors.append("- Latitude: out of range (-90..90)")

        if lng is None:
            errors.append("- Longitude: must be a number")
        elif not (-180.0 <= lng <= 180.0):
            errors.append("- Longitude: out of range (-180..180)")

        return errors

    def _validate_int_range(self, field: str, value: Any, min_v: int, max_v: int) -> List[str]:
        n = self._as_int(value)
        if n is None:
            return [f"- {field}: must be an integer"]
        if n < min_v or n > max_v:
            return [f"- {field}: out of range ({min_v}..{max_v})"]
        return []

    def _validate_directions(self, field: str, value: Any) -> List[str]:
        s = "" if value is None else str(value).strip()
        if s not in DIRECTIONS_ALLOWED:
            allowed = ", ".join(sorted(DIRECTIONS_ALLOWED))
            return [f"- {field}: must be one of [{allowed}]"]
        return []

    def _validate_non_negative_int(self, field: str, value: Any) -> List[str]:
        n = self._as_int(value)
        if n is None:
            return [f"- {field}: must be an integer"]
        if n < 0:
            return [f"- {field}: must be non-negative"]
        return []

    def _as_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        s = str(value).strip().replace(",", ".")
        if s == "":
            return None
        try:
            return float(s)
        except ValueError:
            return None

    def _as_int(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return value
        s = str(value).strip()
        if s == "":
            return None
        try:
            if "." in s:
                f = float(s)
                if not f.is_integer():
                    return None
                return int(f)
            return int(s)
        except ValueError:
            return None

class macroMapView(view.View):
    plugin_htdocs = (("macro_map", pkg_resources.resource_filename(__name__, 'htdocs')),)

    def __init__(self):
        view.View.__init__(self)
        self._db = MacroMapDatabase()

    @view.route("/macro_map", methods=["GET", "POST"], permissions=[N_("IDMEF_VIEW")], menu=(N_("Alerts"), N_("Macro Map")))
    def listing(self):
        return view.ViewResponse(template.PrewikkaTemplate(__name__, "templates/macro_map.mak").render(), menu=mainmenu.HTMLMainMenu())

    def _get_presets_dir(self):
        return pkg_resources.resource_filename(__name__, "htdocs/samples/presets")

    def _sanitize_preset_filename(self, raw_filename: Any) -> str:
        if raw_filename is None:
            raise error.PrewikkaUserError(_("Operation refused"), message=_("Missing preset filename"))

        filename = str(raw_filename).strip()
        if not filename:
            raise error.PrewikkaUserError(_("Operation refused"), message=_("Missing preset filename"))

        safe_name = os.path.basename(filename)
        if safe_name != filename:
            raise error.PrewikkaUserError(_("Operation refused"), message=_("Invalid preset filename"))

        if not safe_name.lower().endswith(".csv"):
            raise error.PrewikkaUserError(_("Operation refused"), message=_("Preset must be a CSV file"))

        return safe_name

    @view.route("/macro_map/list_presets", methods=["GET"])
    def list_presets(self):
        presets_dir = self._get_presets_dir()

        if not os.path.isdir(presets_dir):
            return {"status": "success", "presets": []}

        filenames = [
            name for name in os.listdir(presets_dir)
            if name.lower().endswith(".csv") and os.path.isfile(os.path.join(presets_dir, name))
        ]

        filenames.sort()

        presets = [
            {
                "filename": name,
                "display_name": os.path.splitext(name)[0].replace("_", " ")
            }
            for name in filenames
        ]

        return {"status": "success", "presets": presets}

    @view.route("/macro_map/load_preset", methods=["POST"])
    def load_preset(self):
        safe_name = self._sanitize_preset_filename(env.request.parameters.get("filename"))

        presets_dir = self._get_presets_dir()
        file_path = os.path.join(presets_dir, safe_name)

        if not os.path.isfile(file_path):
            raise error.PrewikkaUserError(_("Operation refused"), message=_("Preset file not found"))

        with open(file_path, "r", encoding="utf-8-sig") as f:
            csv_content = f.read()

        return {
            "status": "success",
            "filename": safe_name,
            "csv_content": csv_content
        }

    @view.route("/macro_map/download_sample", methods=["POST"])
    def download_sample(self):
        fmt = env.request.parameters.get("format")
        if fmt not in ("csv", "xlsx"):
            raise error.PrewikkaUserError(_("Operation refused"), message=_("Invalid format"))

        filename = f"sample.{fmt}"
        samples_dir = pkg_resources.resource_filename(__name__, "htdocs/samples")
        file_path = os.path.join(samples_dir, filename)

        if not os.path.isfile(file_path):
            raise error.PrewikkaUserError(_("Operation refused"), message=_("File not found"))

        ctype, _ = mimetypes.guess_type(file_path)
        if not ctype:
            ctype = "application/octet-stream"

        with open(file_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")

        return {
            "status": "success",
            "filename": filename,
            "content_type": ctype,
            "data_base64": b64
        }

    @view.route("/macro_map/download_guide", methods=["POST"])
    def download_guide(self):
        filename = "template_guide.md"
        samples_dir = pkg_resources.resource_filename(__name__, "htdocs/samples")
        file_path = os.path.join(samples_dir, filename)

        if not os.path.isfile(file_path):
            raise error.PrewikkaUserError(_("Operation refused"), message=_("File not found"))

        with open(file_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")

        return {
            "status": "success",
            "filename": filename,
            "content_type": "application/octet-stream",
            "data_base64": b64
        }

    @view.route("/macro_map/upload_csv", methods=["POST"])
    def upload_csv(self):
        csv_content = env.request.parameters.get("csv_content")

        user_id = ""
        user_obj = env.request.__dict__.get("user")
        if user_obj:
            user_id = user_obj.id

        return self._db.save_assets_on_db(user_id, csv_content)

    @view.route("/macro_map/get_macro_alerts_bulk", methods=["POST"])
    def get_all_alerts_bulk(self):
        def _to_text(v):
            if v is None:
                return ""
            if isinstance(v, (list, tuple)):
                if not v:
                    return ""
                return _to_text(v[0])
            return str(v).strip()

        payload = {}
        raw_body = getattr(env.request, "body", None)

        if raw_body:
            try:
                if isinstance(raw_body, bytes):
                    raw_body = raw_body.decode("utf-8", errors="ignore")
                parsed = json.loads(raw_body)
                if isinstance(parsed, dict):
                    payload = parsed
            except Exception:
                payload = {}

        params = env.request.parameters or {}

        entity_names = payload.get("entities")
        if entity_names is None:
            entity_names = params.get("entities", params.get("entities[]", []))

        if isinstance(entity_names, str):
            s = entity_names.strip()
            if not s:
                entity_names = []
            else:
                try:
                    parsed_entities = json.loads(s)
                    entity_names = parsed_entities if isinstance(parsed_entities, list) else [parsed_entities]
                except Exception:
                    entity_names = [x.strip() for x in s.split(",") if x.strip()]

        if not isinstance(entity_names, list):
            entity_names = [entity_names] if entity_names is not None else []

        entity_names = [
            _to_text(x)
            for x in entity_names
            if _to_text(x)
        ]

        start_date = payload.get("start_date") or params.get("start_date")
        end_date = payload.get("end_date") or params.get("end_date")

        if not entity_names:
            return {"status": "success", "data": {}}

        requested = set(entity_names)

        query_fields = [
            "idmefv2.entityname",
            "idmefv2.priority",
            "idmefv2.analyzer.hostname",
            "idmefv2.target.ip",
            "idmefv2.description",
            "idmefv2.start_time",
            "idmefv2.source.id",
            "idmefv2.source.category",
            "idmefv2.source.geolocation"
        ]

        criteria = Criterion()
        criteria += Criterion('idmefv2.create_time', '>=', start_date)
        criteria += Criterion('idmefv2.create_time', '<=', end_date)

        ret = []
        try:
            criteria_with_entities = criteria + Criterion('idmefv2.entityname', 'IN', entity_names)
            ret = env.dataprovider.query(query_fields, criteria_with_entities)
        except Exception:
            ret = env.dataprovider.query(query_fields, criteria)

        grouped_data = {}
        for row in ret:
            ename = _to_text(row[0] if len(row) > 0 else None)
            if not ename or ename not in requested:
                continue

            if ename not in grouped_data:
                grouped_data[ename] = []

            alert_data = [
                row[2] if len(row) > 2 else None,
                row[1] if len(row) > 1 else None,
                row[3] if len(row) > 3 else None,
                row[4] if len(row) > 4 else None,
                row[5] if len(row) > 5 else None,
                row[6] if len(row) > 6 else None,
                row[7] if len(row) > 7 else None,
                row[8] if len(row) > 8 else None,
            ]
            grouped_data[ename].append(alert_data)

        return {"status": "success", "data": grouped_data}

    @view.route("/macro_map/navigate_to_table", methods=["POST"])
    def navigate_to_table(self):
        entity_name = env.request.parameters.get("entity_name")
        alert_type = env.request.parameters.get("alert_type")
        criteria = Criterion()
        link = None
        if entity_name is not None:  
            criteria += Criterion('idmefv2.entityname', '=', entity_name)
            if alert_type is not None:
                criteria += Criterion('idmefv2.priority', '=', alert_type)
            linkview = env.viewmanager.get(datatype="idmefv2", keywords=["listing"])
            if linkview:
                link = linkview[-1].make_url(criteria=criteria, **env.request.menu.get_parameters())
            return response.PrewikkaRedirectResponse(link)

        return {"status": "no_match", "data": []}

    @view.route("/macro_map/navigate_to_micro_map", methods=["POST"])
    def navigate_to_micro_map(self):
        asset_ref = (env.request.parameters.get("asset_ref") or "").strip()
        ref_type = (env.request.parameters.get("ref_type") or "entity_name").strip()
        source = (env.request.parameters.get("source") or "macro_map").strip()
        svg_name = (env.request.parameters.get("svg_name") or "").strip()

        context = {
            "asset_ref": asset_ref,
            "ref_type": ref_type,
            "source": source,
        }
        if svg_name:
            context["svg_name"] = svg_name

        self._set_navigation_context_for_current_user(context)

        return {"status": "ok", "svg_name": svg_name}

    @view.route("/macro_map/get_macro_time", methods=["GET"])
    def get_time(self):
        return {
            "start_date": env.request.menu.start, 
            "end_date": env.request.menu.end
        }

    def _get_storage_path(self):
        storage_dir = "/tmp/prewikka_macro_map"
        if not os.path.exists(storage_dir):
            os.makedirs(storage_dir)
        return os.path.join(storage_dir, "map_state.json")

    def _get_navigation_context_path(self):
        storage_dir = "/tmp/prewikka_plugin_navigation"
        if not os.path.exists(storage_dir):
            os.makedirs(storage_dir)
        return os.path.join(storage_dir, "context.json")

    def _get_current_user_id(self):
        user_obj = env.request.__dict__.get("user")
        if user_obj and getattr(user_obj, "id", None):
            return str(user_obj.id)
        return "anonymous"

    def _load_navigation_context(self):
        path = self._get_navigation_context_path()
        if not os.path.isfile(path):
            return {"by_user": {}}

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and isinstance(data.get("by_user"), dict):
                    return data
        except Exception:
            pass

        return {"by_user": {}}

    def _save_navigation_context(self, data):
        path = self._get_navigation_context_path()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)

    def _set_navigation_context_for_current_user(self, context):
        data = self._load_navigation_context()
        user_id = self._get_current_user_id()

        if not isinstance(context, dict):
            context = {}

        data.setdefault("by_user", {})
        data["by_user"][user_id] = {
            "asset_ref": str(context.get("asset_ref") or "").strip(),
            "ref_type": str(context.get("ref_type") or "entity_name").strip(),
            "source": str(context.get("source") or "macro_map").strip(),
            "svg_name": str(context.get("svg_name") or "").strip(),
        }

        self._save_navigation_context(data)

    @view.route("/macro_map/reset_state", methods=["POST"])
    def reset_state(self):
        storage_path = self._get_storage_path()
        try:
            if os.path.isfile(storage_path):
                os.remove(storage_path)
            return {"status": "success", "message": "Map reset"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    @view.route("/macro_map/save_state", methods=["POST"])
    def save_state(self):
        state_data = env.request.parameters.get("state_data")
        
        if not state_data:
            return {"status": "error", "message": "Missing data"}

        storage_path = self._get_storage_path()
        
        try:
            with open(storage_path, "w", encoding="utf-8") as f:
                f.write(state_data)
            
            return {"status": "success", "message": "State saved correctly"}
        except Exception as e:
            return {"status": "error", "message": f"FileSystem Error: {str(e)}"}

    @view.route("/macro_map/load_macro_state", methods=["GET"])
    def load_state(self):
        storage_path = self._get_storage_path()
        
        if not os.path.isfile(storage_path):
            return {"status": "no_data", "assets": []}

        try:
            with open(storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            # If data is a dict (new format), add status and return it
            if isinstance(data, dict):
                data["status"] = "success"
                return data
                
            # If data is a list (old format), return the classic format
            return {"status": "success", "assets": data}
        except Exception as e:
            return {"status": "error", "message": str(e)}