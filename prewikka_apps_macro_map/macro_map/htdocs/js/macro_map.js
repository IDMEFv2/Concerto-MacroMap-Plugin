"use strict";

const SYSTEM_DEFAULT = { center: [47, 10], zoom: 5 };
let defaultView = { ...SYSTEM_DEFAULT };
let sessionView = null;
var map;
var bounds;
var dbIcons;
var mapEntities = [];
let selectedEntityId = null;
let past_positions_limit = 10;
let allBadgesVisible = true;
let allNamesVisible = true;
let showHistory = true;
let allDronesVisible = true;
let allTargetsVisible = true;
let showTargetHistory = true;
let globalSizeEnabled = false;
let globalEntitySize = 32;
let selectedCsvFile = null;
let selectedCsvText = null;
let mapLayer = null;
let alertDisplaySize = 11;
let nameDisplaySize = 11;
let currentMapLayerKey = "osm";
let isRefreshInProgress = false;
let _svgPlansCache = {};
let isRestoringModalState = false;
let independentTargets = [];
let independentTargetLines = {};


const FLAG_PATH = "macro_map/assets/flags/";
const FLAG_STYLE = {
  border: "0.5px solid #333",
  background: "white",
  boxShadow: "1px 1px 3px rgba(0,0,0,0.3)"
};


const MAP_LAYER_CONFIGS = {
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
      noWrap: true,
    }
  },
  // Disabled: CARTO now requires an API key for these tiles (watermarks "API KEY REQUIRED" without one).
  // Pending decision with the coordinator on a replacement (candidate: Esri World Light Gray Canvas, no key required).
  // voyager: {
  //   url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  //   options: {
  //     attribution: "© OpenStreetMap contributors © CARTO",
  //     subdomains: "abcd",
  //     maxZoom: 19,
  //     noWrap: true,
  //   }
  // }
};


async function initializeMap() {
  dbIcons = await loadIcons();
  await loadIconBindings();

  const localData = localStorage.getItem('map_last_view');
  if (localData) {
    try {
      const parsed = JSON.parse(localData);
      sessionView = { center: [parsed.lat, parsed.lng], zoom: parsed.zoom };
    } catch (e) { console.error("Error parsing LocalStorage", e); }
  }

  const startView = sessionView || SYSTEM_DEFAULT;

  const corner1 = L.latLng(-90, -180);
  const corner2 = L.latLng(90, 180);
  bounds = L.latLngBounds(corner1, corner2);

  map = L.map("map", {
    center: startView.center,
    zoom: startView.zoom,
    minZoom: 2.9,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0,
    worldCopyJump: false
  });

  mapLayer = createMapLayer(currentMapLayerKey).addTo(map);

  map.on("zoomend", updateBadgesVisibility);
  map.on("zoomend", updateRelatedIconsVisibility);

  map.on('moveend', function () {
    const state = {
      lat: map.getCenter().lat,
      lng: map.getCenter().lng,
      zoom: map.getZoom()
    };
    localStorage.setItem('map_last_view', JSON.stringify(state));
  });

  await loadSavedMapState();
  await restoreModalState();
  
  initializeDraggableModals();
  initializeResizableModals();
  await initializePresetButtons();

  $("#view-config-edit-mode").off("change").on("change", function () {
    $(".map-controls .controls-button").toggle($(this).prop("checked"));
  }).change();

  $("#close-upload-modal").on("click", function () {
    $('#upload-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    clearModalSessionState();
  })

  $("#close-rules-modal").on("click", function () {
    $('#rules-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    clearModalSessionState();
  })

  $("#add-rule-button").on("click", function () {
    $('#add-rule-button').css('display', 'none');
    $('#insert-rules-div').css('display', 'flex');
  })

  $("#cancel-rules-button").on("click", function () {
    $('#add-rule-button').css('display', 'flex');
    $('#insert-rules-div').css('display', 'none');
  })

  $("#insert-rules-button").on("click", function () {
    addRuleToMarker();
    $('#add-rule-button').css('display', 'flex');
    $('#insert-rules-div').css('display', 'none');
  })

  $("#center_map_on_entity").on("click", function () {
    if (selectedEntityId !== null) {
      const entity = mapEntities.find(e => e.id === selectedEntityId);
      if (entity) {
        centerMapOnEntity(entity);
      }
    }
  });

  $("#center_and_zoom_map_on_entity").on("click", function () {
    if (selectedEntityId !== null) {
      const entity = mapEntities.find(e => e.id === selectedEntityId);
      if (entity) {
        centerAndZoomMapOnEntity(entity);
      }
    }
  });

  $("#download-sample-csv").off("click").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    $.ajax({
      url: "/macro_map/download_sample",
      method: "POST",
      dataType: "json",
      data: { format: "csv" }
    }).done(function (res) {
      if (!res || res.status !== "success") { console.error("Download failed"); return; }
      downloadBase64File(res.filename, res.content_type, res.data_base64);
    }).fail(function (xhr) {
      console.error(xhr.status, xhr.responseText);
      console.error("Download failed");
    });

    return false;
  });

  $("#download-sample-xlsx").off("click").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    $.ajax({
      url: "/macro_map/download_sample",
      method: "POST",
      dataType: "json",
      data: { format: "xlsx" }
    }).done(function (res) {
      if (!res || res.status !== "success") { console.error("Download failed"); return; }
      downloadBase64File(res.filename, res.content_type, res.data_base64);
    }).fail(function (xhr) {
      console.error(xhr.status, xhr.responseText);
      console.error("Download failed");
    });

    return false;
  });

  $("#download-guide").off("click").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    $.ajax({
      url: "/macro_map/download_guide",
      method: "POST",
      dataType: "json",
      data: {}
    }).done(function (res) {
      if (!res || res.status !== "success") { console.error("Download failed"); return; }
      downloadBase64File(res.filename, res.content_type, res.data_base64);
    }).fail(function (xhr) {
      console.error(xhr.status, xhr.responseText);
      console.error("Download failed");
    });

    return false;
  });

  $("#select-csv-button").off("click").on("click", function () {
    $("#csv-file-input").val("");
    $("#csv-file-input").click();
  });

  $("#clear-csv-button").off("click").on("click", function () {
    selectedCsvFile = null;
    selectedCsvText = null;
    $("#csv-filename").val("");
    $("#submit-csv-button").prop("disabled", true);
  });

  $("#submit-csv-button").prop("disabled", true);
  $("#submit-csv-button").off("click").on("click", async function () {
    await submitCsvContentToMap(selectedCsvText);
  });

  $("#csv-file-input").off("change").on("change", function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const isCsv = (file.type && file.type.includes("csv")) || (file.name || "").toLowerCase().endsWith(".csv");
    if (!isCsv) {
      console.error("Please select a CSV file");
      $(this).val("");
      return;
    }

    selectedCsvFile = file;
    $("#csv-filename").val(file.name);

    const reader = new FileReader();
    reader.onload = function (e) {
      selectedCsvText = (e.target.result || "");
      $("#submit-csv-button").prop("disabled", false);
    };
    reader.onerror = function () {
      console.error("Failed to read file");
      selectedCsvFile = null;
      selectedCsvText = null;
      $("#csv-filename").val("");
      $("#submit-csv-button").prop("disabled", true);
    };

    reader.readAsText(file);
  });

  map.on("movestart", function () {
    $("#MacroPopoverOption").hide();
  });

  map.on('click', function () {
    $("#MacroPopoverOption").hide();
  });

  $("#edit_rules").off("click").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const id = selectedEntityId ?? Number($("#MacroPopoverOption").attr("data-selected-entity-id"));
    if (id == null) {
      console.warn("No selected entity");
      return;
    }

    const entity = mapEntities.find(x => x.id == id);
    if (!entity) {
      console.warn("Entity not found:", id);
      return;
    }

    openRulesModal(entity);
    $("#MacroPopoverOption").hide();
  });

  $("#delete_marker").off("click").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this entity? This action cannot be undone.")) {
      return;
    }

    const id = selectedEntityId ?? Number($("#MacroPopoverOption").attr("data-selected-entity-id"));
    if (id == null) {
      console.warn("No selected entity");
      return;
    }

    const entity = mapEntities.find(x => x.id == id);
    if (!entity) {
      console.warn("Entity not found:", id);
      return;
    }

    deleteMarkerFromMap(entity);
    $("#MacroPopoverOption").hide();
  });

  $("#alerts_table").on("click", function () {
    const id = selectedEntityId ?? Number($("#MacroPopoverOption").attr("data-selected-entity-id"));
    if (id == null) {
      console.warn("No selected entity");
      return;
    }

    const entity = mapEntities.find(x => x.id == id);
    if (!entity) {
      console.warn("Entity not found:", id);
      return;
    }

    navigate_to_table(entity.entity_name, undefined);
  })

  $("#call_guard").on("click", function () {
    openEmergencyModal("Guard");
    $("#MacroPopoverOption").hide();
  });

  $("#call_police").on("click", function () {
    openEmergencyModal("Police");
    $("#MacroPopoverOption").hide();
  });

  $("#call_firefighters").on("click", function () {
    openEmergencyModal("Firefighters");
    $("#MacroPopoverOption").hide();
  });

  $("#emergency-submit-button").off("click").on("click", function () {
    $("#emergency-form-fields").hide();
    $("#emergency-confirmation").show();
  });

  $("#emergency-delete-button").off("click").on("click", function () {
    closeEmergencyModal();
  });

  $("#emergency-close-confirmation-button").off("click").on("click", function () {
    closeEmergencyModal();
  });

  $(document).on("change", "#enable-history-tracking", function () {
    $("#past-positions-input").prop("disabled", !$(this).is(":checked"));
  });

  $(document).on("change", "#enable-global-size", function () {
    $("#global-entity-size-input").prop("disabled", !$(this).is(":checked"));
  });

  
  // Update navigation function to accept planName
  window.navigate_to_micro_map = function(assetRef, refType, planName) {
      console.log(planName)
      const safeAssetRef = String(assetRef || "").trim();
      const safeRefType = String(refType || "entity_name").trim() || "entity_name";
      const safePlanName = String(planName || "").trim();

      console.log(safePlanName);

      // Set navigation context and redirect
      $.ajax({
        url: "/macro_map/navigate_to_micro_map",
        type: "POST",
        data: {
          asset_ref: safeAssetRef,
          ref_type: safeRefType,
          source: "macro_map",
          svg_name: safePlanName
        },
        complete: function(xhr, status) {
          window.location.href = "/micro_map";
        }
      });
    };

  bindRulesEditor("#rules-grid-container");
  bindModalSessionAutoSave();
}


function openUploadModal(shouldPersistState = true) {
  initializeDraggableModals();
  $("#upload-modal").css('display', 'flex');
  centerModal($("#upload-modal"));
  $('#modal-mask').css('display', 'flex');
  if (shouldPersistState) {
    saveModalSessionState('upload-modal');
  }
}


function fadeIn() {
  $('#wrapper').removeClass('hidden').addClass('visible');
}


function buildMicroMapMenuForEntity(entity) {
  const assetRef = entity && entity.entity_name ? String(entity.entity_name).trim() : "";
  if (!assetRef) {
    return [{ label: "Open Micro Map", planName: "", action: () => window.navigate_to_micro_map("", "entity_name", "") }];
  }
  const plans = (Array.isArray(_svgPlansCache[assetRef]) ? _svgPlansCache[assetRef] : [])
    .map((name) => String(name || "").trim())
    .filter(Boolean);
  if (plans.length > 0) {
    return plans.map(planName => ({
      label: planName,
      planName: planName,
      action: () => window.navigate_to_micro_map(assetRef, "entity_name", planName)
    }));
  } else {
    return [{ label: "Open Micro Map", planName: "", action: () => window.navigate_to_micro_map(assetRef, "entity_name", "") }];
  }
}


function updateEntityDataAndGraphics(obj, alerts, addToMapNow = true) {
  if (Array.isArray(alerts)) {
    obj._lastAlertsSignature = buildAlertsSignature(alerts);
    obj.a_high = 0; obj.a_medium = 0; obj.a_low = 0; obj.a_info = 0;

    if (alerts.length > 0) {
      obj.a_high = countAlerts(alerts, "High");
      obj.a_medium = countAlerts(alerts, "Medium");
      obj.a_low = countAlerts(alerts, "Low");
      obj.a_info = countAlerts(alerts, "Info");

      const cache = buildAlertDescriptionCache(alerts);
      obj.alert_text = cache.alert_text;
      obj._alertDescLoaded = true;
    } else {
      obj.alert_text = "";
      obj._alertDescLoaded = true;
    }

    syncRelatedIconsFromAlerts(obj, alerts, addToMapNow);
  }

  const newIcon = assignIcon(obj.iconType, obj.id, obj.marker_size, obj.nationality);
  const mainIconSignature = buildMainIconSignature(obj);
  const badgeIconSignature = buildBadgeIconSignature(obj);
  const nameIconSignature = buildNameIconSignature(obj);
  const tooltipSignature = buildTooltipSignature(obj);

  if (obj.marker) {
    if (obj._mainIconSignature !== mainIconSignature) {
      obj.marker.setIcon(newIcon);
      obj._mainIconSignature = mainIconSignature;
    }

    if (obj.badge_marker && obj._badgeIconSignature !== badgeIconSignature) {
      obj.badge_marker.setIcon(buildBadgeIcon(obj));
      obj._badgeIconSignature = badgeIconSignature;
    }

    if (obj.name_marker && obj._nameIconSignature !== nameIconSignature) {
      obj.name_marker.setIcon(buildNameBadge(obj));
      obj._nameIconSignature = nameIconSignature;
    }

    if (obj._tooltipSignature !== tooltipSignature) {
      const updatedContent = createEntityTooltipHtml(obj);
      obj.marker.setTooltipContent(updatedContent);
      obj._tooltipSignature = tooltipSignature;
    }
  } else {
    obj.marker = L.marker([obj.lat, obj.lng], { icon: newIcon });
    obj.badge_marker = L.marker([obj.lat, obj.lng], { icon: buildBadgeIcon(obj), interactive: true });
    obj.name_marker = L.marker([obj.lat, obj.lng], { icon: buildNameBadge(obj), interactive: false });
    obj._mainIconSignature = mainIconSignature;
    obj._badgeIconSignature = badgeIconSignature;
    obj._nameIconSignature = nameIconSignature;

    if (addToMapNow) {
      obj.marker.addTo(map);
      // Secondary markers are mounted only when actually visible.
      applyBadgeVisibility(obj);
      applyNameVisibility(obj);
    }

    const tooltipHtml = createEntityTooltipHtml(obj);
    obj.marker.bindTooltip(tooltipHtml, {
      permanent: false,
      direction: 'top',
      offset: [0, -10],
      className: 'entity-rich-tooltip'
    });
    obj._tooltipSignature = tooltipSignature;

    obj.marker.on('click', function () {
      selectedEntityId = obj.id;
      $("#MacroPopoverOption").attr("data-selected-entity-id", obj.id);
      const microMapUl = $("#MacroPopoverOption .popover li").filter(function() {
        return $(this).children("a").text().trim() === "Micro Map";
      }).first().children("ul.dropdown-menu").first();
      if (microMapUl.length) {
        microMapUl.empty();
        const items = buildMicroMapMenuForEntity(obj);
        items.forEach(item => {
          const li = $("<li><a href='#'>" + item.label + "</a></li>");
          li.on("click", function(e) {
            e.preventDefault();
            e.stopPropagation();
            $("#MacroPopoverOption").hide();
            const clickedPlanName = String(item.planName || item.label || "").trim();
            window.navigate_to_micro_map(obj.entity_name, "entity_name", clickedPlanName);
          });
          microMapUl.append(li);
        });
      } else {
        console.warn("[marker.click] Micro Map submenu container not found in popover");
      }
      show_popover($(this._icon));
    });
  }
}


function getEntityAlertsFromBulkData(bulkData, entity) {
  if (!entity) return [];
  const normalizedKey = normalizeMacroEntityKey(entity.entity_name);
  return (bulkData && (bulkData[normalizedKey] || bulkData[entity.entity_name])) || [];
}


function setRefreshButtonState(isLoading) {
  const $button = $("#refresh-data");
  if (!$button.length) return;

  $button.prop("disabled", isLoading);
  $button.attr("title", isLoading ? "Refreshing data..." : "Refresh data");
}


async function refreshMacroData() {
  if (isRefreshInProgress) {
    return;
  }

  isRefreshInProgress = true;
  setRefreshButtonState(true);

  try {
    const dates = await getMacroDates();
    if (!dates) {
      return;
    }

    const response = await fetchAllAlertsBulk(dates);
    if (!response || response.status !== "success") {
      return;
    }

    const bulkData = response.data || {};
    let changedEntities = 0;

    mapEntities.forEach(entity => {
      const entityAlerts = getEntityAlertsFromBulkData(bulkData, entity);
      const nextSignature = buildAlertsSignature(entityAlerts);
      const currentSignature = entity._lastAlertsSignature || "";

      if (nextSignature === currentSignature) {
        return;
      }

      updateEntityDataAndGraphics(entity, entityAlerts, true);
      changedEntities += 1;
    });

    if (changedEntities > 0) {
      updateBadgesVisibility();
      updateRelatedIconsVisibility();
    }

    const independentTargetsResponse = await fetchIndependentTargetsBulk(dates);
    if (independentTargetsResponse && independentTargetsResponse.status === "success") {
      syncIndependentTargets(independentTargetsResponse.data || []);
    }
  } catch (err) {
    console.error("Manual refresh failed", err);
  } finally {
    setRefreshButtonState(false);
    isRefreshInProgress = false;
  }
}


function createEntityTooltipHtml(obj) {
  let nameDiv = `<div style="font-weight: bold; font-size: 13px;">
        ${obj.name}
      </div>`;

  // Flag
  const sanitizedFlag = obj.nationality ? obj.nationality.trim().toLowerCase() : null;
  
  if(sanitizedFlag) {
    nameDiv = `<div style="font-weight: bold; font-size: 13px; display: flex; justify-content: center; align-items: center; gap: 4px;">
        ${obj.name}
        <img src="${FLAG_PATH}${sanitizedFlag}.svg" 
               style="width: 16px; height: 14px; object-fit: cover; display: block;"
               onerror="this.parentElement.style.display='none';">
      </div>`;
  }
  
  return `
    <div style="text-align: center; min-width: 120px; padding: 2px;">
      ${nameDiv}
      ${obj.town ? `<div style="font-style: italic; color: #666; font-size: 11px;">${obj.town}</div>` : ''}
      ${getMacroAlertsHtmlForTooltip(obj)}
    </div>
  `;
}


function assignIcon(iconType, id, size, flagCode = null) {
  const finalSize = Number(size) || 32;
  const badgeSize = Math.round(finalSize / 2);

  const fillColor = getColor(id);
  const found_icon = dbIcons.find(x => x.class_name === iconType);

  // Main icon (Asset)
  let mainIconHtml = found_icon ?
    `<div class="icon-colour icon-outlined" style="color:${fillColor}; fill:${fillColor};">${found_icon.html}</div>` :
    `<div class="icon-colour icon-outlined" style="color:${fillColor}; fill:${fillColor};">${MISSING_ICON_HTML}</div>`;

  // Sanitize flag code
  const sanitizedFlag = flagCode ? flagCode.trim().toLowerCase() : null;

  const combinedHtml = `
    <div style="position: relative; width: ${finalSize}px; height: ${finalSize}px;">
      <div style="width: 100%; height: 100%; position: relative; z-index: 1;">
        ${mainIconHtml}
      </div>

      ${sanitizedFlag ? `
        <div class="flag-badge" style="
            position: absolute; 
            bottom: -3px; 
            left: -3px; 
            width: ${badgeSize}px; 
            height: ${badgeSize}px; 
            border: ${FLAG_STYLE.border}; 
            background: ${FLAG_STYLE.background}; 
            box-shadow: ${FLAG_STYLE.boxShadow};
            overflow: hidden;
            border-radius: 2px;
            z-index: 100;"> <img src="${FLAG_PATH}${sanitizedFlag}.svg" 
               style="width: 100%; height: 100%; object-fit: cover; display: block;"
               onerror="this.parentElement.style.display='none';">
        </div>
      ` : ''}
    </div>
  `;

  return L.divIcon({
    className: "map-icon-combined",
    html: combinedHtml,
    iconSize: [finalSize, finalSize],
    iconAnchor: [finalSize / 2, finalSize / 2],
  });
}


function buildBadgeIcon(obj) {
  return L.divIcon({
    className: "badge-icon",
    html: createBadgeHtml(obj),
    iconSize: null
  });
}


function buildNameBadge(obj) {
  return L.divIcon({
    className: "name-icon",
    html: createNameBadgeHtml(obj),
    iconSize: null
  });
}


function createBadgeHtml(obj) {
  const posClass = getBadgePosClass(obj.display_position, obj.name_position);
  const sizePx = Number(obj.marker_size) || 32;
  const radiusPx = sizePx / 2;

  const currentZoom = map ? map.getZoom() : 0;
  const isClickable = currentZoom >= obj.display_visible;

  const getOnClick = (type) => {
    return isClickable ? `onclick="navigate_to_table('${obj.entity_name}', '${type}')"` : "";
  };

  return `
    <div class="badge-box ${posClass}" style="--icon-radius:${radiusPx}px; cursor: ${isClickable ? 'pointer' : 'default'}; font-size:${alertDisplaySize}px;">
      <span class="h" ${getOnClick('High')}>${obj.a_high || 0}</span>
      <span class="m" ${getOnClick('Medium')}>${obj.a_medium || 0}</span>
      <span class="l" ${getOnClick('Low')}>${obj.a_low || 0}</span>
      <span class="i" ${getOnClick('Info')}>${obj.a_info || 0}</span>
    </div>
  `;
}


function createNameBadgeHtml(obj) {
  const posClass = getNameBadgePosClass(obj.display_position, obj.name_position);

  const sizePx = Number(obj.marker_size) || 32;
  const radiusPx = sizePx / 2;

  return `
    <div class="badge-box ${posClass}" style="--icon-radius:${radiusPx}px; font-size:${nameDisplaySize}px;">
      <span class="name-display">${obj.name}</span>
    </div>
  `;
}


function updateBadgesVisibility() {
  if (!map) return;
  const zoom = map.getZoom();

  mapEntities.forEach(obj => {
    applyBadgeVisibility(obj, zoom);
    applyNameVisibility(obj, zoom);
  });
}


function setLayerVisibility(layer, shouldShow) {
  if (!map || !layer) return;

  const isOnMap = map.hasLayer(layer);
  if (shouldShow && !isOnMap) {
    layer.addTo(map);
  } else if (!shouldShow && isOnMap) {
    map.removeLayer(layer);
  }
}


function applyBadgeVisibility(obj, currentZoom = null) {
  if (!obj || !obj.badge_marker || !map) return false;

  const zoom = currentZoom == null ? map.getZoom() : currentZoom;
  const visibleByZoom = zoom >= obj.display_visible;
  const shouldShow = visibleByZoom && allBadgesVisible;
  const shouldBeClickable = visibleByZoom;

  if (obj._badgeVisibleState !== shouldShow) {
    setLayerVisibility(obj.badge_marker, shouldShow);
    obj._badgeVisibleState = shouldShow;
  }

  // Rebuild badge HTML only when clickability threshold changes.
  if (obj._badgeClickableState !== shouldBeClickable) {
    obj.badge_marker.setIcon(buildBadgeIcon(obj));
    obj._badgeClickableState = shouldBeClickable;
  }

  if (shouldShow && obj.badge_marker._icon) {
    const pointerEvents = shouldShow ? "auto" : "none";
    if (obj.badge_marker._icon.style.pointerEvents !== pointerEvents) {
      obj.badge_marker._icon.style.pointerEvents = pointerEvents;
    }
  }

  return visibleByZoom;
}


function applyNameVisibility(obj, currentZoom = null) {
  if (!obj || !obj.name_marker || !map) return false;

  const zoom = currentZoom == null ? map.getZoom() : currentZoom;
  const visibleByZoom = zoom >= obj.name_visible;
  const shouldShow = visibleByZoom && allNamesVisible;

  if (obj._nameVisibleState !== shouldShow) {
    setLayerVisibility(obj.name_marker, shouldShow);
    obj._nameVisibleState = shouldShow;
  }

  if (shouldShow && obj.name_marker._icon) {
    if (obj.name_marker._icon.style.pointerEvents !== "none") {
      obj.name_marker._icon.style.pointerEvents = "none";
    }
  }

  return visibleByZoom;
}


function downloadBase64File(filename, contentType, base64Data) {
  const binary = atob(base64Data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

  const blob = new Blob([bytes], { type: contentType || "application/octet-stream" });

  saveAs(blob, filename || "download");
}


async function initializePresetButtons() {
  const container = $("#presets-div");
  if (!container.length) return;

  container.empty();

  try {
    const res = await $.ajax({
      url: "/macro_map/list_presets",
      method: "GET",
      dataType: "json"
    });

    const presets = Array.isArray(res?.presets) ? res.presets : [];

    if (presets.length === 0) {
      container.append($("<span>", { text: "No presets available" }));
      return;
    }

    presets.forEach(preset => {
      const filename = (preset?.filename || "").toString();
      if (!filename) return;

      const displayName = (preset?.display_name || filename).toString();
      const button = $("<button>", {
        type: "button",
        class: "btn btn-primary",
        text: displayName
      });

      button.on("click", async function () {
        await loadPresetAndSubmit(filename);
      });

      container.append(button);
    });
  } catch (xhr) {
    console.error(xhr?.status, xhr?.responseText);
    console.error("Failed to load presets");
    container.append($("<span>", { text: "Failed to load presets" }));
  }
}


async function loadPresetAndSubmit(filename) {
  if (!filename) return;

  try {
    const res = await $.ajax({
      url: "/macro_map/load_preset",
      method: "POST",
      dataType: "json",
      data: { filename: filename }
    });

    if (!res || res.status !== "success") {
      console.error("Failed to load preset");
      return;
    }

    selectedCsvFile = null;
    selectedCsvText = (res.csv_content || "").toString();
    $("#csv-filename").val(res.filename || filename);
    $("#submit-csv-button").prop("disabled", !selectedCsvText);

    await submitCsvContentToMap(selectedCsvText);
  } catch (xhr) {
    console.error(xhr?.status, xhr?.responseText);
    console.error("Failed to load preset");
  }
}


async function submitCsvContentToMap(csvText) {
  if (!csvText) {
    console.error("No CSV loaded");
    return;
  }

  try {
    const res = await $.ajax({
      url: "/macro_map/upload_csv",
      method: "POST",
      dataType: "json",
      data: { csv_content: csvText }
    });

    if (!res || res.status !== "success") {
      console.error("Upload failed");
      return;
    }

    await renderUploadedAssetsOnMap(res.assets || []);

    $('#upload-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
  } catch (xhr) {
    console.error(xhr?.status, xhr?.responseText);
    console.error("Upload failed (server error)");
  }
}


async function renderUploadedAssetsOnMap(assets) {
  clearAllMarkersFromMap(map);
  mapEntities = [];

  const dates = await getMacroDates();
  if (!dates) return;

  (assets || []).forEach(a => {
    const obj = {
      id: generateId(),
      iconType: a.iconType,
      lat: a.lat,
      lng: a.lng,
      marker_size: globalSizeEnabled ? globalEntitySize : (a.marker_size || 32),
      name: a.name,
      town: a.town,
      name_position: a.name_position,
      name_visible: a.name_visible,
      display_position: a.display_position,
      display_visible: a.display_visible,
      entity_name: a.entity_name,
      links_to: a.links_to || "",
      nationality: a.nationality || "",
      marker: undefined,
      name_marker: undefined,
      badge_marker: undefined,
      a_high: 0, a_medium: 0, a_low: 0, a_info: 0,
      rules: createDefaultRules(),
      related_icons: []
    };
    mapEntities.push(obj);
  });

  if (mapEntities.length > 0) {
    try {
      const response = await fetchAllAlertsBulk(dates);
      if (response && response.status === "success") {
        const allAlerts = response.data;

        mapEntities.forEach(obj => {
          const entityKey = normalizeMacroEntityKey(obj.entity_name);
          const entityAlerts = allAlerts[entityKey] || allAlerts[obj.entity_name] || [];
          updateEntityDataAndGraphics(obj, entityAlerts, true);
        });
      }
    } catch (e) {
      console.error("Bulk load during upload failed", e);
      mapEntities.forEach(obj => updateEntityDataAndGraphics(obj, [], true));
    }
    await fetchAllSvgPlansBulk();
  }

  try {
    const independentTargetsResponse = await fetchIndependentTargetsBulk(dates);
    if (independentTargetsResponse && independentTargetsResponse.status === "success") {
      syncIndependentTargets(independentTargetsResponse.data || []);
    }
  } catch (e) {
    console.error("Independent targets fetch failed", e);
  }

  drawInfrastructureLinks();
  updateBadgesVisibility();
  updateRelatedIconsVisibility();

  if (mapEntities.length > 0) {
    const points = mapEntities.map(e => [e.lat, e.lng]);
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [50, 50] });

    defaultView = {
      center: [map.getCenter().lat, map.getCenter().lng],
      zoom: map.getZoom()
    };
    saveCurrentMapState();
  }
}


function clearAllMarkersFromMap(map) {
  if (!map) return;

  mapEntities.forEach(entity => {
    if (entity.marker && map.hasLayer(entity.marker)) map.removeLayer(entity.marker);
    if (entity.badge_marker && map.hasLayer(entity.badge_marker)) map.removeLayer(entity.badge_marker);
    if (entity.name_marker && map.hasLayer(entity.name_marker)) map.removeLayer(entity.name_marker);
    removeAllRelatedIcons(entity);
  });

  if (window.infrastructureLayerGroup) {
    window.infrastructureLayerGroup.clearLayers();
  }
}


function deleteMarkerFromMap(entity) {
  if (!entity) return;
  if (entity.marker) map.removeLayer(entity.marker);
  if (entity.badge_marker) map.removeLayer(entity.badge_marker);
  if (entity.name_marker) map.removeLayer(entity.name_marker);
  removeAllRelatedIcons(entity);
  mapEntities = mapEntities.filter(e => e.id !== entity.id);
  drawInfrastructureLinks();
  saveCurrentMapState();
  $("#MacroPopoverOption").hide();
}

// Functions to render the rules grid


function openRulesModal(entity, shouldPersistState = true) {
  initializeDraggableModals();
  $("#rules-modal").css("display", "flex");
  $("#modal-mask").css("display", "flex");
  
  $("#rules-modal-title").text(`Rules for: ${entity.entity_name || entity.name || entity.id}`);
  
  const container = document.querySelector("#rules-grid-container");
  renderRulesGrid(container, entity);
  centerModal($("#rules-modal"));
  if (shouldPersistState) {
    saveModalSessionState('rules-modal', entity.id);
  }
}


function renderRulesGrid(containerEl, entity) {
  const rules = entity.rules || [];
  containerEl.innerHTML = "";

  rules.forEach((rule, idx) => {
    containerEl.insertAdjacentHTML("beforeend", `
      <div class="rules-grid">
        <div class="rule-index">#${idx + 1}</div>
        ${renderRuleContentCell(rule)}
        <div class="rule-delete" data-rule-id="${rule.ruleId}">✕</div>
      </div>
    `);
  });

  containerEl.dataset.entityId = entity.id;
}


function renderRuleContentCell(rule) {
  const ruleId = rule.ruleId;
  const type = rule.ruleType;

  const colorOptions = `
    <option value="#FE0000" ${rule.color === "#FE0000" ? "selected" : ""}>Red</option>
    <option value="#f0ad4e" ${rule.color === "#f0ad4e" ? "selected" : ""}>Yellow</option>
    <option value="#5cb85c" ${rule.color === "#5cb85c" ? "selected" : ""}>Green</option>
  `;

  if (type === "percentage") {
    return `
      <div class="rule-content" data-rule-id="${ruleId}">
        <span>When</span>

        <select name="alert" id="alert-select-${ruleId}" class="rule-input" data-field="metric">
          <option value="high" ${rule.metric === "high" ? "selected" : ""}>High</option>
          <option value="medium" ${rule.metric === "medium" ? "selected" : ""}>Medium</option>
          <option value="low" ${rule.metric === "low" ? "selected" : ""}>Low</option>
        </select>

        <span>priority alerts are</span>

        <select name="operator" id="operator-select-${ruleId}" class="rule-input" data-field="operator">
          <option value=">" ${rule.operator === ">" ? "selected" : ""}>&gt;</option>
          <option value="<" ${rule.operator === "<" ? "selected" : ""}>&lt;</option>
          <option value=">=" ${rule.operator === ">=" ? "selected" : ""}>&gt;=</option>
          <option value="<=" ${rule.operator === "<=" ? "selected" : ""}>&lt;=</option>
          <option value="==" ${rule.operator === "==" ? "selected" : ""}>=</option>
        </select>

        <input
          type="number"
          id="percentage-${ruleId}"
          name="percentage"
          required
          minlength="1"
          maxlength="3"
          min="0"
          max="100"
          step="1"
          inputmode="numeric"
          placeholder="50"
          class="rule-input"
          data-field="value"
          value="${Number.isFinite(Number(rule.value)) ? Number(rule.value) : ""}"
        />

        <span>% turn</span>

        <select name="alert" id="color-select-${ruleId}" class="rule-input" data-field="color">
          ${colorOptions}
        </select>
      </div>
    `;
  }

  if (type === "regex") {
    return `
      <div class="rule-content" data-rule-id="${ruleId}">
        <span>Turn</span>

        <select name="alert" id="color-select-${ruleId}" class="rule-input" data-field="color">
          ${colorOptions}
        </select>

        <span>when the word</span>

        <input
          type="text"
          id="keyword-${ruleId}"
          name="keyword"
          required
          minlength="1"
          maxlength="50"
          class="rule-input"
          data-field="pattern"
          value="${(rule.pattern ?? "")}"
        />

        <span>is found in an alert's description</span>
      </div>
    `;
  }

  return `
    <div class="rule-content" data-rule-id="${ruleId}">
      <span>Unsupported ruleType: ${type}</span>
    </div>
  `;
}


function bindRulesEditor(containerSelector) {
  const containerEl = document.querySelector(containerSelector);
  if (!containerEl) return;

  containerEl.addEventListener("change", (e) => {
    const el = e.target;
    if (!el.classList.contains("rule-input")) return;

    const entityId = containerEl.dataset.entityId;
    const entity = mapEntities.find(x => x.id == entityId);
    if (!entity) return;

    const ruleId = el.closest(".rule-content")?.dataset.ruleId;
    if (!ruleId) return;

    const rule = entity.rules.find(r => r.ruleId === ruleId);
    if (!rule) return;

    const field = el.dataset.field;
    let value = el.value;

    if (field === "value") value = Number(value);

    rule[field] = value;

    refreshEntityIcon(entity);

    saveCurrentMapState();
  });

  containerEl.addEventListener("click", (e) => {
    const del = e.target.closest(".rule-delete");
    if (!del) return;

    const entityId = containerEl.dataset.entityId;
    const entity = mapEntities.find(x => x.id == entityId);
    if (!entity) return;

    const ruleId = del.dataset.ruleId;
    const idx = entity.rules.findIndex(r => r.ruleId === ruleId);
    if (idx < 0) return;

    entity.rules.splice(idx, 1);

    renderRulesGrid(containerEl, entity);

    refreshEntityIcon(entity);

    saveCurrentMapState();
  });
}


function refreshEntityIcon(entity) {
  if (!entity?.marker) return;

  const newIcon = assignIcon(
    entity.iconType,
    entity.id,
    entity.marker_size,
    entity.nationality
  );

  entity.marker.setIcon(newIcon);
  entity._mainIconSignature = buildMainIconSignature(entity);
}


function addRuleToMarker() {
  const id = selectedEntityId ?? Number($("#MacroPopoverOption").attr("data-selected-entity-id"));
  if (id == null) {
    console.warn("No entity selected");
    return;
  }

  const entity = mapEntities.find(x => x.id == id);
  if (!entity) {
    console.warn("Entity not found:", id);
    return;
  }

  const ruleType = $("#type-dropdown").val();
  const position = parseInt($("#position-input").val()) || 1;

  let newRule = {
    ruleId: generateId(),
    ruleType: ruleType
  };

  if (ruleType === "percentage") {
    newRule = {
      ...newRule,
      metric: "high",
      operator: ">=",
      value: 50,
      color: "#FE0000"
    };
  } else if (ruleType === "regex") {
    newRule = {
      ...newRule,
      pattern: "",
      color: "#FE0000"
    };
  }

  const insertPos = Math.max(0, Math.min(position - 1, entity.rules.length));
  entity.rules.splice(insertPos, 0, newRule);

  const containerEl = document.querySelector("#rules-grid-container");
  renderRulesGrid(containerEl, entity);
  refreshEntityIcon(entity);

  saveCurrentMapState();
}

// Functions to control the icon's color


function show_popover(node) {
  var popover = $("#MacroPopoverOption .popover");

  $("#MacroPopoverOption").css({ "visibility": "hidden", "display": "block" });

  var offset = node.offset();
  var top, left = offset.left - popover.width() / 2 + node.width() / 2;

  popover.find(".dropdown-submenu").removeClass("pull-left");
  popover.removeClass("bottom top left right menu-left");

  if (left < 0) {
    /* Handle the case of a narrow column near the left side of the grid */
    popover.addClass("right");
    top = offset.top - popover.height() / 2 + node.height() / 2;
    left = offset.left + node.width();
  }
  else if (left + popover.width() > window.innerWidth) {
    /* Handle the case of a narrow column near the right side of the grid */
    popover.addClass("left");
    top = offset.top - popover.height() / 2 + node.height() / 2;
    left = offset.left - popover.width();
  }
  /* Otherwise, expand the menu upwards or downwards, and the submenu
  * leftwards or rightwards, according to where the most space is available */
  else if (window.innerHeight - (offset.top + node.height()) > offset.top) {
    popover.addClass("bottom");
    top = offset.top + node.height();
  }
  else {
    popover.addClass("top");
    top = offset.top - (node.height() / 2 + popover.height());
  }
  if (window.innerWidth - (offset.left + node.width()) < offset.left) {
    popover.addClass("menu-left");
    popover.find(".dropdown-submenu").addClass("pull-left");
  }

  $("#MacroPopoverOption").css({ "top": top, "left": left, "visibility": "visible" });
}

// Functions to obtain the date and convert the format


function setDefaultPosition() {
  if (map) {
    const center = map.getCenter();
    defaultView = {
      center: [center.lat, center.lng],
      zoom: map.getZoom()
    };
    saveCurrentMapState();
  }
}


function resetMapPosition() {
  if (map) {
    map.setView(defaultView.center, defaultView.zoom);
  }
}


function centerMapOnEntity(entity) {
  if (map && entity) {
    map.setView([entity.lat, entity.lng], map.getZoom());
  }
}


function centerAndZoomMapOnEntity(entity) {
  if (map && entity) {
    map.setView([entity.lat, entity.lng], (map.getMaxZoom() - 2));
  }
}


async function loadSavedMapState() {
  try {
    const res = await $.ajax({
      url: "/macro_map/load_macro_state",
      method: "GET",
      dataType: "json"
    });

    if (!res || res.status === "error" || res.status === "no_data") return;

    if (res.global_settings) {
      allNamesVisible = res.global_settings.names_visible ?? true;
      allBadgesVisible = res.global_settings.badges_visible ?? true;
      allDronesVisible = res.global_settings.drones_visible ?? true;
      allTargetsVisible = res.global_settings.targets_visible ?? true;
      showHistory = res.global_settings.show_history ?? true;
      showTargetHistory = res.global_settings.show_target_history ?? true;
      globalSizeEnabled = res.global_settings.global_size_enabled ?? res.global_settings.global_size ?? false;
      const savedGlobalSize = Number(res.global_settings.global_size_value ?? globalEntitySize);
      globalEntitySize = Number.isFinite(savedGlobalSize) && savedGlobalSize >= 1 ? savedGlobalSize : 32;
      past_positions_limit = res.global_settings.history_limit ?? 10;
      alertDisplaySize = Number(res.global_settings.alert_display_size ?? alertDisplaySize) || 11;
      nameDisplaySize = Number(res.global_settings.name_display_size ?? nameDisplaySize) || 11;
      const savedMapLayerKey = normalizeMapLayerKey(res.global_settings.map_layer);
      if (savedMapLayerKey !== currentMapLayerKey) {
        setMapLayer(savedMapLayerKey);
      }
    }

    if (res.map_config) {
      defaultView = {
        center: res.map_config.center,
        zoom: res.map_config.zoom
      };

      if (!localStorage.getItem('map_last_view')) {
        map.setView(defaultView.center, defaultView.zoom);
      }
    }

    let rawAssets = [];
    if (res.assets && Array.isArray(res.assets)) {
      rawAssets = res.assets;
    } else if (res.assets && res.assets.assets) {
      rawAssets = res.assets.assets;
    }

    const dates = await getMacroDates();
    clearAllMarkersFromMap(map);
    mapEntities = [];

    rawAssets.forEach(a => {
      const obj = {
        ...a,
        marker: undefined,
        name_marker: undefined,
        badge_marker: undefined,
        related_icons: [],
        links_to: a.links_to || "",
        nationality: a.nationality || ""
      };

      if (globalSizeEnabled) {
        obj.marker_size = globalEntitySize;
      }

      mapEntities.push(obj);
    });

    if (mapEntities.length > 0 && dates) {
      try {
        const bulkRes = await fetchAllAlertsBulk(dates);

        if (bulkRes && bulkRes.status === "success") {
          const allAlerts = bulkRes.data;

          mapEntities.forEach(obj => {
            const entityKey = normalizeMacroEntityKey(obj.entity_name);
            const entityAlerts = allAlerts[entityKey] || allAlerts[obj.entity_name] || [];
            updateEntityDataAndGraphics(obj, entityAlerts, true);
          });
        }
      } catch (bulkErr) {
        console.error("Bulk alerts load failed:", bulkErr);
        mapEntities.forEach(obj => updateEntityDataAndGraphics(obj, [], true));
      }
      await fetchAllSvgPlansBulk();
    }

    if (dates) {
      try {
        const independentTargetsResponse = await fetchIndependentTargetsBulk(dates);
        if (independentTargetsResponse && independentTargetsResponse.status === "success") {
          syncIndependentTargets(independentTargetsResponse.data || []);
        }
      } catch (e) {
        console.error("Independent targets fetch failed", e);
      }
    }

    drawInfrastructureLinks();
    updateBadgesVisibility();
    updateRelatedIconsVisibility();
  } catch (err) {
    console.error("Error loading state:", err);
  }
}


function saveCurrentMapState() {
  const assetsToSave = mapEntities.map(e => ({
    id: e.id,
    iconType: e.iconType,
    lat: e.lat, lng: e.lng,
    marker_size: e.marker_size,
    name: e.name, town: e.town,
    name_position: e.name_position,
    name_visible: e.name_visible,
    display_position: e.display_position,
    display_visible: e.display_visible,
    entity_name: e.entity_name,
    links_to: e.links_to || "",
    nationality: e.nationality || "",
    rules: e.rules || [],
  }));

  const stateToSave = {
    map_config: defaultView,
    global_settings: {
      names_visible: allNamesVisible,
      badges_visible: allBadgesVisible,
      drones_visible: allDronesVisible,
      targets_visible: allTargetsVisible,
      show_history: showHistory,
      show_target_history: showTargetHistory,
      global_size: globalSizeEnabled,
      global_size_enabled: globalSizeEnabled,
      global_size_value: globalEntitySize,
      history_limit: past_positions_limit,
      map_layer: currentMapLayerKey,
      alert_display_size: alertDisplaySize,
      name_display_size: nameDisplaySize
    },
    assets: assetsToSave
  };

  $.ajax({
    url: "/macro_map/save_state",
    method: "POST",
    data: { state_data: JSON.stringify(stateToSave) }
  });
}


function normalizeModalPositionForDrag(modalElement, ui) {
  const rect = modalElement.getBoundingClientRect();

  $(modalElement).css({
    transform: "none",
    left: `${rect.left}px`,
    top: `${rect.top}px`
  });

  ui.position.left = rect.left;
  ui.position.top = rect.top;
}


function initializeDraggableModals() {
  if (typeof $.fn.draggable !== "function") return;

  $("[data-draggable]").each(function () {
    const $handle = $(this);
    const $modal = $handle.closest(".crud-modal");

    if (!$modal.length) return;
    if ($modal.data("drag-initialized")) return;

    $modal.draggable({
      handle: this,
      scroll: false,
      start: function (_event, ui) {
        normalizeModalPositionForDrag(this, ui);
      }
    });

    $modal.data("drag-initialized", true);
  });
}


function initializeResizableModals() {
  if (typeof $.fn.resizable !== "function") return;

  $("[data-resizable='true']").each(function () {
    const $modal = $(this);

    if (!$modal.length) return;
    if ($modal.data("resize-initialized")) return;

    $modal.resizable({
      handles: "n,e,s,w,se,sw,ne,nw",
      minWidth: 420,
      minHeight: 240,
      containment: "document",
      start: function (_event, ui) {
        normalizeModalPositionForDrag(this, ui);
      }
    });

    $modal.data("resize-initialized", true);
  });
}


function centerModal($modal) {
  if (!$modal.length) return;

  $modal.css({ display: 'flex', visibility: 'hidden' });

  const modalWidth = $modal.outerWidth();
  const modalHeight = $modal.outerHeight();

  if (!modalWidth || !modalHeight) return;

  const left = Math.max((window.innerWidth - modalWidth) / 2, 0);
  const top = Math.max((window.innerHeight - modalHeight) / 2, 0);

  $modal.css({
    transform: "none",
    left: `${left}px`,
    top: `${top}px`,
    visibility: 'visible',
  });
}


function openSettingsModal(shouldPersistState = true) {
  initializeDraggableModals();
  $("#settings-modal").css('display', 'flex');
  centerModal($("#settings-modal"));
  $('#modal-mask').css('display', 'flex');
  $("#past-positions-input").val(past_positions_limit);
  $("#display-entity-names").prop("checked", allNamesVisible);
  $("#display-alerts").prop("checked", allBadgesVisible);
  $("#display-drones").prop("checked", allDronesVisible);
  $("#display-targets").prop("checked", allTargetsVisible);
  $("#enable-history-tracking").prop("checked", showHistory);
  $("#enable-target-history-tracking").prop("checked", showTargetHistory);
  $("#past-positions-input").prop("disabled", !showHistory);
  $("#enable-global-size").prop("checked", globalSizeEnabled);
  $("#global-entity-size-input").val(globalEntitySize);
  $("#global-entity-size-input").prop("disabled", !globalSizeEnabled);
  $("#map-layer-select").val(currentMapLayerKey);
  $("#alert-display-size-input").val(alertDisplaySize);
  $("#name-display-size-input").val(nameDisplaySize);
  if (shouldPersistState) {
    saveModalSessionState('settings-modal');
  }
}

function closeSettingsModal() {
  $('#settings-modal').css('display', 'none');
  $('#modal-mask').css('display', 'none');
  clearModalSessionState();
}

var iconsOriginFilter = 'all';

function applyIconsFilter() {
  $('.icon-chip').each(function () {
    $(this).toggleClass('icon-chip-active', $(this).data('filter') === iconsOriginFilter);
  });
  $('#icons-grid .icon-tile').each(function () {
    const isVisible = iconsOriginFilter === 'all' || $(this).data('origin') === iconsOriginFilter;
    $(this).toggle(isVisible);
  });
}

// Custom files that failed validation get a tile in the grid (click to fix or delete); default ones are only listed here.
function renderRejectedIconsBanner() {
  const banner = $('#icons-rejected-banner').empty();
  banner.toggle(rejectedIcons.length > 0);
  if (!rejectedIcons.length) return;

  const defaultRejected = rejectedIcons.filter(icon => icon.origin !== 'custom');
  banner.append($('<div class="icon-rejected-title"></div>').text(rejectedIcons.length + (rejectedIcons.length === 1 ? ' icon not loaded' : ' icons not loaded')));
  if (rejectedIcons.length > defaultRejected.length) {
    banner.append($('<div></div>').text('Custom ones are shown below with a red border: click one to fix or delete it.'));
  }
  if (defaultRejected.length) {
    const list = $('<ul class="icon-rejected-list"></ul>');
    defaultRejected.forEach(icon => list.append($('<li></li>').text(icon.name + ' (default, part of the plugin): ' + icon.reason)));
    banner.append(list);
  }
}

var REJECTED_ICON_HTML = '<svg clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m2.095 19.886 9.248-16.5c.133-.237.384-.384.657-.384.272 0 .524.147.656.384l9.248 16.5c.064.115.096.241.096.367 0 .385-.309.749-.752.749h-18.496c-.44 0-.752-.36-.752-.749 0-.126.031-.252.095-.367zm1.935-.384h15.939l-7.97-14.219zm7.972-6.497c-.414 0-.75.336-.75.75v3.5c0 .414.336.75.75.75s.75-.336.75-.75v-3.5c0-.414-.336-.75-.75-.75zm-.002-3c.552 0 1 .448 1 1s-.448 1-1 1-1-.448-1-1 .448-1 1-1z" fill-rule="nonzero"/></svg>';

function buildRejectedIconTile(icon) {
  const badges = $('<div class="icon-tile-badges"></div>').append(
    $('<span class="icon-badge icon-badge-custom"></span>').text('Custom'),
    $('<span class="icon-badge icon-badge-broken"></span>').text('Not loaded')
  );
  return $('<div class="icon-tile icon-tile-broken"></div>')
    .attr({ 'data-origin': 'custom', 'data-name': icon.name, 'data-broken': 'true', title: icon.reason })
    .append($('<div class="icon-tile-image icon-colour icon-tile-broken-image"></div>').html(REJECTED_ICON_HTML), $('<div class="icon-tile-name"></div>').text(icon.name), badges);
}

function renderIconsGrid() {
  renderRejectedIconsBanner();
  const grid = $("#icons-grid").empty();
  rejectedIcons.filter(icon => icon.origin === 'custom').forEach(icon => grid.append(buildRejectedIconTile(icon)));
  (fileIconsCache || []).forEach(icon => {
    const isCustom = icon.origin === 'custom';
    const iconBindings = iconBindingsData.bindings.filter(binding => binding.icon === icon.class_name);
    const bindingTypes = [...new Set(iconBindings.map(binding => binding.type))];

    const preview = $('<div class="icon-tile-image icon-colour"></div>').html(icon.html);
    const name = $('<div class="icon-tile-name"></div>').text(icon.class_name);
    const badges = $('<div class="icon-tile-badges"></div>');
    badges.append($('<span class="icon-badge"></span>').text(isCustom ? 'Custom' : 'Default').toggleClass('icon-badge-custom', isCustom));
    (bindingTypes.length ? bindingTypes : ['generic']).forEach(bindingType => {
      badges.append($('<span class="icon-badge"></span>').text(bindingType.charAt(0).toUpperCase() + bindingType.slice(1)));
    });

    const tile = $('<div class="icon-tile"></div>').attr({ 'data-origin': isCustom ? 'custom' : 'default', 'data-name': icon.class_name }).append(preview, name, badges);
    if (iconBindings.length) tile.attr('title', iconBindings.map(binding => binding.type + ': ' + binding.value).join('\n'));
    grid.append(tile);
  });
  applyIconsFilter();
  updateIconResetButtons();
}

$(document).off('click.iconFilter').on('click.iconFilter', '.icon-chip', function () {
  iconsOriginFilter = $(this).data('filter');
  applyIconsFilter();
});

function openIconsModal(shouldPersistState = true) {
  initializeDraggableModals();
  $("#icons-modal").css('display', 'flex');
  showIconsView('library');
  renderIconsGrid();
  centerModal($("#icons-modal"));
  $('#modal-mask').css('display', 'flex');
  $("#past-positions-input").val(past_positions_limit);
  $("#display-entity-names").prop("checked", allNamesVisible);
  $("#display-alerts").prop("checked", allBadgesVisible);
  $("#display-drones").prop("checked", allDronesVisible);
  $("#display-targets").prop("checked", allTargetsVisible);
  $("#enable-history-tracking").prop("checked", showHistory);
  $("#enable-target-history-tracking").prop("checked", showTargetHistory);
  $("#past-positions-input").prop("disabled", !showHistory);
  $("#enable-global-size").prop("checked", globalSizeEnabled);
  $("#global-entity-size-input").val(globalEntitySize);
  $("#global-entity-size-input").prop("disabled", !globalSizeEnabled);
  $("#map-layer-select").val(currentMapLayerKey);
  $("#alert-display-size-input").val(alertDisplaySize);
  $("#name-display-size-input").val(nameDisplaySize);
  if (shouldPersistState) {
    saveModalSessionState('icons-modal');
  }
}

function closeIconsModal() {
  showIconsView('library');
  $('#icons-modal').css('display', 'none');
  $('#modal-mask').css('display', 'none');
  clearModalSessionState();
}

function showIconsView(view, mode = 'upload') {
  const titles = { library: 'Manage Icons', bulk: 'Upload multiple icons', upload: 'Upload new icon', edit: 'Edit icon' };
  $('#icons-modal').attr({ 'data-view': view, 'data-mode': mode });
  $('#icons-modal-title').text(titles[view === 'form' ? mode : view]);
  $('#icon-name-input').prop('readonly', view === 'form' && mode === 'edit');
  if (mode !== 'edit') $('#icons-modal').removeAttr('data-icon-origin');
  if (view === 'library') {
    clearIconForm();
    clearBulkList();
  }
}

var ICON_PREVIEW_EMPTY_HTML = '<div class="icon-preview-empty">The preview will appear after validation.</div>';
var ICON_RESULT_EMPTY_HTML = 'Not validated yet. Press <span class="bold">Validate</span> to check the SVG and the name and to see the preview.';
var ICON_RESULT_TEXTS = {
  ok: { symbol: '\u2714', title: 'Valid SVG.', summary: 'The icon follows the severity colour.', hint: '' },
  note: { symbol: '\u2714', title: 'Valid SVG, adjusted.', summary: 'The preview shows the adjusted version, which is the one that will be saved.', hint: '' },
  warning: { symbol: '\u26A0', title: 'Valid SVG, with warnings.', summary: '', hint: 'Edit the text and press Validate again, or use "Save anyway".' },
  error: { symbol: '\u2716', title: 'Validation failed.', summary: '', hint: 'Fix the text or the name and press Validate again.' }
};
var ICON_RESULT_CLASSES = { ok: 'icon-result-ok', note: 'icon-result-ok', warning: 'icon-result-warning', error: 'icon-result-error' };
var ICON_PREVIEW_SAMPLES = [{ label: 'Black', color: '#000' }, { label: 'Red', color: '#d32f2f' }];
var ICON_PREVIEW_SIZES = [96, 32, 24];

var validatedIcon = null;

function updateIconActionButton() {
  let label = 'Validate';
  if (validatedIcon) {
    if (validatedIcon.level === 'warning') label = 'Save anyway';
    else label = validatedIcon.exists === 'custom' ? 'Overwrite' : 'Save';
  }
  $('#validate-icon-button').text(label);
}

function resetIconValidation() {
  validatedIcon = null;
  updateIconActionButton();
  $('#icon-preview').html(ICON_PREVIEW_EMPTY_HTML);
  $('#icon-validation-result').attr('class', 'icon-result icon-result-neutral').html(ICON_RESULT_EMPTY_HTML);
}

function renderIconValidation(validation) {
  const resultBox = $('#icon-validation-result').attr('class', 'icon-result ' + ICON_RESULT_CLASSES[validation.level]).empty();
  const resultTexts = ICON_RESULT_TEXTS[validation.level];
  const nameIsAvailable = validation.level !== 'error' && !validation.exists;
  const headline = [resultTexts.summary, nameIsAvailable ? 'Name available.' : ''].filter(Boolean).join(' ');
  resultBox.append($('<strong></strong>').text(resultTexts.symbol + ' ' + resultTexts.title), document.createTextNode(headline ? ' ' + headline : ''));

  if (validation.messages.length) {
    const messageList = $('<ul class="icon-result-list"></ul>');
    validation.messages.forEach(message => messageList.append($('<li></li>').text(message)));
    resultBox.append(messageList);
  }
  if (resultTexts.hint) {
    resultBox.append($('<span class="icon-result-hint"></span>').text(resultTexts.hint));
  }

  const preview = $('#icon-preview').empty();
  if (!validation.svg) {
    preview.html(ICON_PREVIEW_EMPTY_HTML);
    return;
  }
  ICON_PREVIEW_SAMPLES.forEach(sample => {
    const sizes = $('<div class="icon-preview-sizes"></div>');
    ICON_PREVIEW_SIZES.forEach(size => {
      const sampleIcon = $('<div class="icon-colour icon-outlined icon-preview-sample"></div>')
        .attr('style', '--icon-size:' + size + 'px; color:' + sample.color + '; fill:' + sample.color + ';')
        .html(validation.svg);
      sizes.append(sampleIcon);
    });
    preview.append($('<div class="icon-preview-card"></div>').append(sizes, $('<div class="icon-preview-caption"></div>').text(sample.label)));
  });
}

async function validateIconForm() {
  try {
    const validation = await requestIconValidation($('#icon-name-input').val().trim(), $('#icon-svg-textarea').val());
    renderIconValidation(validation);
    validatedIcon = validation.level === 'error' ? null : validation;
    updateIconActionButton();
  } catch (error) {
    console.error('Icon validation failed', error);
    renderIconValidation({ level: 'error', messages: [describeIconRequestError(error, 'validate')], svg: null });
  }
}

var ICON_MAX_FILE_BYTES = 50 * 1024;

// Status 0 means no answer arrived; some network devices reset requests whose body contains <script> or similar.
function describeIconRequestError(requestError, action) {
  if (requestError && requestError.status === 0) {
    return 'The connection was interrupted before the server answered. A network device may be blocking the SVG ' +
      '(for example if it contains <script> or similar elements): remove them and try again.';
  }
  return 'The server could not ' + action + ' the icon.';
}

async function reloadIconCatalog() {
  fileIconsCache = null;
  dbIcons = await loadIcons();
  renderIconsGrid();
}

// Only needed when an icon already in use changes (overwrite or delete).
function refreshMarkersUsingIcons(iconNames) {
  mapEntities.filter(entity => iconNames.includes(entity.iconType)).forEach(refreshEntityIcon);
  refreshRelatedMarkersUsingIcons(iconNames);
}

// Rebuilds the drone/target markers after the associations change; the alerts signature is cleared so no entity is skipped.
function forceRelatedResync() {
  mapEntities.forEach(entity => { entity._lastAlertsSignature = ""; });
  refreshMacroData();
}

function openIconUploadForm() {
  showIconsView('form', 'upload');
}

function openIconBulkView() {
  showIconsView('bulk');
}

var ICON_BULK_MAX_FILES = 50;
var ICON_BULK_VALIDATION_DELAY_MS = 400;
var ICON_BULK_NOTE_DEFAULT = 'Category is only active for Source and Target.';
var ICON_BULK_NOTE_BLOCKED = 'Fix or remove the rows marked in red to enable Confirm.';
var ICON_BULK_NOTE_DONE = 'The library is reloaded once the upload is finished.';
var ICON_BULK_TYPES = [['generic', 'Generic'], ['target', 'Target'], ['source', 'Source']];
var bulkRows = [];
var bulkLimitNote = '';
var bulkIsSending = false;
var bulkUploadAttempted = false;

function deriveIconNameFromFile(fileName) {
  return fileName.replace(/\.svg$/i, '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
}

// Files that cannot be used get an error row that can only be removed.
async function createBulkRow(file) {
  const row = {
    name: deriveIconNameFromFile(file.name), type: GENERIC_TYPE, category: '', svgText: '', error: '',
    validation: null, validationId: 0, validationTimer: null, overwrite: false,
    saved: false, savedMessage: '', saveError: ''
  };
  if (file.size > ICON_MAX_FILE_BYTES) {
    row.error = 'The file is larger than ' + (ICON_MAX_FILE_BYTES / 1024) + ' KB.';
    return row;
  }
  try {
    row.svgText = await file.text();
  } catch (readError) {
    row.error = 'The file could not be read.';
  }
  return row;
}

// Checks between rows: the same name or the same Type + Category would make one row overwrite the other.
function getBulkRowConflicts(row) {
  const describeRows = otherRows => (otherRows.length === 1 ? 'row ' : 'rows ') + otherRows.map(otherRow => bulkRows.indexOf(otherRow) + 1).join(', ');
  const otherRows = bulkRows.filter(otherRow => otherRow !== row && !otherRow.error);
  const conflicts = [];

  const normalizedName = row.name.trim().toLowerCase();
  const rowsWithSameName = normalizedName ? otherRows.filter(otherRow => otherRow.name.trim().toLowerCase() === normalizedName) : [];
  if (rowsWithSameName.length) conflicts.push('Same name as ' + describeRows(rowsWithSameName) + '. Rename one of them.');

  if (row.type !== GENERIC_TYPE && row.category) {
    const rowsWithSameCategory = otherRows.filter(otherRow => otherRow.type === row.type && otherRow.category === row.category);
    if (rowsWithSameCategory.length) conflicts.push('Same Type and Category as ' + describeRows(rowsWithSameCategory) + '.');
  }
  return conflicts;
}

// Icon that currently owns the category chosen by the row, if it is not the row's own icon.
function getReplacedAssociationIcon(row) {
  if (row.type === GENERIC_TYPE || !row.category) return '';
  const boundIcon = iconBindingIndex[row.type + '|' + row.category.toLowerCase()];
  return boundIcon && boundIcon !== row.name.trim() ? boundIcon : '';
}

// Level is the most severe message; a null server verdict means the row is waiting for the answer.
function getBulkRowStatus(row) {
  if (row.saved) return { level: 'saved', messages: [{ kind: 'ok', text: '\u2714 ' + row.savedMessage }] };
  if (row.error) return { level: 'error', messages: [{ kind: 'error', text: '\u2716 ' + row.error }] };
  if (!row.validation) return { level: 'pending', messages: [{ kind: 'note', text: 'Validating\u2026' }] };

  const verdict = row.validation;
  const verdictText = verdict.messages.join(' ');
  const messages = [];
  if (row.saveError) messages.push({ kind: 'error', text: '\u2716 Failed: ' + row.saveError + ' You can retry.' });
  if (verdict.level === 'error') messages.push({ kind: 'error', text: '\u2716 ' + verdictText });
  const conflicts = getBulkRowConflicts(row);
  conflicts.forEach(conflict => messages.push({ kind: 'error', text: '\u2716 ' + conflict }));

  if (verdict.level !== 'error') {
    if (verdict.level === 'warning' || verdict.exists) {
      messages.push({ kind: 'warning', text: '\u26A0 ' + verdictText, canOverwrite: Boolean(verdict.exists) });
    } else if (verdict.level === 'note') {
      messages.push({ kind: 'note', text: verdictText });
    }
    const replacedIcon = getReplacedAssociationIcon(row);
    if (replacedIcon) {
      messages.push({ kind: 'warning', text: '\u26A0 This category is already associated with ' + replacedIcon + ': saving replaces that association.' });
    }
  }

  let level = 'ok';
  if (verdict.level === 'error' || conflicts.length) level = 'error';
  else if (row.saveError) level = 'failed';
  else if (messages.some(message => message.kind === 'warning')) level = 'warning';
  return { level, messages };
}

function renderBulkRowStatus(rowElement, row) {
  const status = getBulkRowStatus(row);
  rowElement
    .toggleClass('icon-bulk-row-error', status.level === 'error' || status.level === 'failed')
    .toggleClass('icon-bulk-row-warning', status.level === 'warning')
    .toggleClass('icon-bulk-row-done', status.level === 'saved');
  rowElement.find('.icon-bulk-message').remove();

  status.messages.forEach(item => {
    const message = $('<div class="icon-bulk-message"></div>').addClass('icon-bulk-message-' + item.kind).text(item.text);
    if (item.canOverwrite) {
      const overwriteBox = $('<input type="checkbox" class="icon-bulk-overwrite-input">').prop('checked', row.overwrite);
      message.append($('<label class="icon-bulk-overwrite"></label>').append(overwriteBox, document.createTextNode('Overwrite')));
    }
    rowElement.append(message);
  });
}

// Rows whose name already exists are skipped unless Overwrite is ticked.
function isBulkRowSkipped(row) {
  return Boolean(!row.saved && row.validation && row.validation.exists && !row.overwrite);
}

function isBulkRowSendable(row) {
  return ['ok', 'warning', 'failed'].includes(getBulkRowStatus(row).level) && !isBulkRowSkipped(row);
}

// Any change can create or remove a conflict in other rows, so all the statuses are recomputed.
function refreshBulkStatuses() {
  bulkRows.forEach((row, index) => renderBulkRowStatus($('#icon-bulk-list .icon-bulk-row[data-index="' + index + '"]'), row));
  updateBulkSummary();
}

// Answers that arrive after the row was edited or removed are ignored.
async function validateBulkRow(row) {
  if (row.error || !bulkRows.includes(row)) return;
  const validationId = ++row.validationId;
  row.validation = null;
  refreshBulkStatuses();
  let validation;
  try {
    validation = await requestIconValidation(row.name.trim(), row.svgText);
  } catch (requestError) {
    console.error('Bulk icon validation failed', requestError);
    validation = { level: 'error', messages: [describeIconRequestError(requestError, 'validate')], svg: null, exists: null };
  }
  if (validationId !== row.validationId) return;
  row.validation = validation;
  if (!validation.exists) row.overwrite = false;
  refreshBulkStatuses();
}

async function addBulkFiles(files) {
  const freeSlots = Math.max(ICON_BULK_MAX_FILES - bulkRows.length, 0);
  const acceptedFiles = files.slice(0, freeSlots);
  const newRows = [];
  for (const file of acceptedFiles) newRows.push(await createBulkRow(file));
  bulkRows.push(...newRows);
  const skippedCount = files.length - acceptedFiles.length;
  bulkLimitNote = skippedCount ? 'Only ' + ICON_BULK_MAX_FILES + ' files are allowed: ' + skippedCount + ' file(s) were left out.' : '';
  renderBulkList();
  for (const row of newRows) await validateBulkRow(row);
}

function fillBulkCategorySelect(rowElement, row) {
  const categories = iconBindingsData.vocabularies[row.type] || [];
  const categorySelect = rowElement.find('.icon-bulk-category').empty();
  if (!categories.length) {
    categorySelect.append($('<option></option>').html('&mdash;')).prop('disabled', true);
    return;
  }
  categories.forEach(category => categorySelect.append($('<option></option>').val(category).text(category)));
  categorySelect.val(row.category).prop('disabled', Boolean(row.error || row.saved));
}

function buildBulkRow(row, index) {
  const isLocked = Boolean(row.error || row.saved);
  const rowElement = $('<div class="icon-bulk-row"></div>').attr('data-index', index);
  const typeSelect = $('<select class="modal-input icon-bulk-type"></select>').prop('disabled', isLocked);
  ICON_BULK_TYPES.forEach(([value, label]) => typeSelect.append($('<option></option>').val(value).text(label)));
  typeSelect.val(row.type);

  rowElement.append($('<div class="icon-bulk-row-main"></div>').append(
    $('<span class="icon-bulk-number"></span>').text(index + 1),
    $('<input type="text" class="modal-input icon-bulk-name" maxlength="40" autocomplete="off">').val(row.name).prop('disabled', isLocked),
    typeSelect,
    $('<select class="modal-input icon-bulk-category"></select>'),
    $('<button type="button" class="btn btn-danger icon-bulk-remove" title="Remove row">X</button>').prop('disabled', row.saved)
  ));
  fillBulkCategorySelect(rowElement, row);
  renderBulkRowStatus(rowElement, row);
  return rowElement;
}

// Summary chips, footer note and buttons all follow the row statuses.
function updateBulkSummary() {
  const summary = $('#icon-bulk-summary').empty();
  const confirmButton = $('#confirm-icon-bulk-button');
  $('#select-bulk-files-button, #cancel-icon-bulk-button').prop('disabled', bulkIsSending);
  $('#cancel-icon-bulk-button').text(bulkUploadAttempted ? 'Close' : 'Cancel');
  if (!bulkRows.length) {
    summary.text('No files selected');
    confirmButton.prop('disabled', true).text('Confirm upload');
    $('#icon-bulk-note').text(bulkLimitNote || ICON_BULK_NOTE_DEFAULT);
    return;
  }

  const levelCounts = { saved: 0, ok: 0, warning: 0, failed: 0, error: 0, pending: 0 };
  bulkRows.forEach(row => { levelCounts[getBulkRowStatus(row).level] += 1; });
  summary.append(document.createTextNode(bulkRows.length + (bulkRows.length === 1 ? ' file ' : ' files ')));
  [['saved', 'saved', 'icon-chip-ok'], ['ok', 'ready', 'icon-chip-ok'], ['warning', 'warning', 'icon-chip-warning'],
    ['failed', 'failed', 'icon-chip-error'], ['error', 'to fix', 'icon-chip-error']].forEach(([level, label, chipClass]) => {
    if (levelCounts[level]) summary.append($('<span class="icon-chip"></span>').addClass(chipClass).text(levelCounts[level] + ' ' + label), ' ');
  });
  if (levelCounts.pending) summary.append(document.createTextNode('validating\u2026'));

  const skippedCount = bulkRows.filter(isBulkRowSkipped).length;
  const sendCount = bulkRows.filter(isBulkRowSendable).length;
  const isBlocked = bulkIsSending || levelCounts.error > 0 || levelCounts.pending > 0 || sendCount === 0;
  let confirmLabel = 'Confirm upload';
  if (!isBlocked) confirmLabel = (levelCounts.failed ? 'Retry failed (' : 'Confirm upload (') + sendCount + ')';
  confirmButton.prop('disabled', isBlocked).text(confirmLabel);

  let noteText = bulkLimitNote || ICON_BULK_NOTE_DEFAULT;
  if (levelCounts.error > 0) noteText = ICON_BULK_NOTE_BLOCKED;
  else if (skippedCount > 0) noteText = skippedCount + ' row(s) with an existing name will be skipped unless Overwrite is ticked.';
  else if (bulkUploadAttempted) noteText = ICON_BULK_NOTE_DONE;
  $('#icon-bulk-note').text(noteText);
}

function renderBulkList() {
  const body = $('#icon-bulk-body');
  const scrollPosition = body.scrollTop();
  const list = $('#icon-bulk-list').empty();
  bulkRows.forEach((row, index) => list.append(buildBulkRow(row, index)));
  body.attr('data-empty', bulkRows.length ? 'false' : 'true').scrollTop(scrollPosition);
  updateBulkSummary();
}

function clearBulkList() {
  bulkRows.forEach(row => clearTimeout(row.validationTimer));
  bulkRows = [];
  bulkLimitNote = '';
  bulkUploadAttempted = false;
  renderBulkList();
}

function getBulkRowIndex(element) {
  return Number($(element).closest('.icon-bulk-row').attr('data-index'));
}

// Any edit makes a previous failure obsolete.
function resetBulkRowFailure(row) {
  row.saveError = '';
}

function describeSavedBulkRow(row, hadBindings, replacedIcon) {
  if (row.type !== GENERIC_TYPE) {
    return 'Saved and associated with ' + row.category + '.' + (replacedIcon ? ' The association of ' + replacedIcon + ' was replaced.' : '');
  }
  return hadBindings ? 'Saved. Its previous associations were removed.' : 'Saved.';
}

// Rows are sent one at a time; a failed row stays in the list so it can be corrected and retried.
async function confirmBulkUpload() {
  const rowsToSend = bulkRows.filter(isBulkRowSendable);
  if (bulkIsSending || !rowsToSend.length) return;
  bulkIsSending = true;
  bulkUploadAttempted = true;
  $('#icon-bulk-body').attr('data-sending', 'true');

  let bindingsChanged = false;
  const overwrittenNames = [];
  let savedCount = 0;
  try {
    for (const [position, row] of rowsToSend.entries()) {
      if (!bulkRows.includes(row)) break;
      $('#confirm-icon-bulk-button').text('Uploading ' + (position + 1) + '/' + rowsToSend.length + '\u2026');
      const iconName = row.name.trim();
      const hadBindings = iconBindingsData.bindings.some(binding => binding.icon === iconName);
      const replacedIcon = getReplacedAssociationIcon(row);
      try {
        const response = await requestIconSave(iconName, row.svgText, row.overwrite, row.type, row.type === GENERIC_TYPE ? '' : row.category);
        if (response.status === 'success') {
          row.saved = true;
          row.saveError = '';
          row.savedMessage = describeSavedBulkRow(row, hadBindings, replacedIcon);
          savedCount += 1;
          if (row.validation.exists) overwrittenNames.push(iconName);
          if (row.type !== GENERIC_TYPE || hadBindings) bindingsChanged = true;
        } else {
          row.saveError = response.message || 'The server could not save the icon.';
        }
      } catch (requestError) {
        console.error('Bulk icon save failed', requestError);
        row.saveError = describeIconRequestError(requestError, 'save');
      }
      renderBulkList();
    }

    if (savedCount) {
      if (bindingsChanged) await loadIconBindings();
      await reloadIconCatalog();
      if (overwrittenNames.length) refreshMarkersUsingIcons(overwrittenNames);
      if (bindingsChanged) forceRelatedResync();
    }
  } finally {
    bulkIsSending = false;
    $('#icon-bulk-body').removeAttr('data-sending');
    renderBulkList();
  }
}

$(document).off('.iconBulk')
  .on('click.iconBulk', '#select-bulk-files-button', () => $('#icon-bulk-file-input').trigger('click'))
  .on('click.iconBulk', '#confirm-icon-bulk-button', confirmBulkUpload)
  .on('change.iconBulk', '#icon-bulk-file-input', async function () {
    const selectedFiles = Array.from(this.files);
    this.value = '';
    if (selectedFiles.length) await addBulkFiles(selectedFiles);
  })
  .on('input.iconBulk', '.icon-bulk-name', function () {
    const row = bulkRows[getBulkRowIndex(this)];
    row.name = $(this).val();
    resetBulkRowFailure(row);
    clearTimeout(row.validationTimer);
    row.validationId += 1;
    row.validation = null;
    refreshBulkStatuses();
    row.validationTimer = setTimeout(() => validateBulkRow(row), ICON_BULK_VALIDATION_DELAY_MS);
  })
  .on('change.iconBulk', '.icon-bulk-type', function () {
    const row = bulkRows[getBulkRowIndex(this)];
    row.type = $(this).val();
    row.category = (iconBindingsData.vocabularies[row.type] || [])[0] || '';
    resetBulkRowFailure(row);
    fillBulkCategorySelect($(this).closest('.icon-bulk-row'), row);
    refreshBulkStatuses();
  })
  .on('change.iconBulk', '.icon-bulk-category', function () {
    const row = bulkRows[getBulkRowIndex(this)];
    row.category = $(this).val();
    resetBulkRowFailure(row);
    refreshBulkStatuses();
  })
  .on('change.iconBulk', '.icon-bulk-overwrite-input', function () {
    bulkRows[getBulkRowIndex(this)].overwrite = $(this).prop('checked');
    refreshBulkStatuses();
  })
  .on('click.iconBulk', '.icon-bulk-remove', function () {
    const [removedRow] = bulkRows.splice(getBulkRowIndex(this), 1);
    clearTimeout(removedRow.validationTimer);
    renderBulkList();
  });

function openIconEditForm(icon, rejectionReason = '') {
  clearIconForm();
  $('#icon-name-input').val(icon.class_name);
  $('#icon-svg-textarea').val(icon.html);
  const iconBinding = iconBindingsData.bindings.find(binding => binding.icon === icon.class_name);
  $('#icon-type-select').val(iconBinding ? iconBinding.type : GENERIC_TYPE);
  updateIconClassField(iconBinding ? iconBinding.value : '');
  showIconsView('form', 'edit');
  $('#icons-modal').attr('data-icon-origin', icon.origin);
  $('#icons-modal-title').text('Edit icon: ' + icon.class_name);
  if (rejectionReason) renderIconValidation({ level: 'error', messages: ['This file is not loaded: ' + rejectionReason], svg: null });
}

async function loadIconFile(file) {
  if (file.size > ICON_MAX_FILE_BYTES) {
    renderIconValidation({ level: 'error', messages: ['The file is larger than ' + (ICON_MAX_FILE_BYTES / 1024) + ' KB.'], svg: null });
    return;
  }
  const svgText = await file.text();
  resetIconValidation();
  $('#icon-svg-textarea').val(svgText);
  $('#icon-file-name').text(file.name);
  if (!$('#icon-name-input').val().trim()) {
    $('#icon-name-input').val(file.name.replace(/\.svg$/i, '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40));
  }
}

function getCustomIconCounts() {
  const customIcons = (fileIconsCache || []).filter(icon => icon.origin === 'custom');
  const overrideCount = customIcons.filter(icon => icon.overridesDefault).length;
  return { total: customIcons.length, overrides: overrideCount, fresh: customIcons.length - overrideCount };
}

function updateIconResetButtons() {
  const counts = getCustomIconCounts();
  $('#restore-default-icons-button').toggle(counts.overrides > 0);
  $('#delete-custom-icons-button').toggle(counts.total > 0);
}

// After icons are removed their associations change too: reload both and rebuild the markers that depended on them.
async function reloadAfterIconRemoval(removedNames) {
  const previousBindings = JSON.stringify(iconBindingsData.bindings);
  await loadIconBindings();
  await reloadIconCatalog();
  refreshMarkersUsingIcons(removedNames);
  if (JSON.stringify(iconBindingsData.bindings) !== previousBindings) forceRelatedResync();
}

async function resetIcons(scope) {
  const counts = getCustomIconCounts();
  const confirmMessage = scope === 'overrides'
    ? 'Restore ' + counts.overrides + ' default icon(s) to their original version? The custom versions will be deleted and their associations will go back to the default ones.'
    : 'Delete all ' + counts.total + ' custom icon(s)? ' + counts.overrides + ' will go back to the default version and ' + counts.fresh + ' new icon(s) will be lost permanently. All custom associations will be deleted.';
  if (!confirm(confirmMessage)) return;

  try {
    const response = await requestIconsReset(scope);
    if (response.status !== 'success') {
      alert(response.message);
    }
    await reloadAfterIconRemoval(response.removed || []);
  } catch (error) {
    console.error('Icon reset failed', error);
    alert('The server could not reset the icons.');
  }
}

$(document).off('.iconReset')
  .on('click.iconReset', '#restore-default-icons-button', () => resetIcons('overrides'))
  .on('click.iconReset', '#delete-custom-icons-button', () => resetIcons('all'));

async function deleteIconForm() {
  const iconName = $('#icon-name-input').val().trim();
  if (!confirm('Delete the custom icon "' + iconName + '"? Its associations will be removed. If a default icon has the same name, it will be used again with its default associations.')) return;

  try {
    const response = await requestIconDelete(iconName);
    if (response.status !== 'success') {
      renderIconValidation({ level: 'error', messages: [response.message], svg: null });
      return;
    }
    await reloadAfterIconRemoval([iconName]);
    showIconsView('library');
  } catch (error) {
    console.error('Icon delete failed', error);
    renderIconValidation({ level: 'error', messages: ['The server could not delete the icon.'], svg: null });
  }
}

$(document).off('.iconActions')
  .on('click.iconActions', '#select-icon-file-button', () => $('#icon-file-input').trigger('click'))
  .on('change.iconActions', '#icon-file-input', async function () {
    const selectedFile = this.files[0];
    this.value = '';
    if (selectedFile) await loadIconFile(selectedFile);
  })
  .on('click.iconActions', '#delete-icon-button', deleteIconForm)
  .on('change.iconActions', '#icon-type-select', () => updateIconClassField())
  .on('change.iconActions', '#icon-class-select', updateAssociationWarning)
  .on('click.iconActions', '.icon-tile', function () {
    const clickedName = $(this).attr('data-name');
    if ($(this).attr('data-broken')) {
      const brokenIcon = rejectedIcons.find(icon => icon.origin === 'custom' && icon.name === clickedName);
      if (brokenIcon) openIconEditForm({ class_name: brokenIcon.name, html: brokenIcon.svg, origin: 'custom' }, brokenIcon.reason);
      return;
    }
    const clickedIcon = (fileIconsCache || []).find(icon => icon.class_name === clickedName);
    if (clickedIcon) openIconEditForm(clickedIcon);
  });

var GENERIC_TYPE = 'generic';

// The Generic type has no category: saving with it removes the icon's associations.
function updateIconClassField(selectedValue = '') {
  const iconType = $('#icon-type-select').val();
  const classSelect = $('#icon-class-select').empty();
  (iconBindingsData.vocabularies[iconType] || []).forEach(category => classSelect.append($('<option></option>').val(category).text(category)));
  if (selectedValue) classSelect.val(selectedValue);
  $('#icon-class-field').toggle(iconType !== GENERIC_TYPE);
  updateAssociationWarning();
}

// Non-blocking notice: a category has a single icon, so saving replaces the one it has now.
function updateAssociationWarning() {
  const replacedIcon = getReplacedAssociationIcon({ name: $('#icon-name-input').val(), type: $('#icon-type-select').val(), category: $('#icon-class-select').val() || '' });
  $('#icon-association-warning')
    .text(replacedIcon ? '\u26A0 This category is already associated with ' + replacedIcon + ': saving replaces that association.' : '')
    .toggle(Boolean(replacedIcon));
}

function clearIconForm() {
  $('#icon-name-input, #icon-svg-textarea').val('');
  $('#icon-file-name').text('');
  $('#icon-type-select').val(GENERIC_TYPE);
  updateIconClassField();
  resetIconValidation();
}

async function saveIconForm() {
  try {
    const iconName = $('#icon-name-input').val().trim();
    const bindingType = $('#icon-type-select').val();
    const bindingValue = bindingType === GENERIC_TYPE ? '' : $('#icon-class-select').val();
    const hadBindings = iconBindingsData.bindings.some(binding => binding.icon === iconName);
    const response = await requestIconSave(iconName, $('#icon-svg-textarea').val(), validatedIcon.exists === 'custom', bindingType, bindingValue);
    if (response.status !== 'success') {
      validatedIcon = null;
      updateIconActionButton();
      renderIconValidation({ level: 'error', messages: [response.message], svg: null });
      return;
    }
    const bindingsChanged = bindingType !== GENERIC_TYPE || hadBindings;
    if (bindingsChanged) await loadIconBindings();
    await reloadIconCatalog();
    if (validatedIcon.exists) refreshMarkersUsingIcons([iconName]);
    if (bindingsChanged) forceRelatedResync();
    showIconsView('library');
  } catch (error) {
    console.error('Icon save failed', error);
    renderIconValidation({ level: 'error', messages: [describeIconRequestError(error, 'save')], svg: null });
  }
}

$(document).off('.iconForm')
  .on('click.iconForm', '#validate-icon-button', () => (validatedIcon ? saveIconForm() : validateIconForm()))
  .on('input.iconForm', '#icon-name-input, #icon-svg-textarea', () => {
    resetIconValidation();
    updateAssociationWarning();
  });

async function applyGlobalSettings() {
  const newLimit = parseInt($("#past-positions-input").val(), 10);
  const newNamesVisible = $("#display-entity-names").is(":checked");
  const newAlertsVisible = $("#display-alerts").is(":checked");
  const newDronesVisible = $("#display-drones").is(":checked");
  const newTargetsVisible = $("#display-targets").is(":checked");
  const newShowHistory = $("#enable-history-tracking").is(":checked");
  const newShowTargetHistory = $("#enable-target-history-tracking").is(":checked");
  const newSizeEnabled = $("#enable-global-size").is(":checked");
  const newSizeValue = parseInt($("#global-entity-size-input").val(), 10);
  const selectedMapLayerKey = normalizeMapLayerKey($("#map-layer-select").val());
  const newAlertDisplaySize = parseInt($("#alert-display-size-input").val(), 10);
  const newNameDisplaySize = parseInt($("#name-display-size-input").val(), 10);

  const limitChanged = newLimit !== past_positions_limit;
  const visibilityChanged = (newNamesVisible !== allNamesVisible) ||
    (newAlertsVisible !== allBadgesVisible) ||
    (newDronesVisible !== allDronesVisible) ||
    (newTargetsVisible !== allTargetsVisible) ||
    (newShowHistory !== showHistory) ||
    (newShowTargetHistory !== showTargetHistory);
  const sizeChanged = (newSizeEnabled !== globalSizeEnabled) ||
    (newSizeEnabled && newSizeValue !== globalEntitySize);
  const mapLayerChanged = selectedMapLayerKey !== currentMapLayerKey;
  const displaySizeChanged = (newAlertDisplaySize !== alertDisplaySize) ||
    (newNameDisplaySize !== nameDisplaySize);

  if (!limitChanged && !visibilityChanged && !sizeChanged && !mapLayerChanged && !displaySizeChanged) {
    return;
  }

  past_positions_limit = newLimit;
  allNamesVisible = newNamesVisible;
  allBadgesVisible = newAlertsVisible;
  allDronesVisible = newDronesVisible;
  allTargetsVisible = newTargetsVisible;
  showHistory = newShowHistory;
  showTargetHistory = newShowTargetHistory;
  globalSizeEnabled = newSizeEnabled;
  globalEntitySize = newSizeValue;

  if (mapLayerChanged) {
    setMapLayer(selectedMapLayerKey);
  }

  if (displaySizeChanged) {
    alertDisplaySize = newAlertDisplaySize;
    nameDisplaySize = newNameDisplaySize;
  }

  if (limitChanged) {
    const dates = await getMacroDates();
    if (dates) {
      try {
        const response = await fetchAllAlertsBulk(dates);
        if (response && response.status === "success") {
          mapEntities.forEach(entity => {
            const entityAlerts = getEntityAlertsFromBulkData(response.data, entity);
            updateEntityDataAndGraphics(entity, entityAlerts, true);
          });
        }
      } catch (e) {
        console.error("Bulk fetch failed", e);
      }

      try {
        const independentTargetsResponse = await fetchIndependentTargetsBulk(dates);
        if (independentTargetsResponse && independentTargetsResponse.status === "success") {
          syncIndependentTargets(independentTargetsResponse.data || []);
        }
      } catch (e) {
        console.error("Independent targets fetch failed", e);
      }
    }
  } else if (sizeChanged || visibilityChanged || displaySizeChanged) {
    mapEntities.forEach(e => {
      if (globalSizeEnabled) e.marker_size = globalEntitySize;

      updateEntityDataAndGraphics(e, null, true);
    });
  }

  updateBadgesVisibility();
  updateRelatedIconsVisibility();

  saveCurrentMapState();
}

// Temporary addition for development only


function openResourcesModal(shouldPersistState = true) {
  initializeDraggableModals();
  initializeResizableModals();
  $("#resources-modal").css('display', 'flex');
  centerModal($("#resources-modal"));
  $('#modal-mask').css('display', 'flex');
  if (shouldPersistState) {
    saveModalSessionState('resources-modal');
  }
}


function closeResourcesModal() {
  $('#resources-modal').css('display', 'none');
  $('#modal-mask').css('display', 'none');
  clearModalSessionState();
}

// Emergency services request - proof of concept, static only


function openEmergencyModal(serviceLabel) {
  initializeDraggableModals();

  $("#emergency-modal-title").text("Call " + serviceLabel);
  $("#emergency-date").val(moment().format("MMMM D, YYYY"));
  $("#emergency-cause").val("intrusion");
  $("#emergency-message").val("");

  $("#emergency-form-fields").show();
  $("#emergency-confirmation").hide();

  $("#emergency-modal").css('display', 'flex');
  centerModal($("#emergency-modal"));
  $('#modal-mask').css('display', 'flex');
}


function closeEmergencyModal() {
  $('#emergency-modal').css('display', 'none');
  $('#modal-mask').css('display', 'none');
}

// ------------


function resetMap() {
  if (!confirm("Are you sure you want to permanently delete all markers and rules? This action cannot be undone.")) {
    return;
  }

  $.ajax({
    url: "/macro_map/reset_state",
    method: "POST",
    dataType: "json"
  }).done(function (res) {
    if (res.status === "success") {
      clearAllMarkersFromMap(map);
      mapEntities = [];
      removeAllIndependentTargets();

      // Immediate cleanup of lines
      drawInfrastructureLinks();

      // Save an empty but correctly structured state
      const emptyState = {
        map_config: {
          center: [47, 10],
          zoom: 5
        },
        assets: []
      };

      $.ajax({
        url: "/macro_map/save_state",
        method: "POST",
        data: {
          state_data: JSON.stringify(emptyState)
        }
      });

      closeSettingsModal();
    } else {
      alert("Error resetting map: " + res.message);
    }
  });
}


function drawInfrastructureLinks() {
  if (!window.infrastructureLayerGroup) {
    window.infrastructureLayerGroup = L.layerGroup().addTo(map);
  }
  window.infrastructureLayerGroup.clearLayers();

  mapEntities.forEach(sourceEntity => {
    // Clean the links_to string (remove leading/trailing spaces and leftover quotes)
    let rawLinks = String(sourceEntity.links_to || "").replace(/['"\[\]]+/g, '').trim();
    if (!rawLinks) return;

    const targets = rawLinks.split(',').map(name => name.trim()).filter(name => name !== "");

    targets.forEach(targetName => {
      const targetEntity = mapEntities.find(e => e.entity_name === targetName);

      if (targetEntity) {
        const line = L.polyline([
          [sourceEntity.lat, sourceEntity.lng],
          [targetEntity.lat, targetEntity.lng]
        ], {
          color: '#34495e',
          weight: 5,
          opacity: 0.7,
          interactive: false,
          pane: 'shadowPane'
        });
        line.addTo(window.infrastructureLayerGroup);
      } else {
        console.warn(`Target link "${targetName}" not found for ${sourceEntity.entity_name}`);
      }
    });
  });
}


function restoreDefaultMapPosition() {
  defaultView = { ...SYSTEM_DEFAULT };
  map.setView(defaultView.center, defaultView.zoom);
  saveCurrentMapState();
  closeSettingsModal();
}


function createMapLayer(layerKey) {
  const normalizedKey = normalizeMapLayerKey(layerKey);
  const layerConfig = MAP_LAYER_CONFIGS[normalizedKey];

  return L.tileLayer(layerConfig.url, {
    ...layerConfig.options,
    bounds: bounds,
  });
}


function setMapLayer(layerKey) {
  const normalizedKey = normalizeMapLayerKey(layerKey);
  if (normalizedKey === currentMapLayerKey && mapLayer) {
    return false;
  }

  const nextLayer = createMapLayer(normalizedKey);

  if (mapLayer && map.hasLayer(mapLayer)) {
    map.removeLayer(mapLayer);
  }

  mapLayer = nextLayer.addTo(map);
  currentMapLayerKey = normalizedKey;
  return true;
}


function getMacroAlertsHtmlForTooltip(entity) {
  const colors = {
    high: "#FE0000",
    medium: "#f0ad4e",
    low: "#5cb85c",
    info: "#5bc0de"
  };

  return `
    <div style="margin-top: 10px; border-top: 1px solid #ccc; padding-top: 8px; display: flex; gap: 4px; justify-content: center;">
        <div style="background:${colors.high}; color:white; padding:2px 6px; border-radius:3px; font-weight:bold;" title="High">${entity.a_high || 0}</div>
        <div style="background:${colors.medium}; color:white; padding:2px 6px; border-radius:3px; font-weight:bold;" title="Medium">${entity.a_medium || 0}</div>
        <div style="background:${colors.low}; color:white; padding:2px 6px; border-radius:3px; font-weight:bold;" title="Low">${entity.a_low || 0}</div>
        <div style="background:${colors.info}; color:white; padding:2px 6px; border-radius:3px; font-weight:bold;" title="Info">${entity.a_info || 0}</div>
    </div>`;
}


function saveModalSessionState(modalId, entityId = null) {
  const modalData = collectModalFormState(modalId);
  const state = {
    openModal: modalId,
    selectedEntityId: entityId,
    modalData: modalData
  };
  localStorage.setItem('map_modal_state', JSON.stringify(state));
}


function clearModalSessionState() {
  localStorage.removeItem('map_modal_state');
}


function collectModalFormState(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return {};

  const state = {};
  const controls = modal.querySelectorAll("input, select, textarea");

  controls.forEach(control => {
    const key = control.id || control.name;
    if (!key) return;

    const type = (control.type || "").toLowerCase();
    if (type === "button" || type === "submit" || type === "reset" || type === "file") {
      return;
    }

    if (type === "checkbox" || type === "radio") {
      state[key] = !!control.checked;
      return;
    }

    state[key] = control.value;
  });

  return state;
}


function applyModalFormState(modalId, savedState) {
  if (!savedState || typeof savedState !== "object") return;

  Object.entries(savedState).forEach(([key, value]) => {
    const byId = document.getElementById(key);
    const controls = byId ? [byId] : Array.from(document.querySelectorAll(`[name="${key}"]`));
    if (!controls.length) return;

    controls.forEach(control => {
      const type = (control.type || "").toLowerCase();

      if (type === "checkbox" || type === "radio") {
        control.checked = !!value;
      } else {
        control.value = value;
      }
    });
  });

  // Keep dependent controls coherent after restore.
  $("#past-positions-input").prop("disabled", !$("#enable-history-tracking").is(":checked"));
  $("#global-entity-size-input").prop("disabled", !$("#enable-global-size").is(":checked"));
}


function bindModalSessionAutoSave() {
  $(document).on("change", ".crud-modal input[type='checkbox'], .crud-modal input[type='radio'], .crud-modal select", function () {
    if (isRestoringModalState) return;

    const modalId = $(this).closest(".crud-modal").attr("id");
    if (!modalId) return;

    const persistedEntityId = modalId === "rules-modal" ? (window.selectedEntityId ?? null) : null;
    saveModalSessionState(modalId, persistedEntityId);
  });

  $(document).on("blur", ".crud-modal input:not([type='checkbox']):not([type='radio']):not([type='file']), .crud-modal textarea", function () {
    if (isRestoringModalState) return;

    const modalId = $(this).closest(".crud-modal").attr("id");
    if (!modalId) return;

    const persistedEntityId = modalId === "rules-modal" ? (window.selectedEntityId ?? null) : null;
    saveModalSessionState(modalId, persistedEntityId);
  });
}


async function restoreModalState() {
  const saved = localStorage.getItem('map_modal_state');
  if (!saved) return;

  try {
    const state = JSON.parse(saved);
    const mId = state.openModal;
    isRestoringModalState = true;

    if (mId === 'settings-modal') {
      openSettingsModal(false);
      applyModalFormState('settings-modal', state.modalData);
    } 
    else if (mId === 'resources-modal') {
      openResourcesModal(false);
      applyModalFormState('resources-modal', state.modalData);
    } 
    else if (mId === 'upload-modal') {
      openUploadModal(false);
      applyModalFormState('upload-modal', state.modalData);
    } 
    else if (mId === 'rules-modal' && state.selectedEntityId) {
      const entity = mapEntities.find(e => e.id === state.selectedEntityId);
      if (entity) {
        openRulesModal(entity, false);
        applyModalFormState('rules-modal', state.modalData);
      }
    }
  } catch (e) {
    console.error("Error while restoring modal session state", e);
    clearModalSessionState();
  } finally {
    isRestoringModalState = false;
  }
}


