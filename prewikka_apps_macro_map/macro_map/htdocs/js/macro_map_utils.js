"use strict";

// Pure, state-free helpers: no DOM/Leaflet access, no AJAX, no shared state mutation.

const DEFAULT_ICON_RULES = [
  {
    ruleType: "percentage",
    metric: "high",
    operator: ">=",
    value: 20,
    color: "#FE0000"
  },
  {
    ruleType: "percentage",
    metric: "medium",
    operator: ">=",
    value: 30,
    color: "#f0ad4e"
  },
  {
    ruleType: "percentage",
    metric: "low",
    operator: ">=",
    value: 0,
    color: "#5cb85c"
  }
];


function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


function normalizeMacroEntityKey(value) {
  return (value ?? "").toString().trim();
}


function countAlerts(array, severity) {
  let count = 0;

  array.forEach(alert => {
    if (alert[1] == severity) {
      count++;
    }
  })
  return count;
}


function buildAlertsSignature(alertRows) {
  if (!Array.isArray(alertRows) || alertRows.length === 0) return "";

  const normalizedRows = alertRows.map(row => {
    if (Array.isArray(row)) {
      return row.map(value => value == null ? "" : String(value)).join("||");
    }

    if (row && typeof row === "object") {
      return Object.keys(row)
        .sort()
        .map(key => `${key}:${row[key] == null ? "" : String(row[key])}`)
        .join("||");
    }

    return String(row);
  });

  normalizedRows.sort();
  return normalizedRows.join("##");
}


function buildAlertDescriptionCache(rows) {
  const descriptions = [];

  (rows || []).forEach(r => {
    const desc = (r && r.length >= 4) ? r[3] : null;
    if (desc != null) {
      const s = desc.toString().trim();
      if (s) descriptions.push(s);
    }
  });

  return {
    alert_descriptions: descriptions,
    alert_text: descriptions.join(" \n ")
  };
}

// Functions to manage related icons


function buildMainIconSignature(obj) {
  const fillColor = resolveColorByRules(obj) || "black";

  return [
    obj.iconType,
    obj.id,
    obj.marker_size,
    obj.nationality,
    fillColor
  ].join("|");
}


function buildBadgeIconSignature(obj) {
  return [
    obj.marker_size,
    obj.display_position,
    obj.name_position,
    obj.display_visible,
    obj.a_high || 0,
    obj.a_medium || 0,
    obj.a_low || 0,
    obj.a_info || 0,
    alertDisplaySize
  ].join("|");
}


function buildNameIconSignature(obj) {
  return [
    obj.marker_size,
    obj.name,
    obj.display_position,
    obj.name_position,
    obj.name_visible,
    nameDisplaySize
  ].join("|");
}


function buildTooltipSignature(obj) {
  return [
    obj.name,
    obj.town,
    obj.nationality,
    obj.a_high || 0,
    obj.a_medium || 0,
    obj.a_low || 0,
    obj.a_info || 0,
    obj.alert_text || ""
  ].join("|");
}


function convertMacroToISO(dateStr) {
  var dt = moment.utc(dateStr, "YYYY-MM-DD HH:mm:ssZ");
  return dt.format("YYYY-MM-DD HH:mm:ss.SSSSSS+00:00");
}
// -------


function escapeRegexLiteral(text) {
  return (text ?? "").toString().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


function compileContainsRegex(userText, matchWholeWord = false) {
  const raw = (userText ?? "").toString().trim();
  if (!raw) return null;

  const safe = escapeRegexLiteral(raw);

  const pattern = matchWholeWord ? `\\b${safe}\\b` : safe;
  return new RegExp(pattern, "i");
}


function computePerc(entity) {
  const a_high = Number(entity.a_high || 0);
  const a_medium = Number(entity.a_medium || 0);
  const a_low = Number(entity.a_low || 0);

  const sum = a_high + a_medium + a_low;

  if (sum <= 0) {
    return { sum: 0, high: 0, medium: 0, low: 0 };
  }

  return {
    sum,
    high: (a_high / sum) * 100,
    medium: (a_medium / sum) * 100,
    low: (a_low / sum) * 100
  };
}


function createDefaultRules() {
  return structuredClone(DEFAULT_ICON_RULES).map(r => ({
    ...r,
    ruleId: generateId()
  }));
}


function getBadgePosClass(badge_position) {
  switch (badge_position) {
    case "Up": return "badge-pos-up";
    case "Down": return "badge-pos-down";
    case "Left": return "badge-pos-left";
    case "Right":
    default: return "badge-pos-right";
  }
}


function getNameBadgePosClass(badge_position, name_position) {
  let result = "";

  switch (name_position) {
    case "Up": result = "badge-pos-up"; break;
    case "Down": result = "badge-pos-down"; break;
    case "Left": result = "badge-pos-left"; break;
    case "Right":
    default: result = "badge-pos-right"; break;
  }

  if (name_position == badge_position) {
    if (badge_position == "Right") {
      result = "badge-pos-up";
    } else {
      result = "badge-pos-right";
    }
  }

  return result;
}


function normalizeMapLayerKey(value) {
  const normalized = (value || "").toString().trim().toLowerCase();
  return MAP_LAYER_CONFIGS[normalized] ? normalized : "osm";
}


function getColor(id) {
  const entity = mapEntities.find(e => e.id == id);
  if (!entity) return "black";

  const color = resolveColorByRules(entity);
  return color || "black";
}


function parseArrayish(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value;

  const s = String(value).trim();
  if (!s) return null;

  try { return JSON.parse(s); } catch (_) { }

  try {
    const jsonish = s.replace(/'/g, '"');
    return JSON.parse(jsonish);
  } catch (_) { }

  return null;
}


function parseGeoPoint(geoValue) {
  const arr = parseArrayish(geoValue);

  if (Array.isArray(arr) && arr.length > 0) {
    if (typeof arr[0] === "string" && arr[0].includes(",")) {
      return parseLatLngString(arr[0]);
    }

    if (arr.length >= 2) {
      const lat = Number(String(arr[0]).replace("+", "").trim());
      const lng = Number(String(arr[1]).replace("+", "").trim());
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }

  if (typeof geoValue === "string" && geoValue.includes(",")) {
    return parseLatLngString(geoValue);
  }

  return null;
}


function parseLatLngString(s) {
  const parts = String(s).split(",");
  if (parts.length < 2) return null;

  const lat = Number(parts[0].replace("+", "").trim());
  const lng = Number(parts[1].replace("+", "").trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}


function parseTimeMs(value) {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) return value;

  const s = String(value).trim();
  if (!s) return null;

  const ms = Date.parse(s);
  if (Number.isFinite(ms)) return ms;

  return null;
}


// First category of the alert (in list order) whose association points to an existing icon.
function findBoundIconName(role, categoryValue) {
  const categories = parseArrayish(categoryValue);
  if (!Array.isArray(categories)) return null;

  for (const category of categories.flat(Infinity)) {
    const iconName = iconBindingIndex[role + "|" + String(category).toLowerCase()];
    if (iconName && dbIcons.some(icon => icon.class_name === iconName)) {
      return iconName;
    }
  }
  return null;
}


function evaluateRule(rule, entity, ctx) {
  if (!rule || !rule.ruleType) {
    return { matched: false };
  }

  switch (rule.ruleType) {
    case "percentage":
      return evaluatePercentageRule(rule, entity, ctx);

    case "regex":
      return evaluateRegexRule(rule, entity, ctx);

    default:
      console.warn("Unknown ruleType:", rule.ruleType, rule);
      return { matched: false };
  }
}


function evaluatePercentageRule(rule, entity, ctx) {
  if (!ctx.perc) {
    ctx.perc = computePerc(entity);
  }

  const metric = (rule.metric || "").toLowerCase();
  const p = ctx.perc[metric];

  if (typeof p !== "number") {
    return { matched: false };
  }

  const op = rule.operator;
  const threshold = Number(rule.value);

  if (!Number.isFinite(threshold)) {
    console.warn("Invalid percentage rule value:", rule);
    return { matched: false };
  }

  let ok = false;
  switch (op) {
    case ">=": ok = p >= threshold; break;
    case ">": ok = p > threshold; break;
    case "<=": ok = p <= threshold; break;
    case "<": ok = p < threshold; break;
    case "==": ok = p === threshold; break;
    default:
      console.warn("Invalid operator in percentage rule:", rule);
      ok = false;
      break;
  }

  if (!ok) return { matched: false };

  return { matched: true, color: rule.color };
}


function evaluateRegexRule(rule, entity, ctx) {
  const patternRaw = (rule.pattern ?? "").toString().trim();
  if (!patternRaw) return { matched: false };

  const haystack = (entity.alert_text ?? "").toString();
  if (!haystack) return { matched: false };

  let re = null;
  try {
    re = new RegExp(patternRaw, "i");
  } catch (e) {
    re = compileContainsRegex(patternRaw);
  }

  if (!re) return { matched: false };
  if (!re.test(haystack)) return { matched: false };

  return { matched: true, color: rule.color };
}


function resolveColorByRules(entity) {
  const rules = entity?.rules || [];
  const ctx = {};

  for (const rule of rules) {
    const res = evaluateRule(rule, entity, ctx);
    if (res && res.matched) {
      return res.color || null;
    }
  }

  return null;
}


