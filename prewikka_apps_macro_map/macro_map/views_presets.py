import os
import base64
import mimetypes
import pkg_resources

from typing import Any
from prewikka import view, error


class PresetsViewMixin(object):
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

