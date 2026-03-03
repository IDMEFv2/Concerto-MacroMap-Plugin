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
const FLAG_PATH = "macro_map/assets/Flags/";
const FLAG_STYLE = {
  border: "0.5px solid #333",
  background: "white",
  boxShadow: "1px 1px 3px rgba(0,0,0,0.3)"
};
const DEFAULT_ICON_RULES = [
  {
    ruleType: "percentage",
    metric: "high",
    operator: ">=",
    value: 70,
    color: "#FE0000"
  },
  {
    ruleType: "percentage",
    metric: "medium",
    operator: ">=",
    value: 50,
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
const RELATED_ICON_DEFAULTS = {
  drone: {
    iconType: "Drone",
    color: "#000000",
    historyColor: "#888888",
    size: 24,
    minZoomVisible: 9,
    historyOpacity: 0.6,
    lineOptions: {
      color: "#444444",
      weight: 3,
      opacity: 0.8,
      dashArray: "6, 6"
    }
  }
};

async function initializeMap() {
  dbIcons = getDbIcons();

  const localData = localStorage.getItem('map_last_view');
  if (localData) {
    try {
      const parsed = JSON.parse(localData);
      sessionView = { center: [parsed.lat, parsed.lng], zoom: parsed.zoom };
    } catch (e) { console.error("Error parsing LocalStorage", e); }
  }

  const startView = sessionView || SYSTEM_DEFAULT;

  map = L.map("map", {
    center: startView.center,
    zoom: startView.zoom,
    minZoom: 2.9,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

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

  $("#close-upload-modal").on("click", function () {
    $('#upload-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
  })

  $("#close-rules-modal").on("click", function () {
    $('#rules-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
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

    $("#submit-csv-button").off("click").on("click", function () {
      if (!selectedCsvText) {
        console.error("No CSV loaded");
        return;
      }

      $.ajax({
        url: "/macro_map/upload_csv",
        method: "POST",
        dataType: "json",
        data: { csv_content: selectedCsvText }
      }).done(async function (res) {
        if (!res || res.status !== "success") return;

        clearAllMarkersFromMap(map);
        mapEntities = [];
        const assets = res.assets || [];
        const dates = await getDates();

        const promises = assets.map(a => {
          const obj = {
            id: generateId(),
            iconType: a.iconType,
            lat: a.lat,
            lng: a.lng,
            marker_size: a.marker_size,
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
          return DrawNewAlert(dates.start_date, dates.end_date, obj, false);
        });

        await Promise.all(promises);
        mapEntities.forEach(obj => {
          obj.marker.addTo(map);
          obj.badge_marker.addTo(map);
          obj.name_marker.addTo(map);
        });

        drawInfrastructureLinks();
        saveCurrentMapState();
        updateBadgesVisibility();

        if (mapEntities.length > 0) {
          const points = mapEntities.map(e => [e.lat, e.lng]);

          const bounds = L.latLngBounds(points);

          map.fitBounds(bounds, { padding: [50, 50] });

          initialCoordinates = [map.getCenter().lat, map.getCenter().lng];
          initialZoom = map.getZoom();

          saveCurrentMapState();
        }

        $('#upload-modal').css('display', 'none');
        $('#modal-mask').css('display', 'none');
      }).fail(function (xhr) {
        console.error(xhr.status, xhr.responseText);
        console.error("Upload failed (server error)");
      });
    });

    reader.readAsText(file);
  });

  map.on("movestart", function () {
    $("#PopoverOption").hide();
  });

  map.on('click', function () {
    $("#PopoverOption").hide();
  });

  $("#edit_rules").off("click").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const id = selectedEntityId ?? Number($("#PopoverOption").attr("data-selected-entity-id"));
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
    $("#PopoverOption").hide();
  });

  $("#delete_marker").off("click").on("click", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const id = selectedEntityId ?? Number($("#PopoverOption").attr("data-selected-entity-id"));
    if (id == null) {
      console.warn("No selected entity");
      return;
    }

    const entity = mapEntities.find(x => x.id == id);
    if (!entity) {
      console.warn("Entity not found:", id);
      return;
    }

    console.log("Delete marker:", entity);
    deleteMarkerFromMap(entity);
    $("#PopoverOption").hide();
  });

  $("#alerts_table").on("click", function () {
    const id = selectedEntityId ?? Number($("#PopoverOption").attr("data-selected-entity-id"));
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

  $(document).on("change", "#enable-history-tracking", function () {
    $("#past-positions-input").prop("disabled", !$(this).is(":checked"));
  });

  bindRulesEditor("#rules-grid-container");
}

function openUploadModal() {
  $("#upload-modal").css('display', 'flex');
  $('#modal-mask').css('display', 'flex');
}

function fadeIn() {
  $('#wrapper').removeClass('hidden').addClass('visible');
}

function getDbIcons() {
  return [
    {
      class_name: "Administration",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M1 24h-1v-2h.998l.014-9h3.988v-3h2v3h2v-3h2v3h2v-3h2v3h2v-3h2v3h4v9h1v2h-23zm20-7h-18v5h2v-3c0-.552.448-1 1-1s1 .448 1 1v3h2v-3c0-.552.448-1 1-1s1 .448 1 1v3h2v-3c0-.552.448-1 1-1s1 .448 1 1v3h2v-3c0-.552.448-1 1-1s1 .448 1 1v3h2v-5zm-6-15h-3v1c2.966 0 6.158 1.979 7 6h-14c.547-3.78 3.638-5.827 6-6v-3h4v2z'/></svg>"
    },
    {
      class_name: "Airport",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M22 1h-2v1h4v5l-2 2v13h2v2h-24v-2h2v-9h12v-4l-2-2v-5h4v-1h-2v-1h8v1zm-13 18h-3v4h3v-4zm5 0h-4v4h4v-4zm4 0h-3v4h3v-4zm-2-15h-2v2l1 1h1v-3zm3 0h-2v3h2v-3zm3 0h-2v3h1l1-1v-2z'/></svg>"
    },
    {
      class_name: "Bank",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M11.5 1L2 6v2h19V6m-5 4v7h3v-7M2 22h19v-3H2m8-9v7h3v-7m-9 0v7h3v-7z'/></svg>"
    },
    {
      class_name: "Hospital",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M24 24h-23v-15h4v-3h3v-6h9v6h3v3h4v15zm-15-5v4h3v-4h-3zm4 0v4h3.012v-4h-3.012zm-8 0h-2v2h2v-2zm17 0h-2v2h2v-2zm-11-4h-2v2h2v-2zm5.012 0h-2v2h2v-2zm-11.012 0h-2v2h2v-2zm17 0h-2v2h2v-2zm-11-4h-2v2h2v-2zm5.012 0h-2v2h2v-2zm-11.012 0h-2v2h2v-2zm17 0h-2v2h2v-2zm-11-4h-2v2h2v-2zm5.012 0h-2v2h2v-2zm-3.012-4h-1v-1h-1v3h1v-1h1v1h1v-3h-1v1z'/></svg>"
    },
    {
      class_name: "Industry",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M24 24h-24v-18h5v9l7-6v3.704l-1.828 1.529.642.767 3.367-2.817 3.819-3.183v3.713l-1.816 1.52.641.767 4.602-3.85-.003-.004 2.576-2.146v15zm-18-6h-2v3h2v-3zm10 0h-2v3h2v-3zm-5 0h-2v3h2v-3zm10 0h-2v3h2v-3zm-18-13h-1c.198-2.182 1.785-4 3.5-4 .246 0 .478.059.683.164.316-.687 1.011-1.164 1.817-1.164s1.501.477 1.817 1.164c.205-.105.437-.164.683-.164.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5c-.246 0-.478-.059-.683-.164-.316.687-1.011 1.164-1.817 1.164-2.345 0-3.722-2.951-5 0z'/></svg>"
    },
    {
      class_name: "Nuclear",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M24 24h-24v-2h1c2.996-4.904 3.945-12.985 4-16h7c.054 2.94 1.005 10.982 4 16h1.742l-.642-1.093c-1.195-2.145-1.948-4.546-2.501-6.924.268-1.659.385-3.106.401-3.983h5c.04 2.205.753 8.236 3 12h1v2zm-18.287-6h2l-1.167 3 4.167-5h-2l1.167-3-4.167 5zm12.924-12.915c.238-.522.759-.885 1.363-.885s1.125.363 1.363.885c.154-.08.328-.125.512-.125.621 0 1.125.511 1.125 1.14 0 .629-.504 1.14-1.125 1.14-.184 0-.358-.045-.512-.125-.238.522-.759.885-1.363.885s-1.125-.363-1.363-.885c-.154.08-.328.125-.512.125-.621 0-1.125-.511-1.125-1.14 0-.629.504-1.14 1.125-1.14.184 0 .358.045.512.125zm-10.637-.085c.198-2.182 1.785-4 3.5-4 .246 0 .478.059.683.164.316-.687 1.011-1.164 1.817-1.164s1.501.477 1.817 1.164c.205-.105.437-.164.683-.164.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5c-.246 0-.478-.059-.683-.164-.316.687-1.011 1.164-1.817 1.164-2.345 0-3.722-2.951-5 0h-1z'/></svg>"
    },
    {
      class_name: "Port",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M23.25 16.83h-22a1.21 1.21 0 0 0-.92.41a1.25 1.25 0 0 0-.32 1a5.7 5.7 0 0 0 .69 2.13a.25.25 0 0 0 .23.13a2.3 2.3 0 0 1 .45 0c.58.08 1.49-.68 1.83-1.1a2.56 2.56 0 0 1 1.95-.94a2.49 2.49 0 0 1 2.13 1.19a2 2 0 0 0 1.41.82a2.7 2.7 0 0 0 1.81-1a2.5 2.5 0 0 1 4.29.4a1.2 1.2 0 0 0 1 .57a1.78 1.78 0 0 0 1.37-.76a2.51 2.51 0 0 1 2.17-1.25a2.55 2.55 0 0 1 2.13 1.19c.08.1.7.87 1.27.81a2 2 0 0 1 .35 0a.26.26 0 0 0 .22-.13a5.7 5.7 0 0 0 .69-2.72a.75.75 0 0 0-.75-.75m0-15.83a.76.76 0 0 0-.75.75v1.63a.24.24 0 0 1-.12.21a.25.25 0 0 1-.25 0A4.5 4.5 0 0 0 20.25 3A1.23 1.23 0 0 0 19 4.25V6.5a.25.25 0 0 0 .25.25H21a.75.75 0 0 1 0 1.5h-1.75a.25.25 0 0 0-.25.25v6.08a.76.76 0 0 0 .75.75h3.5a.76.76 0 0 0 .75-.75V1.75a.76.76 0 0 0-.75-.75'/><path fill='${fillColor}' d='M22.87 21.94c-1.63.21-2.74-1.5-2.75-1.52a1 1 0 0 0-1.72 0A3.25 3.25 0 0 1 15.73 22a2.74 2.74 0 0 1-2.34-1.44a1 1 0 0 0-1.71-.15a4.26 4.26 0 0 1-3 1.59A3.43 3.43 0 0 1 6 20.42a1 1 0 0 0-1.64-.09S2.8 22.2 1.13 22a1 1 0 1 0-.26 2a5 5 0 0 0 .55 0a5.6 5.6 0 0 0 3.48-1.43a.24.24 0 0 1 .32 0A5.13 5.13 0 0 0 8.65 24a5.7 5.7 0 0 0 3.56-1.32a.25.25 0 0 1 .33 0A4.48 4.48 0 0 0 15.73 24a5.06 5.06 0 0 0 3.38-1.3a.24.24 0 0 1 .33 0a4.54 4.54 0 0 0 3.69 1.26a1 1 0 1 0-.26-2ZM11.52 10.5h5s1 0 1 1v3.33s0 1-1 1h-5s-1 0-1-1V11.5s0-1 1-1m-7.19.26a1 1 0 0 0 .67-.27a1 1 0 0 0 .05-1.41a.9.9 0 0 1-.25-.61a.91.91 0 1 1 1.58.6a1 1 0 1 0 1.5 1.32A2.89 2.89 0 0 0 6.55 5.7V3.85a.25.25 0 0 1 .15-.22a.26.26 0 0 1 .27 0L13 8.82a.8.8 0 0 0 .49.18H17a.74.74 0 0 0 .71-.53a.75.75 0 0 0-.29-.84L6.88.32a1.48 1.48 0 0 0-2.32.94v4.56a2.89 2.89 0 0 0-.95 4.62a1 1 0 0 0 .72.32'/></svg>"
    },
    {
      class_name: "Radar",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='m7.418 3.973l4.848 4.847l.087-.087a1 1 0 0 1 1.414 1.414l-.087.087l4.347 4.348c.572.572.614 1.557-.053 2.15a8.97 8.97 0 0 1-4.807 2.193l.98 1.318A1.1 1.1 0 0 1 13.266 22h-6.58a1.1 1.1 0 0 1-1.017-1.518l1.253-3.051A8.99 8.99 0 0 1 3 10a8.97 8.97 0 0 1 2.269-5.974c.592-.667 1.577-.625 2.15-.053Zm1.277 14.4L8.028 20h3.446l-.819-1.1a9 9 0 0 1-1.96-.526Zm5.413-13.32a3.5 3.5 0 0 1 2.858 2.96a1 1 0 0 1-1.958.393l-.023-.115a1.5 1.5 0 0 0-1.07-1.233l-.155-.035a1 1 0 0 1 .348-1.97M14 2a6 6 0 0 1 6 6a1 1 0 0 1-1.993.117L18 8a4 4 0 0 0-4-4a1 1 0 1 1 0-2'/></svg>"
    },
    {
      class_name: "Telecom",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M15.929 11.517c.848-1.003 1.354-2.25 1.354-3.601s-.506-2.598-1.354-3.601l1.57-1.439c1.257 1.375 2.022 3.124 2.022 5.04s-.766 3.664-2.022 5.041l-1.57-1.44zm-10.992-10.076l-1.572-1.441c-2.086 2.113-3.365 4.876-3.365 7.916s1.279 5.802 3.364 7.916l1.572-1.441c-1.672-1.747-2.697-4.001-2.697-6.475s1.026-4.728 2.698-6.475zm1.564 11.515l1.57-1.439c-.848-1.003-1.354-2.25-1.354-3.601s.506-2.598 1.354-3.601l-1.57-1.439c-1.257 1.375-2.022 3.124-2.022 5.04s.765 3.664 2.022 5.04zm14.134-12.956l-1.571 1.441c1.672 1.747 2.697 4.001 2.697 6.475s-1.025 4.728-2.697 6.475l1.572 1.441c2.085-2.115 3.364-4.877 3.364-7.916s-1.279-5.803-3.365-7.916zm-2.552 24h-2.154c-.85-2.203-2.261-3.066-3.929-3.066-1.692 0-3.088.886-3.929 3.066h-2.113l5.042-13.268c-1.162-.414-2-1.512-2-2.816 0-1.657 1.344-3 3-3s3 1.343 3 3c0 1.304-.838 2.403-2 2.816l5.083 13.268zm-6.083-10.214l-.852 2.214h1.703l-.851-2.214zm2.006 5.214l-.385-1h-3.242l-.385 1h4.012z'/></svg>"
    },
    {
      class_name: "Water",
      html: "<svg viewBox='0 0 24 24' width='100%' height='100%' preserveAspectRatio='xMidYMid meet' stroke='black' stroke-width='0.5' xmlns='http://www.w3.org/2000/svg' fill-rule='evenodd' clip-rule='evenodd'><path fill='${fillColor}' d='M19 14.5s2 2.17 2 3.5a2 2 0 0 1-2 2a2 2 0 0 1-2-2c0-1.33 2-3.5 2-3.5M5 18V9a2 2 0 0 1-2-2a2 2 0 0 1 2-2V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1h8a2 2 0 0 1 2 2v4a1 1 0 0 1 1 1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1a1 1 0 0 1 1-1V9h-6v9h1a2 2 0 0 1 2 2v2H2v-2a2 2 0 0 1 2-2z'/></svg>"
    },
    {
      class_name: "Drone",
      html: "<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' viewBox='0 0 512 512' preserveAspectRatio='xMidYMid meet'><path fill='${fillColor}' stroke='black' stroke-width='0.5' vector-effect='non-scaling-stroke' stroke-linejoin='round' stroke-linecap='round' d='M469.333,85.675V42.667h21.333c11.797,0,21.333-9.557,21.333-21.333S502.464,0,490.667,0h-85.333 C393.536,0,384,9.557,384,21.333s9.536,21.333,21.333,21.333h21.333v43.008C402.88,87.381,384,107.093,384,131.307v27.968 l-20.907,14.037v-23.979c0-11.776-9.557-21.333-21.333-21.333H171.093c-11.797,0-21.333,9.557-21.333,21.333v24.299L128,159.211 v-27.904c0-24.213-18.88-43.925-42.667-45.632V42.667h21.333c11.797,0,21.333-9.557,21.333-21.333S118.464,0,106.667,0H21.333 C9.536,0,0,9.557,0,21.333s9.536,21.333,21.333,21.333h21.333v43.008C18.88,87.381,0,107.093,0,131.307v142.72 C0,299.371,20.629,320,45.952,320h36.096C107.371,320,128,299.371,128,274.027v-63.659l21.76,14.421v52.544 c0,0.277,0.128,0.491,0.149,0.768c-3.2,2.667-6.507,5.12-9.387,8.277c-39.701,43.392-33.621,117.696-33.365,120.832 c0.981,11.093,10.304,19.456,21.248,19.456c0.619,0,1.259-0.021,1.877-0.085c11.755-1.045,20.416-11.392,19.392-23.125 c-0.043-0.597-4.416-59.051,22.315-88.256c10.176-11.136,23.851-16.533,41.771-16.533h21.227l-0.213,42.667H192 c-11.797,0-21.333,9.557-21.333,21.333v128c0,11.776,9.536,21.333,21.333,21.333h128c11.797,0,21.333-9.557,21.333-21.333v-128 c0-11.776-9.536-21.333-21.333-21.333h-42.56l0.213-42.667h21.44c17.856,0,31.509,5.376,41.685,16.448 c22.4,24.405,23.765,72,22.379,88.341c-1.024,11.733,7.659,22.08,19.392,23.125c0.619,0.064,1.259,0.085,1.899,0.085 c10.923,0,20.245-8.363,21.227-19.456c0.256-3.136,6.336-77.44-33.365-120.832c-2.88-3.157-6.187-5.611-9.387-8.277 c0.021-0.277,0.171-0.491,0.171-0.768v-52.608L384,210.688v63.339C384,299.371,404.629,320,429.952,320h36.096 C491.371,320,512,299.371,512,274.027v-142.72C512,107.093,493.12,87.381,469.333,85.675z M256,448 c-11.776,0-21.333-9.557-21.333-21.333s9.557-21.333,21.333-21.333s21.333,9.557,21.333,21.333S267.776,448,256,448z'/></svg>"
    }
  ]
}

function DrawNewAlert(start_date, end_date, obj, addToMapNow = true) {
  return new Promise((resolve, reject) => {
    const body = {
      entity_name: obj.entity_name,
      start_date: start_date,
      end_date: end_date
    };

    $.ajax({
      url: `/get_alerts_by_entityname`,
      type: "POST",
      data: body,
      contentType: "application/json",
      success: function (response) {
        obj.a_high = 0; obj.a_medium = 0; obj.a_low = 0; obj.a_info = 0;

        if (response.status === "success" && response.data.length > 0) {
          obj.a_high = countAlerts(response.data, "High");
          obj.a_medium = countAlerts(response.data, "Medium");
          obj.a_low = countAlerts(response.data, "Low");
          obj.a_info = countAlerts(response.data, "Info");

          const cache = buildAlertDescriptionCache(response.data);
          obj.alert_text = cache.alert_text;
          obj._alertDescLoaded = true;

          syncRelatedIconsFromAlerts(obj, response.data, addToMapNow);
        }

        const newIcon = assignIcon(obj.iconType, obj.id, obj.marker_size, obj.nationality);

        if (obj.marker) {
          obj.marker.setIcon(newIcon);
          if (obj.badge_marker) obj.badge_marker.setIcon(buildBadgeIcon(obj));

          // Update tooltip content if the marker already exists
          const updatedContent = createEntityTooltipHtml(obj);
          obj.marker.setTooltipContent(updatedContent);
        } else {
          obj.marker = L.marker([obj.lat, obj.lng], { icon: newIcon });
          obj.badge_marker = L.marker([obj.lat, obj.lng], { icon: buildBadgeIcon(obj), interactive: true });
          obj.name_marker = L.marker([obj.lat, obj.lng], { icon: buildNameBadge(obj), interactive: false });

          if (addToMapNow) {
            obj.marker.addTo(map);
            obj.badge_marker.addTo(map);
            obj.name_marker.addTo(map);
          }

          // Create the rich tooltip
          const tooltipHtml = createEntityTooltipHtml(obj);
          obj.marker.bindTooltip(tooltipHtml, {
            permanent: false,
            direction: 'top',
            offset: [0, -10],
            className: 'entity-rich-tooltip'
          });

          obj.marker.on('click', function () {
            selectedEntityId = obj.id;
            $("#PopoverOption").attr("data-selected-entity-id", obj.id);
            show_popover($(this._icon));
          });
        }
        resolve();
      },
      error: function (e) {
        reject(e);
      }
    });
  });
}

function createEntityTooltipHtml(obj) {
  return `
    <div style="text-align: center; min-width: 120px; padding: 2px;">
      <div style="font-weight: bold; font-size: 13px;">${obj.name}</div>
      ${obj.town ? `<div style="font-style: italic; color: #666; font-size: 11px;">${obj.town}</div>` : ''}
      ${getAlertsHtmlForTooltip(obj)}
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
    found_icon.html.replace(/\$\{fillColor\}/g, fillColor) :
    `<div style="width:100%; height:100%; background:${fillColor}; border:1px solid #000;"></div>`;

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
    <div class="badge-box ${posClass}" style="--icon-radius:${radiusPx}px; cursor: ${isClickable ? 'pointer' : 'default'};">
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
    <div class="badge-box ${posClass}" style="--icon-radius:${radiusPx}px;">
      <span class="name-display">${obj.name}</span>
    </div>
  `;
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

function updateBadgesVisibility() {
  const z = map.getZoom();
  mapEntities.forEach(obj => {
    const visibleBadge = z >= obj.display_visible;
    const visibleName = z >= obj.name_visible;

    if (obj.badge_marker) {
      obj.badge_marker.setOpacity((visibleBadge && allBadgesVisible) ? 1 : 0);
      obj.badge_marker.setIcon(buildBadgeIcon(obj));
      if (obj.badge_marker._icon) {
        obj.badge_marker._icon.style.pointerEvents = visibleBadge ? "auto" : "none";
      }
    }

    if (obj.name_marker) {
      obj.name_marker.setOpacity((visibleName && allNamesVisible) ? 1 : 0);
      if (obj.name_marker._icon) {
        obj.name_marker._icon.style.pointerEvents = "none";
      }
    }
  });
}

function downloadBase64File(filename, contentType, base64Data) {
  const binary = atob(base64Data);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

  const blob = new Blob([bytes], { type: contentType || "application/octet-stream" });

  saveAs(blob, filename || "download");
}

function clearAllMarkersFromMap(map) {
  map.eachLayer(function (layer) {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });
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
  $("#PopoverOption").hide();
}

// Functions to render the rules grid
function openRulesModal(entity) {
  $("#rules-modal").css("display", "flex");
  $("#modal-mask").css("display", "flex");

  $("#rules-modal-title").text(`Rules for: ${entity.entity_name || entity.name || entity.id}`);

  const container = document.querySelector("#rules-grid-container");
  renderRulesGrid(container, entity);
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
  const newIcon = assignIcon(entity.iconType, entity.id, entity.marker_size, entity.nationality);
  entity.marker.setIcon(newIcon);
}

function addRuleToMarker() {
  const id = selectedEntityId ?? Number($("#PopoverOption").attr("data-selected-entity-id"));
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
function getColor(id) {
  const entity = mapEntities.find(e => e.id == id);
  if (!entity) return "black";

  const color = resolveColorByRules(entity);
  return color || "black";
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

function show_popover(node) {
  var popover = $("#PopoverOption .popover");

  $("#PopoverOption").css({ "visibility": "hidden", "display": "block" });

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

  $("#PopoverOption").css({ "top": top, "left": left, "visibility": "visible" });
}

// Functions to obtain the date and convert the format
async function getDates() {
  var dates = await get_time();

  if (!dates.start_date || !dates.end_date) {
    return null;
  }

  const startDate = convertToISO(dates.start_date);
  const endDate = convertToISO(dates.end_date);

  return {
    start_date: startDate,
    end_date: endDate
  };
}

async function get_time() {
  var time = await $.ajax({
    url: "/get_time",
    type: "GET"
  });

  return time;
}

function convertToISO(dateStr) {
  var dt = moment.utc(dateStr, "YYYY-MM-DD HH:mm:ssZ");
  return dt.format("YYYY-MM-DD HH:mm:ss.SSSSSS+00:00");
}
// -------

async function navigate_to_table(entityName, alertType) {
  if (entityName || alertType) {
    const body = {
      entity_name: entityName,
      alert_type: alertType
    };

    await $.ajax({
      url: "/navigate_to_table",
      type: "POST",
      data: body,
      contentType: "application/json"
    });
  }
}

function countAlerts(array, severity) {
  count = 0;

  array.forEach(alert => {
    if (alert[1] == severity) {
      count++;
    }
  })
  return count;
}

function createDefaultRules() {
  return structuredClone(DEFAULT_ICON_RULES).map(r => ({
    ...r,
    ruleId: generateId()
  }));
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
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
function addRelatedMarkerForEntity(entity, relType, lat, lng, options = {}) {
  if (!entity) return null;
  if (!Array.isArray(entity.related_icons)) entity.related_icons = [];

  if (hasRelatedAt(entity, relType, lat, lng)) return null;

  const cfg = getRelatedIconConfig(relType, options);
  if (!cfg) return null;

  const icon = assignIconFixedColor(cfg.iconType, cfg.size, cfg.color);

  const marker = L.marker([lat, lng], {
    icon,
    interactive: false
  }).addTo(map);

  marker.setOpacity(map.getZoom() >= cfg.minZoomVisible ? 1 : 0);

  const rel = {
    relId: generateId(),
    relType,
    lat,
    lng,
    marker
  };

  entity.related_icons.push(rel);
  return rel;
}

function getRelatedIconConfig(relType, overrides = {}) {
  const t = (relType || "").toLowerCase();

  switch (t) {
    case "drone": {
      const base = RELATED_ICON_DEFAULTS.drone;
      return {
        iconType: base.iconType,
        color: base.color,
        historyColor: base.historyColor,
        size: base.size,
        minZoomVisible: base.minZoomVisible,
        historyOpacity: base.historyOpacity,
        ...overrides
      };
    }
    default:
      console.warn("Unknown related icon type:", relType);
      return null;
  }
}

function updateRelatedIconsVisibility() {
  const z = map.getZoom();

  mapEntities.forEach(entity => {
    const rels = entity.related_icons || [];

    rels.forEach(rel => {
      if (!rel?.marker) return;

      const cfg = getRelatedIconConfig(rel.relType);
      let isVisible = cfg && z >= cfg.minZoomVisible;

      if (rel.relType === "drone") {
        if (!showHistory && !rel.isLatest) {
          isVisible = false;
        }
      }

      const baseOpacity = rel.baseOpacity ?? 1;
      const finalOpacity = isVisible ? baseOpacity : 0;
      rel.marker.setOpacity(finalOpacity);

      if (rel.marker._icon) {
        rel.marker._icon.style.pointerEvents = isVisible ? "auto" : "none";
      }
    });

    if (entity._droneLines) {
      Object.values(entity._droneLines).forEach(line => {
        const lineVisible = showHistory && z >= RELATED_ICON_DEFAULTS.drone.minZoomVisible;
        line.setStyle({ opacity: lineVisible ? RELATED_ICON_DEFAULTS.drone.lineOptions.opacity : 0 });
      });
    }
  });
}

function syncRelatedIconsFromAlerts(entity, alertRows) {
  if (!entity) return;
  if (!entity._droneLines) entity._droneLines = {};

  const allDronesData = extractLatestDronesFromAlerts(alertRows);

  const currentKeys = new Set(allDronesData.map(d => `${d.vectorId}_${d.timeMs}`));

  entity.related_icons = entity.related_icons.filter(rel => {
    if (rel.relType === "drone") {
      if (!currentKeys.has(rel.relKey)) {
        if (rel.marker) map.removeLayer(rel.marker);
        return false;
      }
    }
    return true;
  });

  const pathsById = {};

  allDronesData.forEach(d => {
    upsertRelatedMarkerForEntity(entity, "drone", d.vectorId, d.lat, d.lng, d);

    if (!pathsById[d.vectorId]) pathsById[d.vectorId] = [];
    pathsById[d.vectorId].push([d.lat, d.lng]);
  });

  Object.keys(pathsById).forEach(vectorId => {
    const coordinates = pathsById[vectorId];
    if (coordinates.length >= 2) {
      const lineStyle = RELATED_ICON_DEFAULTS.drone.lineOptions;
      if (!entity._droneLines[vectorId]) {
        entity._droneLines[vectorId] = L.polyline(coordinates, lineStyle).addTo(map);
      } else {
        entity._droneLines[vectorId].setLatLngs(coordinates);
        entity._droneLines[vectorId].setStyle(lineStyle);
      }
    } else if (entity._droneLines[vectorId]) {
      map.removeLayer(entity._droneLines[vectorId]);
      delete entity._droneLines[vectorId];
    }
  });

  updateRelatedIconsVisibility();
}

function removeAllRelatedIcons(entity) {
  if (!entity) return;

  if (Array.isArray(entity.related_icons)) {
    entity.related_icons.forEach(rel => {
      if (rel?.marker) map.removeLayer(rel.marker);
    });
    entity.related_icons = [];
  }

  if (entity._droneLines) {
    Object.values(entity._droneLines).forEach(line => {
      map.removeLayer(line);
    });
    entity._droneLines = {};
  }
}

function hasRelatedAt(entity, relType, lat, lng, eps = 1e-6) {
  const arr = entity.related_icons || [];
  return arr.some(x =>
    (x.relType || "").toLowerCase() === (relType || "").toLowerCase() &&
    Math.abs(x.lat - lat) <= eps &&
    Math.abs(x.lng - lng) <= eps
  );
}

function assignIconFixedColor(iconType, size, fillColor) {
  const found = dbIcons.find(x => x.class_name === iconType);
  const finalSize = Number(size) || 22;

  if (found) {
    let processedHtml = found.html
      .replace(/\$\{fillColor\}/g, fillColor)
      .replace(/stroke='black'/g, `stroke='${fillColor}'`);

    return L.divIcon({
      className: `map-icon ${iconType}-fixed`,
      html: processedHtml,
      iconSize: [finalSize, finalSize],
      iconAnchor: [finalSize / 2, finalSize / 2],
    });
  }

  return L.divIcon({
    className: "map-icon fallback",
    html: `<div style="width:100%; height:100%; border-radius:50%; background:${fillColor}; border:1px solid #333"></div>`,
    iconSize: [finalSize, finalSize],
    iconAnchor: [finalSize / 2, finalSize / 2],
  });
}

function extractLatestDronesFromAlerts(rows) {
  const dronesGrouped = {};

  (rows || []).forEach(r => {
    if (!r || r.length < 8) return;

    const startTime = r[4];
    const vectorIdRaw = r[5];
    const category = r[6];
    const geo = r[7];

    if (!vectorIdRaw || !categoryHasDrone(category)) return;

    const pt = parseGeoPoint(geo);
    const timeMs = parseTimeMs(startTime);
    if (!pt || timeMs == null) return;

    const ids = Array.isArray(parseArrayish(vectorIdRaw)) ? parseArrayish(vectorIdRaw) : [vectorIdRaw];

    ids.forEach(vid => {
      const key = String(vid);
      if (!dronesGrouped[key]) dronesGrouped[key] = [];
      dronesGrouped[key].push({
        vectorId: key,
        lat: pt.lat,
        lng: pt.lng,
        timeMs,
        start_time: startTime
      });
    });
  });

  const allDrones = [];
  Object.keys(dronesGrouped).forEach(vid => {
    let history = dronesGrouped[vid].sort((a, b) => a.timeMs - b.timeMs);

    const totalToKeep = past_positions_limit + 1;

    if (history.length > totalToKeep) {
      history = history.slice(-totalToKeep);
    }

    history.forEach((data, index) => {
      data.isLatest = (index === history.length - 1);
      allDrones.push(data);
    });
  });

  return allDrones;
}

function categoryHasDrone(categoryValue) {
  const cat = parseArrayish(categoryValue);
  if (!Array.isArray(cat)) return false;

  for (const inner of cat) {
    if (Array.isArray(inner) && inner.some(x => String(x).toLowerCase() === "drone")) {
      return true;
    }
    if (!Array.isArray(inner) && String(inner).toLowerCase() === "drone") {
      return true;
    }
  }
  return false;
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

function parseTimeMs(value) {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value)) return value;

  const s = String(value).trim();
  if (!s) return null;

  const ms = Date.parse(s);
  if (Number.isFinite(ms)) return ms;

  return null;
}

function findRelatedByKey(entity, relType, relKey) {
  const rels = entity?.related_icons || [];
  const t = (relType || "").toLowerCase();
  const k = (relKey || "").toString();

  return rels.find(r =>
    (r?.relType || "").toLowerCase() === t &&
    (r?.relKey || "").toString() === k
  ) || null;
}

function upsertRelatedMarkerForEntity(entity, relType, vectorId, lat, lng, data, options = {}) {
  if (!entity) return null;

  const relKey = `${vectorId}_${data.timeMs}`;
  const cfg = getRelatedIconConfig(relType, options);
  if (!cfg) return null;

  const existing = findRelatedByKey(entity, relType, relKey);

  if (!existing) {
    const isLatest = data.isLatest;

    const finalOpacity = isLatest ? 1.0 : (cfg.historyOpacity || 0.2);
    const finalColor = isLatest ? cfg.color : (cfg.historyColor || "#888888");

    const icon = assignIconFixedColor(cfg.iconType, cfg.size, finalColor);

    const marker = L.marker([lat, lng], {
      icon: icon,
      interactive: true,
      opacity: finalOpacity
    }).addTo(map);

    if (marker.getElement()) {
      marker.getElement().style.opacity = finalOpacity;
    } else {
      marker.on('add', function () {
        if (marker.getElement()) marker.getElement().style.opacity = finalOpacity;
      });
    }

    let distStr = "N/A";
    if (map) {
      const dMeters = map.distance([lat, lng], [entity.lat, entity.lng]);
      distStr = dMeters >= 1000 ? (dMeters / 1000).toFixed(2) + " km" : Math.round(dMeters) + " m";
    }

    const tooltipData = {
      ...data,
      distance: distStr,
      lat: lat,
      lng: lng
    };

    const tooltipContent = getDroneTooltipContent(tooltipData);
    marker.bindTooltip(tooltipContent, {
      direction: 'top',
      offset: [0, -10],
      className: 'drone-tooltip'
    });

    const rel = {
      relId: generateId(),
      relType,
      relKey: relKey,
      lat, lng,
      timeMs: data.timeMs,
      baseOpacity: finalOpacity,
      isLatest: isLatest,
      marker
    };

    entity.related_icons.push(rel);
    return rel;
  } else {
    existing.isLatest = data.isLatest;
  }

  return existing;
}

function getDroneTooltipContent(data) {
  if (!data) return "";

  // Simple template, easy to modify
  return `
        <div class="drone-tooltip" style="text-align:left;">
            <b>Drone ID:</b> ${data.vectorId || "Unknown"}<br/>
            <b>Time:</b> ${data.start_time || "N/A"}<br/>
            <b>Location:</b> ${data.lat?.toFixed(5)}, ${data.lng?.toFixed(5)}<br/>
            <b>Distance:</b> ${data.distance || "N/A"}<br/>
        </div>
    `;
}

function setDefaultPosition() {
  if (map) {
    const center = map.getCenter();
    defaultView = {
      center: [center.lat, center.lng],
      zoom: map.getZoom()
    };
    console.log("New default (Home) position set:", defaultView);
    saveCurrentMapState();
  }
}

function resetMapPosition() {
  if (map) {
    console.log(defaultView);
    map.setView(defaultView.center, defaultView.zoom);
  }
}

function centerMapOnEntity(entity) {
  if (map && entity) {
    map.once('moveend', function () {
      setDefaultPosition();
      saveCurrentMapState();
    });

    map.setView([entity.lat, entity.lng], map.getZoom());
  }
}

async function loadSavedMapState() {
  try {
    const res = await $.ajax({
      url: "/macro_map/load_state",
      method: "GET",
      dataType: "json"
    });

    if (!res || res.status === "error" || res.status === "no_data") return;

    if (res.global_settings) {
      allNamesVisible = res.global_settings.names_visible ?? true;
      allBadgesVisible = res.global_settings.badges_visible ?? true;
      showHistory = res.global_settings.show_history ?? true;
      past_positions_limit = res.global_settings.history_limit ?? 10;
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

    const dates = await getDates();
    clearAllMarkersFromMap(map);
    mapEntities = [];

    const promises = rawAssets.map(a => {
      const obj = {
        ...a,
        marker: undefined,
        name_marker: undefined,
        badge_marker: undefined,
        related_icons: [],
        links_to: a.links_to || "",
        nationality: a.nationality || ""
      };
      mapEntities.push(obj);
      // Return the DrawNewAlert promise
      return DrawNewAlert(dates.start_date, dates.end_date, obj, false); // Note the 'false' flag
    });

    // 2. Wait until ALL data has been fetched
    await Promise.all(promises);

    // 3. Now that all data is ready in memory, add it to the map
    mapEntities.forEach(obj => {
      if (obj.marker) obj.marker.addTo(map);
      if (obj.badge_marker) obj.badge_marker.addTo(map);
      if (obj.name_marker) obj.name_marker.addTo(map);
      // Also add related icons (drones and lines) when present
      if (obj.related_icons) {
        obj.related_icons.forEach(rel => {
          if (rel.marker) rel.marker.addTo(map);
        });
      }
      if (obj._droneLines) {
        Object.values(obj._droneLines).forEach(line => line.addTo(map));
      }
    });

    drawInfrastructureLinks();
    updateBadgesVisibility();
    updateRelatedIconsVisibility();

    console.log("Map loaded instantly: " + mapEntities.length + " assets ready.");
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
      show_history: showHistory,
      history_limit: past_positions_limit
    },
    assets: assetsToSave
  };

  $.ajax({
    url: "/macro_map/save_state",
    method: "POST",
    data: { state_data: JSON.stringify(stateToSave) }
  });
}

function openSettingsModal() {
    $("#settings-modal").css('display', 'flex');
    $('#modal-mask').css('display', 'flex');
    $("#past-positions-input").val(past_positions_limit);
    $("#display-entity-names").prop("checked", allNamesVisible);
    $("#display-alerts").prop("checked", allBadgesVisible);
    $("#enable-history-tracking").prop("checked", showHistory);
    $("#past-positions-input").prop("disabled", !showHistory);
}

function closeSettingsModal() {
  $('#settings-modal').css('display', 'none');
  $('#modal-mask').css('display', 'none');
}

async function applyGlobalSettings() {
  const newVal = parseInt($("#past-positions-input").val());

  if (!isNaN(newVal) && newVal >= 0) {
    past_positions_limit = newVal;

    allNamesVisible = $("#display-entity-names").is(":checked");
    allBadgesVisible = $("#display-alerts").is(":checked");
    showHistory = $("#enable-history-tracking").is(":checked");

    console.log("Applying new settings and saving to file...");

    const dates = await getDates();
    for (const entity of mapEntities) {
      await DrawNewAlert(dates.start_date, dates.end_date, entity);
    }

    updateBadgesVisibility();
    updateRelatedIconsVisibility();
    saveCurrentMapState();

    console.log("Limit updated:", past_positions_limit);
  } else {
    console.warn("Invalid input for past positions limit.");
  }
}

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
      console.log("Map state successfully reset.");
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

  console.log("Drawing links for " + mapEntities.length + " entities");

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

function getAlertsHtmlForTooltip(entity) {
  const colors = {
    high: "#FE0000",
    medium: "#f0ad4e",
    low: "#5cb85c",
    info: "#5bc0de"
  };

  return `
    <div style="margin-top: 10px; border-top: 1px solid #ccc; padding-top: 8px; display: flex; gap: 4px; justify-content: center;">
        <div style="background:${colors.high}; color:white; padding:2px 6px; border-radius:3px; font-size:10px; font-weight:bold;" title="High">${entity.a_high || 0}</div>
        <div style="background:${colors.medium}; color:white; padding:2px 6px; border-radius:3px; font-size:10px; font-weight:bold;" title="Medium">${entity.a_medium || 0}</div>
        <div style="background:${colors.low}; color:white; padding:2px 6px; border-radius:3px; font-size:10px; font-weight:bold;" title="Low">${entity.a_low || 0}</div>
        <div style="background:${colors.info}; color:white; padding:2px 6px; border-radius:3px; font-size:10px; font-weight:bold;" title="Info">${entity.a_info || 0}</div>
    </div>`;
}