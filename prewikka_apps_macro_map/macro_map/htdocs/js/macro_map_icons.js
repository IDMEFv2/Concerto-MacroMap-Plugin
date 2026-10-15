"use strict";

var fileIconsCache = null;

// Adds a viewBox from numeric width/height when the SVG has none.
function ensureSvgViewBox(svgText) {
  const svgDocument = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svgRoot = svgDocument.documentElement;

  if (!svgRoot || svgRoot.nodeName !== "svg" || svgDocument.querySelector("parsererror")) return null;
  if (svgRoot.hasAttribute("viewBox")) return svgText;

  const svgWidth = parseFloat(svgRoot.getAttribute("width"));
  const svgHeight = parseFloat(svgRoot.getAttribute("height"));
  if (!(svgWidth > 0) || !(svgHeight > 0)) return svgText;

  svgRoot.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
  return new XMLSerializer().serializeToString(svgRoot);
}

// Icons come from the default_icons/ and custom_icons/ folders through get_icons; cached until the catalog is reloaded.
var rejectedIcons = [];

// Drawn in code, not a file of the library: shown wherever an icon name has no icon. It takes the severity colour like the others.
var MISSING_ICON_HTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 18.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25c.691 0 1.25.56 1.25 1.25s-.559 1.25-1.25 1.25zm1.961-5.928c-.904.975-.947 1.514-.935 2.178h-2.005c-.007-1.475.02-2.125 1.431-3.468.573-.544 1.025-.975.962-1.821-.058-.805-.73-1.226-1.365-1.226-.709 0-1.538.527-1.538 2.013h-2.01c0-2.4 1.409-3.95 3.59-3.95 1.036 0 1.942.339 2.55.955.57.578.865 1.372.854 2.298-.016 1.383-.857 2.291-1.534 3.021z"/></svg>';

async function loadIcons() {
  if (fileIconsCache === null) {
    try {
      const response = await fetchIconsFromFiles();
      const fileIcons = [];

      (response && Array.isArray(response.icons) ? response.icons : []).forEach(icon => {
        const normalizedHtml = ensureSvgViewBox(icon.html);
        if (normalizedHtml) fileIcons.push({ class_name: icon.class_name, html: normalizedHtml, origin: icon.origin, overridesDefault: icon.overrides_default });
      });

      fileIconsCache = fileIcons;
      rejectedIcons = response && Array.isArray(response.rejected) ? response.rejected : [];
    } catch (error) {
      console.error("Error loading icons from files", error);
      return [];
    }
  }

  return fileIconsCache;
}

var iconBindingsData = { vocabularies: {}, bindings: [] };
var iconBindingIndex = {};

// Loads the source/target category -> icon associations (defaults plus the user's own).
async function loadIconBindings() {
  try {
    const response = await fetchIconBindings();
    if (response && response.status === "success") {
      iconBindingsData = { vocabularies: response.vocabularies || {}, bindings: response.bindings || [] };
    }
  } catch (error) {
    console.error("Error loading icon bindings", error);
  }

  iconBindingIndex = {};
  iconBindingsData.bindings.forEach(binding => {
    iconBindingIndex[binding.type + "|" + String(binding.value).toLowerCase()] = binding.icon;
  });
}
