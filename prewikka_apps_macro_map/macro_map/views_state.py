import os
import json

from prewikka import view


class StateViewMixin(object):
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
