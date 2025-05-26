var initialCoordinates = [47, 10];
var initialZoom = 5;
var map;
var defaultStart;
var defaultEnd;
var existingAlerts;
var fontsize;
var bounds;
var alertLayer;
var stageAlert;
var db_icons = [];
var savedPosition;
var centerCoordinates;
var zoom;
var selectedAssetIP;

var assetToEdit = "";
var user_id = "";

// Function to create the map
async function initializeMap() {

  await setUserId()

  savedPosition = await initMapPosition();

  const centerCoordinates = savedPosition
    ? savedPosition.center
    : initialCoordinates;
  const zoom = savedPosition ? savedPosition.zoom : initialZoom;

  map = L.map("map", {
    center: centerCoordinates,
    zoom: zoom,
    minZoom: 2.9,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  bounds = new L.LatLngBounds(
    [30, -20],
    [65, 50]
  );

  var boundsCenter = bounds.getCenter();
  var sw = bounds.getSouthWest();
  var ne = bounds.getNorthEast();

  var newSw = [
    boundsCenter.lat - (boundsCenter.lat - sw.lat) * 6,
    boundsCenter.lng - (boundsCenter.lng - sw.lng) * 6,
  ];
  var newNe = [
    boundsCenter.lat + (ne.lat - boundsCenter.lat) * 6,
    boundsCenter.lng + (ne.lng - boundsCenter.lng) * 6,
  ];

  var expandedBounds = new L.LatLngBounds(newSw, newNe);

  map.setMaxBounds(expandedBounds);

  // Functions to close the various modals
  $("#close-insert-modal").on("click", function() {
    $('#insert-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    $('#selected-lat-add').val("");
    $('#selected-lng-add').val("");
    $('#ip-address-add').val("");
    $('#site-name-add').val("");
  })

  $("#close-edit-modal").on("click", function() {
    $('#edit-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    $('#selected-lat-edit').val("");
    $('#selected-lng-edit').val("");
    $('#ip-address-edit').val("");
    $('#site-name-edit').val("");
  })

  $("#close-icon-modal").on("click", function() {
    $('#icon-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    $('#icon-name').val("");
    $('#svg-raw').val("");
  })

  var widthlayer = document.getElementById("map").clientWidth;
  var heightlayer = document.getElementById("map").clientHeight;
  fontsize = 11.5;
  alertLayer = new Konva.Layer();
  stageAlert = new Konva.Stage({
    container: "canvas-container",
    width: widthlayer,
    height: heightlayer,
  });
  stageAlert.add(alertLayer);

  existingAlerts = [];

  // Functions to add custom functionalities to the map
  map.on("drag", function () {
    map.panInsideBounds(expandedBounds, { animate: false });
  });

  map.on('click', function(e) {
    $('#selected-lat-add').val(e.latlng.lat);
    $('#selected-lng-add').val(e.latlng.lng);
    $('#insert-modal').css('display', 'flex');
    $('#modal-mask').css('display', 'flex');
    $("#PopoverOption").hide();
  });

  map.on("movestart", function () {
    alertLayer.hide();
    alertLayer.draw();
    $("#PopoverOption").hide();
  });

  $("#alerts_table").on("click", function() {
    navigato_to_table(selectedAssetIP)
  })

  map.on("moveend", function () {
    alertLayer.show();
    drawAlerts();
  });

  await initMapContent()
}

function fadeIn() {
  $('#buttons-container').removeClass('hidden').addClass('visible');
}

// Function used to create the Map Markers
function assignIcon(icon, id) {
  const fillColor = getColor(id);

  found_icon = db_icons.find(icon_to_check => icon_to_check.class_name == icon)

  if(found_icon) {

    const processedHtml = found_icon.html.replace(/\$\{fillColor\}/g, fillColor);

    return L.divIcon({
      className: found_icon.class_name,
      html: processedHtml,
      iconSize: [32, 32],
      iconAnchor: [12, 24],
    });
  } else {
    return L.divIcon({
      className: "building",
      html: `<svg width="24" height="24"  stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd"  clip-rule="evenodd"><path fill="${fillColor}" d="M13 2h2v2h1v19h1v-15l6 3v12h1v1h-24v-1h1v-11h7v11h1v-19h1v-2h2v-2h1v2zm8 21v-2h-2v2h2zm-15 0v-2h-3v2h3zm8 0v-2h-3v2h3zm-2-4v-13h-1v13h1zm9 0v-1h-2v1h2zm-18 0v-2h-1v2h1zm4 0v-2h-1v2h1zm-2 0v-2h-1v2h1zm9 0v-13h-1v13h1zm7-2v-1h-2v1h2zm0-2.139v-1h-2v1h2z"/></svg>`,
      iconSize: [32, 32],
      iconAnchor: [12, 24],
    });
  }
}


function drawAlerts() {
  alertLayer.destroyChildren();

  existingAlerts.forEach(function (alert) {
    var lat = alert.lat;
    var lng = alert.lng;
    if (isNaN(lat) || isNaN(lng)) {
      console.error("Coordinate non valide:", lat, lng);
      return;
    }
    var startPoint = map.latLngToContainerPoint([lat, lng]);

    var group = new Konva.Group({
      draggable: true,
    });

    var alertTypes = ['a_high', 'a_medium', 'a_low', 'a_info'];

    alertTypes.forEach(function (alertType, index) {
      var rect = new Konva.Rect({
        x: startPoint.x + (index - 2) * 21,
        y: startPoint.y + 5,
        width: 18,
        height: 17,
        fill: getAlertColor(alertType),
        stroke: "black",
        strokeWidth: 0.5,
        cornerRadius: 3,
        draggable: true,
      });

      var text = new Konva.Text({
        x: rect.x() + 0.5,
        y: rect.y() + 3,
        text: alert[alertType],
        fontSize: fontsize,
        fontFamily: "Arial",
        fill: "black",
        draggable: true,
      });

      group.add(rect);
      group.add(text);
    });

    alertLayer.add(group);
  });

  alertLayer.draw();
}

function DrawNewAlert(start_date, end_date, obj) {
  if (!isNaN(obj.lat) && !isNaN(obj.lng)) {

    body = { 
      ip: obj.ip,
      start_date: start_date,
      end_date: end_date
    }

    $.ajax({
      url: `/get_alerts_by_ip`,
      type: "POST",
      data: body,
      contentType: "application/json",
      success: function (response) {
            if (response.status === "success" && response.data.length > 0) {
                existingAlerts.push({
                  lat: obj.lat,
                  lng: obj.lng,
                  id: obj.id,
                  a_high: countAlerts(response.data, "High"),
                  a_medium: countAlerts(response.data, "Medium"),
                  a_low: countAlerts(response.data, "Low"),
                  a_info: countAlerts(response.data, "Info"),
                });
            } else {
              existingAlerts.push({
                lat: obj.lat,
                lng: obj.lng,
                id: obj.id,
                a_high: 0,
                a_medium: 0,
                a_low: 0,
                a_info: 0,
              });
            }

            let icon = assignIcon(obj.iconType, obj.id);
            let marker = L.marker([obj.lat, obj.lng], {
              icon: icon,
            }).addTo(map);
    
            obj.marker = marker;

            marker.on('click', function(e) {
              assetToEdit = obj.id;
              $("#PopoverOption").hide();
              $('#selected-lat-edit').val(obj.lat);
              $('#selected-lng-edit').val(obj.lng);
              $('#ip-address-edit').val(obj.ip);
              $('#site-name-edit').val(obj.name);
              $('#icons-dropdown-edit').val(obj.iconType)
              $('#edit-modal').css('display', 'flex');
              $('#modal-mask').css('display', 'flex');
            });

            marker.on('contextmenu', function(e) {
              var node = $(this._icon);
              selectedAssetIP = obj.ip;
              show_popover(node);
            });
            
            drawAlerts();
          },
          error: function (error) {
            console.log("Errore:", error);
          },
      });  
  }
}

function countAlerts(array, severity) {
  count = 0;

  array.forEach(alert => {
    if(alert[1] == severity) {
      count++;
    }
  })
  return count;
}

function getColor(id) {
  var alertObj = existingAlerts.find(alert => alert.id == id);
  
  if (!alertObj) {
    return "black";
  }

  var a_high = alertObj.a_high;
  var a_medium = alertObj.a_medium;
  var a_low = alertObj.a_low;
  var sum = a_high + a_medium + a_low;

  if (sum === 0) {
    return "#5cb85c";
  }

  var perc_high = a_high / sum;
  var perc_medium = a_medium / sum;
  var perc_low = a_low / sum;

  var maxPerc = Math.max(perc_high, perc_medium, perc_low);
  if (maxPerc === perc_high) {
    return "#Fe0000";
  } else if (maxPerc === perc_medium) {
    return "#f0ad4e";
  } else if (maxPerc === perc_low) {
    return "#5cb85c";
  }
  
  return "black";
}

function getAlertColor(type) {
  switch (type) {
    case "a_high":
      return "#F7676e";
    case "a_medium":
      return "yellow";
    case "a_low":
      return "lightgreen";
    case "a_info":
      return "lightblue";
    default:
      return "gray";
  }
}

async function savePosition() {
  $("#PopoverOption").hide();
  const new_center = map.getCenter();
  const new_zoom = map.getZoom();

  body = {
    user_id: user_id, 
    saved_position_lat: new_center.lat, 
    saved_position_lng: new_center.lng, 
    saved_zoom: new_zoom
  }

  try {
    await $.ajax({
      url: "/update_user_settings",
      type: "POST",
      data: body
    });

    centerCoordinates = [new_center.lat, new_center.lng];
    zoom = new_zoom;

    savedPosition = {
      center: {
          lat: new_center.lat,
          lng: new_center.lng
      },
      zoom: new_zoom
  }
  
    const modal = document.getElementById("savedModal");
    modal.classList.remove("hidden");
    modal.classList.add("show");
  
    setTimeout(() => {
      modal.classList.remove("show");
      modal.classList.add("hidden");
    }, 2000);

  } catch (error) {
    console.error("Error:", error);
  }
}

function returnToSaved() {
  $("#PopoverOption").hide();
  if (savedPosition && savedPosition.center && savedPosition.zoom) {
    console.log(savedPosition)
    const { lat, lng } = savedPosition.center;
    map.setView([lat, lng], savedPosition.zoom);

    const modal = document.getElementById("backModal");
    modal.classList.remove("hidden");
    modal.classList.add("show");

    setTimeout(() => {
      modal.classList.remove("show");
      modal.classList.add("hidden");
    }, 2000);
  } else {
    const modal = document.getElementById("noSavedModal");
    modal.classList.remove("hidden");
    modal.classList.add("show");

    setTimeout(() => {
      modal.classList.remove("show");
      modal.classList.add("hidden");
    }, 2000);
  }
}

function resetPosition() {
  $("#PopoverOption").hide();
  map.setView(initialCoordinates, initialZoom);

  const modal = document.getElementById("resetModal");
  modal.classList.remove("hidden");
  modal.classList.add("show");

  setTimeout(() => {
    modal.classList.remove("show");
    modal.classList.add("hidden");
  }, 2000);
}

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

function convertToISO(dateStr) {
  var dt = moment.utc(dateStr, "YYYY-MM-DD HH:mm:ssZ");
  return dt.format("YYYY-MM-DD HH:mm:ss.SSSSSS+00:00");
}

// Function used to obtain the Markers saved inside the DB
async function initMapContent() {
  try {
    const body = { user_id: user_id };

    const icons = await $.ajax({
      url: "/get_icons_by_user_id",
      type: "POST",
      data: body
    });
    db_icons = icons;
    const $dropdown_add = $('#icons-dropdown-add');
    const $dropdown_edit = $('#icons-dropdown-edit');
    db_icons.forEach(option => {
      $dropdown_add.append($('<option>', {
        value: option.class_name,
        text: option.class_name
      }));
      $dropdown_edit.append($('<option>', {
        value: option.class_name,
        text: option.class_name
      }));
    });

    const mapData = await $.ajax({
      url: "/get_map_data",
      type: "POST",
      data: body
    });
    alertLayer.destroyChildren();
    existingAlerts = [];
    const assetList = mapData.asset_position_list;
    dates = await getDates();

    assetList.forEach(markerObj => {
      DrawNewAlert(
        dates.start_date,
        dates.end_date,
        markerObj
      );
    });
  } catch (error) {
    console.error("Error:", error);
  }
}

// Function used to obtain the map settings saved by the user
async function initMapPosition() {
  mapPosition = {};
  body = {
    user_id: user_id
  }

  try { 
    const settings = await $.ajax({ url: "/get_user_settings",
      type: "POST",
      data: body
    });

    mapPosition = { center: { lat: settings[0].saved_position_lat, lng: settings[0].saved_position_lng }, zoom: settings[0].saved_zoom };

  } catch (error) {
    console.error("Error:", error);
  }

  return mapPosition
}

async function setUserId() {
  const data = await $.ajax({ url: "/get_user_id", type: "GET" });
  user_id = data.user_id;
}

// Function to add assets to the DB
async function submitAsset() {
  const body = { 
    asset_id: user_id,
    user_id: user_id,
    asset_name: $("#site-name-add").val(), 
    icon_type: $("#icons-dropdown-add").val(), 
    asset_ip: $("#ip-address-add").val(), 
    lat: $("#selected-lat-add").val(), 
    lng: $("#selected-lng-add").val()
  };

  try {
    // Adds the asset to the DB
    await $.ajax({
      url: "/insert_asset",
      type: "POST",
      data: body
    });

    // Reloads the map to show the modifications
    const data = await $.ajax({
      url: "/get_map_data",
      type: "POST",
      data: body
    });

    alertLayer.destroyChildren();
    existingAlerts = [];
    
    const assetList = data.asset_position_list;
    dates = await getDates();

    assetList.forEach(markerObj => {
      DrawNewAlert(
        dates.start_date,
        dates.end_date,
        markerObj
      );
    });

    $('#insert-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    $('#selected-lat-add').val("");
    $('#selected-lng-add').val("");
    $('#ip-address-add').val("");
    $('#site-name-add').val("");
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Function to edit existing assets
async function editAsset() {
  const body = { 
    asset_id: assetToEdit,
    user_id: user_id, 
    asset_name: $("#site-name-edit").val(), 
    icon_type: $("#icons-dropdown-edit").val(), 
    asset_ip: $("#ip-address-edit").val(), 
    lat: $("#selected-lat-edit").val(), 
    lng: $("#selected-lng-edit").val()
  };

  try {
    // Edits the asset in the DB
    await $.ajax({
      url: "/edit_asset",
      type: "POST",
      data: body
    });

    // Reloads the map to show the modifications
    const data = await $.ajax({
      url: "/get_map_data",
      type: "POST",
      data: body
    });

    map.eachLayer(function(layer) {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    alertLayer.destroyChildren();
    existingAlerts = [];
    
    const assetList = data.asset_position_list;
    dates = await getDates();

    assetList.forEach(markerObj => {
      DrawNewAlert(
        dates.start_date,
        dates.end_date,
        markerObj
      );
    });

    $('#edit-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    $('#selected-lat-edit').val("");
    $('#selected-lng-edit').val("");
    $('#ip-address-edit').val("");
    $('#site-name-edit').val("");
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Function to remove assets from the map
async function deleteAsset() {
  const body = { 
    asset_id: assetToEdit,
    user_id: user_id
  };

  try {
    // Deletes the asset from the DB
    await $.ajax({
      url: "/delete_asset",
      type: "POST",
      data: body
    });

    // Reloads the map to show the modifications
    const data = await $.ajax({
      url: "/get_map_data",
      type: "POST",
      data: body
    });

    map.eachLayer(function(layer) {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
    alertLayer.destroyChildren();
    existingAlerts = [];
    
    const assetList = data.asset_position_list;
    dates = await getDates();

    assetList.forEach(markerObj => {
      DrawNewAlert(
        dates.start_date,
        dates.end_date,
        markerObj
      );
    });

    $('#edit-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    $('#selected-lat-edit').val("");
    $('#selected-lng-edit').val("");
    $('#ip-address-edit').val("");
    $('#site-name-edit').val("");
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

// Function to add Icons the user's inventory
async function addNewMapIcon() {
  const body = { 
    user_id: user_id,
    class_name: $("#icon-name").val(), 
    html: addFillToSvg($("#svg-raw").val())
  };

  try {
    // Adds the icon to the database
    await $.ajax({
      url: "/add_icon",
      type: "POST",
      data: body,
    });

    // Refreshes the list of available icons
    const icons = await $.ajax({
      url: "/get_icons_by_user_id",
      type: "POST",
      data: body,
    });
    db_icons = icons;

    const $dropdown_add = $('#icons-dropdown-add');
    const $dropdown_edit = $('#icons-dropdown-edit');

    $dropdown_add.empty();
    $dropdown_edit.empty();

    icons.forEach(option => {
      $dropdown_add.append($('<option>', {
        value: option.class_name,
        text: option.class_name
      }));
      $dropdown_edit.append($('<option>', {
        value: option.class_name,
        text: option.class_name
      }));
    });

    $('#icon-modal').css('display', 'none');
    $('#modal-mask').css('display', 'none');
    $('#icon-name').val("");
    $('#svg-raw').val("");
  } catch (error) {
    console.error("Error:", error);
  }
}

function openIconModal() {
  $("#PopoverOption").hide();
  $("#icon-modal").css('display', 'flex');
  $('#modal-mask').css('display', 'flex');
}

function addFillToSvg(svgString, borderColor = "black", borderWidth = "0.5") {
  if(svgString == "") {
    return "";
  }
  var parser = new DOMParser();
  var svgDoc = parser.parseFromString(svgString, "image/svg+xml");
  
  var elements = svgDoc.querySelectorAll("path, rect, circle, ellipse, line, polyline, polygon");
  
  elements.forEach(function(el) {
    
    if (!el.hasAttribute("fill") || el.getAttribute("fill") === "none") {
      el.setAttribute("fill", "${fillColor}");
    }
    
    if (!el.hasAttribute("stroke")) {
      el.setAttribute("stroke", borderColor);
    }
    if (!el.hasAttribute("stroke-width")) {
      el.setAttribute("stroke-width", borderWidth);
    }
  });
  
  var svgModifiedString = new XMLSerializer().serializeToString(svgDoc.documentElement);
  console.log(svgModifiedString);
  return svgModifiedString;
}

async function navigato_to_table(ip) {
  console.log("Nav:", selectedAssetIP)
  if(selectedAssetIP) {
    const body = { 
      ip: ip
    };
  
    await $.ajax({
      url: "/navigato_to_table",
      type: "POST",
      data: body,
      contentType: "application/json"
    });
  }
}

async function get_time() {
  var time = await $.ajax({
    url: "/get_time",
    type: "GET"
  });

  return time;
}

function show_popover(node) {
  var popover = $("#PopoverOption .popover");

  $("#PopoverOption").css({ "visibility": "hidden", "display": "block" });

  var offset = node.offset();
  var top, left = offset.left - popover.width() / 2 + node.width() / 2;

  popover.find(".dropdown-submenu").removeClass("pull-left");
  popover.removeClass("bottom top left right menu-left");

  if ( left < 0 ) {
    /* Handle the case of a narrow column near the left side of the grid */
    popover.addClass("right");
    top = offset.top - popover.height() / 2 + node.height() / 2;
    left = offset.left + node.width();
  }
  else if ( left + popover.width() > window.innerWidth ) {
    /* Handle the case of a narrow column near the right side of the grid */
    popover.addClass("left");
    top = offset.top - popover.height() / 2 + node.height() / 2;
    left = offset.left - popover.width();
  }
  /* Otherwise, expand the menu upwards or downwards, and the submenu
  * leftwards or rightwards, according to where the most space is available */
  else if ( window.innerHeight - (offset.top + node.height()) > offset.top ) {
    popover.addClass("bottom");
    top = offset.top + node.height();
  }
  else {
    popover.addClass("top");
    top = offset.top - (node.height() / 2 + popover.height());
  }
  if ( window.innerWidth - (offset.left + node.width()) < offset.left ) {
    popover.addClass("menu-left");
    popover.find(".dropdown-submenu").addClass("pull-left");
  }

  $("#PopoverOption").css({ "top": top, "left": left, "visibility": "visible" });
}
