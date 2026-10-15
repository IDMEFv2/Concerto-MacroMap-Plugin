import json
import os
import re
import tempfile
import xml.etree.ElementTree as ElementTree

import pkg_resources

from prewikka import log, view


ICON_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
MAX_SVG_BYTES = 50 * 1024
GENERIC_TYPE = "generic"
BINDING_TYPES = ("source", "target")
SVG_NAMESPACE = "http://www.w3.org/2000/svg"
XLINK_NAMESPACE = "http://www.w3.org/1999/xlink"
FORBIDDEN_ELEMENTS = {"script", "foreignobject", "style", "image", "iframe", "use", "animate", "set"}
DRAWABLE_ELEMENTS = {"path", "rect", "circle", "ellipse", "polygon", "polyline", "line", "text"}
NON_LOCAL_URL_PATTERN = re.compile(r"url\(\s*(?![\'\"]?#)", re.IGNORECASE)
NUMERIC_SIZE_PATTERN = re.compile(r"^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$")

ElementTree.register_namespace("", SVG_NAMESPACE)
ElementTree.register_namespace("xlink", XLINK_NAMESPACE)

logger = log.get_logger(__name__)

# Verdict per icon file, valid while the file's modification time and size stay the same.
_icon_file_cache = {}


def _local_name(tag):
    return tag.split("}")[-1].lower()


def _parse_style(style_text):
    declarations = {}
    for declaration in (style_text or "").split(";"):
        if ":" in declaration:
            property_name, value = declaration.split(":", 1)
            declarations[property_name.strip().lower()] = value.strip()
    return declarations


def _style_to_text(declarations):
    return ";".join("%s:%s" % (name, value) for name, value in declarations.items())


def _paint_value(element, property_name):
    """Own value of fill/stroke on an element, with the style attribute taking priority."""
    style_value = _parse_style(element.get("style")).get(property_name)
    raw_value = style_value if style_value is not None else element.get(property_name)
    if raw_value is None or raw_value.strip().lower() == "inherit":
        return None
    return raw_value.strip().lower()


def _effective_paint(element, property_name, parent_map):
    while element is not None:
        value = _paint_value(element, property_name)
        if value is not None:
            return value
        element = parent_map.get(element)
    return None


class IconsViewMixin(object):
    def _get_default_icons_dir(self):
        return pkg_resources.resource_filename(__name__, "htdocs/assets/default_icons")

    def _get_custom_icons_dir(self):
        icons_dir = "/tmp/prewikka_macro_map/custom_icons"
        os.makedirs(icons_dir, exist_ok=True)
        return icons_dir

    def _list_icon_names(self, icons_dir):
        if not os.path.isdir(icons_dir):
            return []

        icon_names = []
        for filename in sorted(os.listdir(icons_dir)):
            icon_name, extension = os.path.splitext(filename)
            icon_path = os.path.join(icons_dir, filename)
            if extension == ".svg" and os.path.isfile(icon_path) and ICON_NAME_PATTERN.match(icon_name):
                icon_names.append(icon_name)
        return icon_names

    def _read_icon_file(self, icon_path, icon_name, origin):
        """Return (icon, rejection): the icon dict or {reason, svg}; the file is read and validated only if it changed."""
        file_stat = os.stat(icon_path)
        stamp = (file_stat.st_mtime_ns, file_stat.st_size)
        cached = _icon_file_cache.get(icon_path)
        if cached and cached["stamp"] == stamp:
            return cached["icon"], cached["rejection"]

        icon, rejection = None, None
        try:
            with open(icon_path, "r", encoding="utf-8") as icon_file:
                svg_text = icon_file.read()
            level, messages, _ = self._validate_svg(svg_text)
            if level == "error":
                rejection = {"reason": " ".join(messages), "svg": svg_text}
            else:
                icon = {"class_name": icon_name, "html": svg_text, "origin": origin}
        except (OSError, UnicodeDecodeError):
            rejection = {"reason": "The file could not be read.", "svg": ""}

        if rejection:
            logger.warning("Icon %s (%s) not loaded: %s", icon_name, origin, rejection["reason"])
        _icon_file_cache[icon_path] = {"stamp": stamp, "icon": icon, "rejection": rejection}
        return icon, rejection

    def _read_icons(self, icons_dir, origin):
        """Return (icons, rejected). The text of a rejected custom file is included, up to the size limit, so the UI can offer to fix it."""
        icons = {}
        rejected = []
        icon_paths = set()
        for icon_name in self._list_icon_names(icons_dir):
            icon_path = os.path.join(icons_dir, icon_name + ".svg")
            icon_paths.add(icon_path)
            try:
                icon, rejection = self._read_icon_file(icon_path, icon_name, origin)
            except OSError:
                continue
            if icon:
                icons[icon_name] = dict(icon)
            else:
                is_editable = origin == "custom" and len(rejection["svg"].encode("utf-8")) <= MAX_SVG_BYTES
                rejected.append({"name": icon_name, "origin": origin, "reason": rejection["reason"], "svg": rejection["svg"] if is_editable else ""})

        for cached_path in [path for path in _icon_file_cache if os.path.dirname(path) == icons_dir and path not in icon_paths]:
            del _icon_file_cache[cached_path]
        return icons, rejected

    def _find_icon_origin(self, icon_name):
        """Where an icon with this name already exists: 'custom', 'default' or None."""
        if os.path.isfile(os.path.join(self._get_custom_icons_dir(), icon_name + ".svg")):
            return "custom"
        if os.path.isfile(os.path.join(self._get_default_icons_dir(), icon_name + ".svg")):
            return "default"
        return None

    def _validate_svg(self, svg_text):
        """Return (level, messages, normalized_svg); level is ok, note, warning or error."""
        if not svg_text or not svg_text.strip():
            return "error", ["The SVG content is empty."], None
        if len(svg_text.encode("utf-8")) > MAX_SVG_BYTES:
            return "error", ["The SVG is larger than %d KB." % (MAX_SVG_BYTES // 1024)], None
        if re.search(r"<!\s*(DOCTYPE|ENTITY)", svg_text, re.IGNORECASE):
            return "error", ["DOCTYPE and ENTITY declarations are not allowed."], None

        try:
            root = ElementTree.fromstring(svg_text.strip())
        except ElementTree.ParseError as parse_error:
            return "error", ["The SVG is not valid XML: %s" % parse_error], None

        if _local_name(root.tag) != "svg":
            return "error", ["The root element must be <svg>."], None

        for element in root.iter():
            element_name = _local_name(element.tag)
            if element_name in FORBIDDEN_ELEMENTS:
                return "error", ["The <%s> element is not allowed." % element_name], None
            for attribute_name, attribute_value in element.attrib.items():
                attribute_local_name = _local_name(attribute_name)
                if attribute_local_name.startswith("on"):
                    return "error", ["Event handler attributes (%s) are not allowed." % attribute_local_name], None
                if attribute_local_name == "href" and not attribute_value.strip().startswith("#"):
                    return "error", ["Only local references (#id) are allowed in href."], None
                if NON_LOCAL_URL_PATTERN.search(attribute_value) or "javascript:" in attribute_value.lower():
                    return "error", ["External or script references are not allowed."], None

        messages = []

        if not root.get("viewBox"):
            size_matches = [NUMERIC_SIZE_PATTERN.match(root.get("width", "")), NUMERIC_SIZE_PATTERN.match(root.get("height", ""))]
            if not all(size_matches):
                return "error", ["The SVG has no viewBox and no numeric width/height to derive it from."], None
            root.set("viewBox", "0 0 %s %s" % (size_matches[0].group(1), size_matches[1].group(1)))
            messages.append("viewBox derived from width/height.")

        parent_map = {child: parent for parent in root.iter() for child in parent}
        fixed_colours = set()
        has_colourable_shape = False

        for shape in root.iter():
            if _local_name(shape.tag) not in DRAWABLE_ELEMENTS:
                continue
            fill_value = _effective_paint(shape, "fill", parent_map)
            stroke_value = _effective_paint(shape, "stroke", parent_map)

            if fill_value is None or fill_value == "currentcolor":
                has_colourable_shape = True
            elif fill_value not in ("none", "transparent"):
                fixed_colours.add(fill_value)

            if stroke_value == "currentcolor":
                has_colourable_shape = True
            elif stroke_value not in (None, "none", "transparent"):
                fixed_colours.add(stroke_value)

        level = "ok"
        if len(fixed_colours) == 1:
            level = "note"
            fixed_colour = next(iter(fixed_colours))
            self._replace_fixed_colour(root, fixed_colour)
            messages.append("Single fixed colour (%s) converted to currentColor so it follows the severity colour." % fixed_colour)
        elif len(fixed_colours) > 1:
            level = "warning"
            messages.append("The icon uses several fixed colours: they will not follow the severity colour.")
        elif not has_colourable_shape:
            level = "warning"
            messages.append("No shape can take the severity colour (everything is transparent).")

        return level, messages, ElementTree.tostring(root, encoding="unicode")

    def _replace_fixed_colour(self, root, fixed_colour):
        for element in root.iter():
            for property_name in ("fill", "stroke"):
                attribute_value = element.get(property_name)
                if attribute_value is not None and attribute_value.strip().lower() == fixed_colour:
                    element.set(property_name, "currentColor")

            style_declarations = _parse_style(element.get("style"))
            if not style_declarations:
                continue
            for property_name in ("fill", "stroke"):
                if style_declarations.get(property_name, "").lower() == fixed_colour:
                    style_declarations[property_name] = "currentColor"
            element.set("style", _style_to_text(style_declarations))

    def _validate_icon_request(self, icon_name, svg_text):
        if not icon_name or not ICON_NAME_PATTERN.match(icon_name):
            return "error", ["The name must be 1-40 characters: letters, digits, '-' or '_'."], None
        return self._validate_svg(svg_text)

    def _get_custom_bindings_path(self):
        storage_dir = "/tmp/prewikka_macro_map"
        os.makedirs(storage_dir, exist_ok=True)
        return os.path.join(storage_dir, "custom_bindings.json")

    def _load_binding_data(self):
        """Return (vocabularies, default_bindings) from the packaged JSON."""
        bindings_path = pkg_resources.resource_filename(__name__, "htdocs/assets/idmef_icon_bindings.json")
        try:
            with open(bindings_path, "r", encoding="utf-8") as bindings_file:
                binding_data = json.load(bindings_file)
        except (OSError, ValueError):
            return {}, []
        return binding_data.get("vocabularies", {}), binding_data.get("default_bindings", [])

    def _read_custom_bindings(self):
        try:
            with open(self._get_custom_bindings_path(), "r", encoding="utf-8") as bindings_file:
                custom_bindings = json.load(bindings_file)
        except (OSError, ValueError):
            return []
        return custom_bindings if isinstance(custom_bindings, list) else []

    def _get_merged_bindings(self):
        """Default and custom bindings in one list; a custom one replaces the default with the same type and value."""
        _, default_bindings = self._load_binding_data()
        merged_bindings = {}
        for origin, bindings in (("default", default_bindings), ("custom", self._read_custom_bindings())):
            for binding in bindings:
                if not isinstance(binding, dict) or not all(key in binding for key in ("type", "value", "icon")):
                    continue
                merged_bindings[(binding["type"], binding["value"])] = {
                    "type": binding["type"], "value": binding["value"], "icon": binding["icon"], "origin": origin,
                }
        return list(merged_bindings.values())

    def _get_bound_values(self, binding_type):
        return [binding["value"] for binding in self._get_merged_bindings() if binding["type"] == binding_type and binding["icon"]]

    def _write_custom_bindings(self, custom_bindings):
        bindings_path = self._get_custom_bindings_path()
        file_descriptor, temporary_path = tempfile.mkstemp(dir=os.path.dirname(bindings_path), suffix=".tmp")
        with os.fdopen(file_descriptor, "w", encoding="utf-8") as temporary_file:
            json.dump(custom_bindings, temporary_file, ensure_ascii=False)
        os.chmod(temporary_path, 0o666)
        os.replace(temporary_path, bindings_path)

    def _upsert_custom_binding(self, binding_type, binding_value, icon_name):
        custom_bindings = [
            binding for binding in self._read_custom_bindings()
            if not (binding.get("type") == binding_type and binding.get("value") == binding_value)
        ]
        custom_bindings.append({"type": binding_type, "value": binding_value, "icon": icon_name})
        self._write_custom_bindings(custom_bindings)

    def _clear_icon_bindings(self, icon_name, binding_types):
        """Remove the icon's associations of the given types; a default one is hidden with an empty-icon entry."""
        _, default_bindings = self._load_binding_data()
        custom_bindings = [
            binding for binding in self._read_custom_bindings()
            if not (binding.get("type") in binding_types and binding.get("icon") == icon_name)
        ]
        remaining_pairs = {(binding.get("type"), binding.get("value")) for binding in custom_bindings}

        for binding in default_bindings:
            pair = (binding.get("type"), binding.get("value"))
            if binding.get("type") in binding_types and binding.get("icon") == icon_name and pair not in remaining_pairs:
                custom_bindings.append({"type": pair[0], "value": pair[1], "icon": ""})

        self._write_custom_bindings(custom_bindings)

    def _drop_icon_bindings(self, icon_names):
        """Remove the associations of the icons and restore their default ones, even if hidden or taken by another icon."""
        _, default_bindings = self._load_binding_data()
        default_pairs = {(binding.get("type"), binding.get("value")) for binding in default_bindings if binding.get("icon") in icon_names}
        custom_bindings = [
            binding for binding in self._read_custom_bindings()
            if binding.get("icon") not in icon_names and (binding.get("type"), binding.get("value")) not in default_pairs
        ]
        self._write_custom_bindings(custom_bindings)

    @view.route("/macro_map/get_icons", methods=["GET"])
    def get_icons(self):
        icons, rejected_default = self._read_icons(self._get_default_icons_dir(), "default")
        custom_icons, rejected_custom = self._read_icons(self._get_custom_icons_dir(), "custom")
        for icon_name, icon in custom_icons.items():
            icon["overrides_default"] = icon_name in icons
        icons.update(custom_icons)

        return {"status": "success", "icons": [icons[icon_name] for icon_name in sorted(icons)], "rejected": rejected_default + rejected_custom}

    @view.route("/macro_map/get_icon_bindings", methods=["GET"])
    def get_icon_bindings(self):
        vocabularies, _ = self._load_binding_data()
        return {"status": "success", "vocabularies": vocabularies, "bindings": self._get_merged_bindings()}

    @view.route("/macro_map/validate_icon", methods=["POST"])
    def validate_icon(self):
        icon_name = (env.request.parameters.get("name") or "").strip()
        level, messages, normalized_svg = self._validate_icon_request(icon_name, env.request.parameters.get("svg"))

        existing_origin = self._find_icon_origin(icon_name) if ICON_NAME_PATTERN.match(icon_name) else None
        if level != "error" and existing_origin == "default":
            messages.append("A default icon with this name exists: the custom one will replace it.")
        elif level != "error" and existing_origin == "custom":
            messages.append("A custom icon with this name already exists: saving requires overwriting it.")

        return {"status": "success", "level": level, "messages": messages, "svg": normalized_svg, "exists": existing_origin}

    @view.route("/macro_map/save_icon", methods=["POST"])
    def save_icon(self):
        icon_name = (env.request.parameters.get("name") or "").strip()
        overwrite = str(env.request.parameters.get("overwrite", "")).lower() in ("1", "true")

        level, messages, normalized_svg = self._validate_icon_request(icon_name, env.request.parameters.get("svg"))
        if level == "error":
            return {"status": "error", "message": " ".join(messages)}

        binding_type = (env.request.parameters.get("binding_type") or "").strip()
        binding_value = (env.request.parameters.get("binding_value") or "").strip()
        is_generic = binding_type == GENERIC_TYPE
        if not is_generic and binding_value not in self._load_binding_data()[0].get(binding_type, []):
            return {"status": "error", "message": "Invalid category for this type."}

        icons_dir = self._get_custom_icons_dir()
        icon_path = os.path.join(icons_dir, icon_name + ".svg")
        if os.path.isfile(icon_path) and not overwrite:
            return {"status": "error", "message": "A custom icon with this name already exists."}

        try:
            file_descriptor, temporary_path = tempfile.mkstemp(dir=icons_dir, suffix=".tmp")
            with os.fdopen(file_descriptor, "w", encoding="utf-8") as temporary_file:
                temporary_file.write(normalized_svg)
            os.chmod(temporary_path, 0o666)
            os.replace(temporary_path, icon_path)
        except OSError as write_error:
            return {"status": "error", "message": "FileSystem Error: %s" % write_error}

        try:
            if is_generic:
                self._clear_icon_bindings(icon_name, BINDING_TYPES)
            else:
                self._upsert_custom_binding(binding_type, binding_value, icon_name)
        except OSError as binding_error:
            return {"status": "error", "message": "FileSystem Error: %s" % binding_error}

        return {"status": "success", "message": "Icon saved", "level": level}

    @view.route("/macro_map/delete_icon", methods=["POST"])
    def delete_icon(self):
        icon_name = (env.request.parameters.get("name") or "").strip()
        if not ICON_NAME_PATTERN.match(icon_name):
            return {"status": "error", "message": "Invalid icon name."}

        icon_path = os.path.join(self._get_custom_icons_dir(), icon_name + ".svg")
        if not os.path.isfile(icon_path):
            return {"status": "error", "message": "No custom icon with this name."}

        try:
            os.remove(icon_path)
            self._drop_icon_bindings({icon_name})
        except OSError as delete_error:
            return {"status": "error", "message": "FileSystem Error: %s" % delete_error}

        return {"status": "success", "message": "Icon deleted"}

    @view.route("/macro_map/reset_icons", methods=["POST"])
    def reset_icons(self):
        scope = env.request.parameters.get("scope")
        if scope not in ("overrides", "all"):
            return {"status": "error", "message": "Invalid reset scope."}

        icons_dir = self._get_custom_icons_dir()
        default_names = set(self._list_icon_names(self._get_default_icons_dir()))
        removed_names = []

        for icon_name in self._list_icon_names(icons_dir):
            if scope == "overrides" and icon_name not in default_names:
                continue
            try:
                os.remove(os.path.join(icons_dir, icon_name + ".svg"))
                removed_names.append(icon_name)
            except OSError as delete_error:
                return {"status": "error", "message": "FileSystem Error: %s" % delete_error, "removed": removed_names}

        try:
            self._drop_icon_bindings(set(removed_names))
            if scope == "all":
                self._write_custom_bindings([])
        except OSError as binding_error:
            return {"status": "error", "message": "FileSystem Error: %s" % binding_error, "removed": removed_names}

        return {"status": "success", "removed": removed_names}
