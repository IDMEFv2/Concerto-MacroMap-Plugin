import json

from prewikka import view, response
from prewikka.dataprovider import Criterion


class AlertsViewMixin(object):
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
            "idmefv2.source.geolocation",
            "idmefv2.target.id",
            "idmefv2.target.category",
            "idmefv2.target.geolocation",
        ]

        criteria = Criterion()
        # Disabled pending discussion: may exclude non-obsolete drone/target position history if those alerts chain via PredID.
        # criteria += Criterion('idmefv2.status', '!=', 'Obsolete')
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
                row[9] if len(row) > 9 else None,
                row[10] if len(row) > 10 else None,
                row[11] if len(row) > 11 else None,
            ]
            grouped_data[ename].append(alert_data)

        return {"status": "success", "data": grouped_data}


    @view.route("/macro_map/get_independent_targets_bulk", methods=["POST"])
    def get_independent_targets_bulk(self):
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
        start_date = payload.get("start_date") or params.get("start_date")
        end_date = payload.get("end_date") or params.get("end_date")

        # Same field order as get_all_alerts_bulk's alert_data, so extractLatestTargetsFromAlerts
        # can be reused unchanged on the frontend. Not scoped to any loaded map entity.
        query_fields = [
            "idmefv2.entityname",
            "idmefv2.priority",
            "idmefv2.analyzer.hostname",
            "idmefv2.target.ip",
            "idmefv2.description",
            "idmefv2.start_time",
            "idmefv2.source.id",
            "idmefv2.source.category",
            "idmefv2.source.geolocation",
            "idmefv2.target.id",
            "idmefv2.target.category",
            "idmefv2.target.geolocation",
        ]

        # One query per target category that has an icon associated; rows are merged without duplicates.
        ret = []
        seen_rows = set()
        for category_value in self._get_bound_values("target"):
            criteria = Criterion()
            criteria += Criterion('idmefv2.target.category', '=', category_value)
            criteria += Criterion('idmefv2.create_time', '>=', start_date)
            criteria += Criterion('idmefv2.create_time', '<=', end_date)

            for row in env.dataprovider.query(query_fields, criteria):
                row_key = tuple(str(field) for field in row)
                if row_key not in seen_rows:
                    seen_rows.add(row_key)
                    ret.append(row)

        data = []
        for row in ret:
            alert_data = [
                row[2] if len(row) > 2 else None,
                row[1] if len(row) > 1 else None,
                row[3] if len(row) > 3 else None,
                row[4] if len(row) > 4 else None,
                row[5] if len(row) > 5 else None,
                row[6] if len(row) > 6 else None,
                row[7] if len(row) > 7 else None,
                row[8] if len(row) > 8 else None,
                row[9] if len(row) > 9 else None,
                row[10] if len(row) > 10 else None,
                row[11] if len(row) > 11 else None,
            ]
            data.append(alert_data)

        return {"status": "success", "data": data}


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

