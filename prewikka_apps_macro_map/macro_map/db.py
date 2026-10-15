import csv
import io

from typing import Dict, List, Any, Optional
from enum import Enum
from prewikka import database, error


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

