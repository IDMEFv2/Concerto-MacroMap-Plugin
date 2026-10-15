"use strict";

// Thin AJAX wrappers for the macro_map/micro_map server endpoints.

async function fetchAllSvgPlansBulk() {
  const assetRefs = mapEntities
    .map(e => e.entity_name ? String(e.entity_name).trim() : "")
    .filter(Boolean);
  if (!assetRefs.length) {
    _svgPlansCache = {};
    return;
  }
  try {
    const result = await $.ajax({
      url: "/micro_map/get_micro_plans_list_bulk",
      type: "POST",
      data: { asset_refs: JSON.stringify(assetRefs) },
      dataType: "json"
    });
    if (result && typeof result === "object") {
      _svgPlansCache = result;
    } else {
      console.warn("[fetchAllSvgPlansBulk] backend returned non-object result, clearing cache");
      _svgPlansCache = {};
    }
  } catch (e) {
    console.error("[fetchAllSvgPlansBulk] bulk fetch failed:", e);
    _svgPlansCache = {};
  }
}


async function fetchAllAlertsBulk(dates) {
  const entityNames = mapEntities
    .map(e => normalizeMacroEntityKey(e.entity_name))
    .filter(Boolean);

  if (!entityNames.length) {
    return { status: "success", data: {} };
  }

  return $.ajax({
    url: "/macro_map/get_macro_alerts_bulk",
    type: "POST",
    dataType: "json",
    data: {
      entities: JSON.stringify(entityNames),
      start_date: dates.start_date,
      end_date: dates.end_date
    }
  });
}


async function fetchIndependentTargetsBulk(dates) {
  return $.ajax({
    url: "/macro_map/get_independent_targets_bulk",
    type: "POST",
    dataType: "json",
    data: {
      start_date: dates.start_date,
      end_date: dates.end_date
    }
  });
}


async function getMacroDates() {
  var dates = await getMacroTime();

  if (!dates.start_date || !dates.end_date) {
    return null;
  }

  const startDate = convertMacroToISO(dates.start_date);
  const endDate = convertMacroToISO(dates.end_date);

  return {
    start_date: startDate,
    end_date: endDate
  };
}


async function getMacroTime() {
  var time = await $.ajax({
    url: "/macro_map/get_macro_time",
    type: "GET"
  });

  return time;
}


async function navigate_to_table(entityName, alertType) {
  if (entityName || alertType) {
    const body = {
      entity_name: entityName,
      alert_type: alertType
    };

    await $.ajax({
      url: "/macro_map/navigate_to_table",
      type: "POST",
      data: body,
      contentType: "application/json"
    });
  }
}


async function navigate_to_micro_map(assetRef = "", refType = "entity_name", planName = "") {
  const safeAssetRef = String(assetRef || "").trim();
  const safeRefType = String(refType || "entity_name").trim() || "entity_name";
  const safePlanName = String(planName || "").trim();

  await $.ajax({
    url: "/macro_map/navigate_to_micro_map",
    type: "POST",
    data: {
      asset_ref: safeAssetRef,
      ref_type: safeRefType,
      source: "macro_map",
      svg_name: safePlanName
    }
  });
}



async function fetchIconsFromFiles() {
  return $.ajax({
    url: "/macro_map/get_icons",
    method: "GET",
    dataType: "json"
  });
}


async function requestIconValidation(iconName, svgText) {
  return $.ajax({
    url: "/macro_map/validate_icon",
    method: "POST",
    data: { name: iconName, svg: svgText },
    dataType: "json"
  });
}


async function requestIconSave(iconName, svgText, overwrite, bindingType, bindingValue) {
  return $.ajax({
    url: "/macro_map/save_icon",
    method: "POST",
    data: { name: iconName, svg: svgText, overwrite: overwrite, binding_type: bindingType, binding_value: bindingValue },
    dataType: "json"
  });
}


async function requestIconDelete(iconName) {
  return $.ajax({
    url: "/macro_map/delete_icon",
    method: "POST",
    data: { name: iconName },
    dataType: "json"
  });
}


async function requestIconsReset(scope) {
  return $.ajax({
    url: "/macro_map/reset_icons",
    method: "POST",
    data: { scope: scope },
    dataType: "json"
  });
}


async function fetchIconBindings() {
  return $.ajax({ url: "/macro_map/get_icon_bindings", method: "GET", dataType: "json" });
}
