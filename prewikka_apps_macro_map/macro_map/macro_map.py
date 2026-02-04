import re
import ipaddress
import xml.etree.ElementTree as ET
import os
import base64
import mimetypes
import pkg_resources
import csv
import io

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
    "Name": FieldGroup.FreeText,
    "Town": FieldGroup.FreeText,

    "Latitude": FieldGroup.Coordinates,
    "Longitude": FieldGroup.Coordinates,

    "NamePosition": FieldGroup.Directions,
    "BadgePosition": FieldGroup.Directions,

    "MarkerSize": FieldGroup.Integers,
    "NameVisibleZoom": FieldGroup.Integers,
    "BadgeVisibleZoom": FieldGroup.Integers,

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
    REQUIRED_COLUMNS = [
        "Name", "Town", "Latitude", "Longitude", "Icon", "MarkerSize",
        "NamePosition", "NameVisibleZoom", "BadgePosition", "BadgeVisibleZoom",
        "EntityName"
    ]

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
        return {
            "name": (row.get("Name") or "").strip(),
            "town": (row.get("Town") or "").strip(),
            "lat": self._as_float(row.get("Latitude")),
            "lng": self._as_float(row.get("Longitude")),
            "iconType": (row.get("Icon") or "").strip(),  # no validation yet
            "marker_size": self._as_int(row.get("MarkerSize")) or 0,
            "name_position": (row.get("NamePosition") or "").strip(),
            "name_visible": self._as_int(row.get("NameVisibleZoom")) or 0,
            "display_position": (row.get("BadgePosition") or "").strip(),
            "display_visible": self._as_int(row.get("BadgeVisibleZoom")) or 0,
            "entity_name": (row.get("EntityName") or "").strip(),
        }

    def _validate_row(self, row: Dict[str, Any]) -> List[str]:
        errors: List[str] = []

        errors.extend(self._validate_free_text("Name", row.get("Name")))
        errors.extend(self._validate_free_text("Town", row.get("Town")))
        errors.extend(self._validate_free_text("EntityName", row.get("EntityName")))

        errors.extend(self._validate_coordinates(row))

        errors.extend(self._validate_directions("NamePosition", row.get("NamePosition")))
        errors.extend(self._validate_directions("BadgePosition", row.get("BadgePosition")))

        errors.extend(self._validate_non_negative_int("MarkerSize", row.get("MarkerSize")))

        errors.extend(self._validate_int_range("NameVisibleZoom", row.get("NameVisibleZoom"), 3, 12))
        errors.extend(self._validate_int_range("BadgeVisibleZoom", row.get("BadgeVisibleZoom"), 3, 12))

        return errors

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

    @view.route("/get_alerts_by_entityname", methods=["POST"])
    def get_alerts_by_ip(self):
        entity_name = env.request.parameters.get("entity_name")
        start_date = env.request.parameters.get("start_date")
        end_date = env.request.parameters.get("end_date")

        filter_for = ""
        criteria = Criterion()

        with open("/tmp/macro_map_debug.log", "a") as f:
                f.write(f"entity_name={entity_name}\n")
                f.flush()

        if entity_name is not None:  
            criteria += Criterion('idmefv2.entityname', '=', entity_name)
            criteria += Criterion('idmefv2.create_time', '>=', start_date)
            criteria += Criterion('idmefv2.create_time', '<=', end_date)
            ret = env.dataprovider.query([
                "idmefv2.analyzer.hostname", 
                "idmefv2.priority", 
                "idmefv2.target.ip", 
                "idmefv2.description", 
                "idmefv2.start_time",
                "idmefv2.vector.name",
                "idmefv2.vector.category",
                "idmefv2.vector.geolocation"
                ], criteria)

            with open("/tmp/macro_map_debug.log", "a") as f:
                f.write(f"ret={ret}\n")
                f.flush()
            return {"status": "success", "data": ret}

        return {"status": "no_match", "data": []}

    @view.route("/navigato_to_table", methods=["POST"])
    def navigato_to_table(self):
        entity_name = env.request.parameters.get("entity_name")
        criteria = Criterion()
        link = None
        if entity_name is not None:  
            criteria += Criterion('idmefv2.entityname', '=', entity_name)
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
