"use strict";

// Drone/target related-marker module: extraction from alerts, marker lifecycle, visibility, tooltips.

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
  },
  target: {
    iconType: "Taxi",
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
    case "target": {
      const base = RELATED_ICON_DEFAULTS.target;
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
  if (!map) return;
  const z = map.getZoom();
  mapEntities.forEach(entity => {
    applyRelatedVisibilityForEntity(entity, z);
  });
  applyIndependentTargetsVisibility(z);
}


function applyRelatedVisibilityForEntity(entity, z = null) {
  if (!entity || !map) return;
  const zoom = z == null ? map.getZoom() : z;
  const rels = entity.related_icons || [];

  rels.forEach(rel => {
    if (!rel?.marker) return;

    const cfg = getRelatedIconConfig(rel.relType);
    let isVisible = cfg && zoom >= cfg.minZoomVisible;

    if (rel.relType === "drone") {
      if (!allDronesVisible) {
        isVisible = false;
      } else if (!showHistory && !rel.isLatest) {
        isVisible = false;
      }
    }

    setLayerVisibility(rel.marker, isVisible);

    if (isVisible) {
      const baseOpacity = rel.baseOpacity ?? 1;
      if (rel._lastOpacity !== baseOpacity) {
        rel.marker.setOpacity(baseOpacity);
        rel._lastOpacity = baseOpacity;
      }
    }

    if (isVisible && rel.marker._icon) {
      const pointerEvents = isVisible ? "auto" : "none";
      if (rel.marker._icon.style.pointerEvents !== pointerEvents) {
        rel.marker._icon.style.pointerEvents = pointerEvents;
      }
    }
  });

  if (entity._droneLines) {
    Object.values(entity._droneLines).forEach(line => {
      const lineVisible = allDronesVisible && showHistory && zoom >= RELATED_ICON_DEFAULTS.drone.minZoomVisible;
      setLayerVisibility(line, lineVisible);

      if (lineVisible) {
        const nextOpacity = RELATED_ICON_DEFAULTS.drone.lineOptions.opacity;
        if (line._lastOpacity !== nextOpacity) {
          line.setStyle({ opacity: nextOpacity });
          line._lastOpacity = nextOpacity;
        }
      }
    });
  }
}


function syncRelatedIconsFromAlerts(entity, alertRows) {
  if (!entity) return;
  if (!entity._droneLines) entity._droneLines = {};

  const allDronesData = extractLatestDronesFromAlerts(alertRows);

  const currentDroneKeys = new Set(allDronesData.map(d => `${d.sourceId}_${d.timeMs}`));

  entity.related_icons = entity.related_icons.filter(rel => {
    if (rel.relType === "drone") {
      if (!currentDroneKeys.has(rel.relKey)) {
        if (rel.marker) map.removeLayer(rel.marker);
        return false;
      }
    }
    return true;
  });

  const dronePathsById = {};

  allDronesData.forEach(d => {
    upsertRelatedMarkerForEntity(entity, "drone", d.sourceId, d.lat, d.lng, d);

    if (!dronePathsById[d.sourceId]) dronePathsById[d.sourceId] = [];
    dronePathsById[d.sourceId].push([d.lat, d.lng]);
  });

  Object.keys(dronePathsById).forEach(sourceId => {
    const coordinates = dronePathsById[sourceId];
    if (coordinates.length >= 2) {
      const lineStyle = RELATED_ICON_DEFAULTS.drone.lineOptions;
      if (!entity._droneLines[sourceId]) {
        entity._droneLines[sourceId] = L.polyline(coordinates, lineStyle).addTo(map);
      } else {
        entity._droneLines[sourceId].setLatLngs(coordinates);
        entity._droneLines[sourceId].setStyle(lineStyle);
      }
    } else if (entity._droneLines[sourceId]) {
      map.removeLayer(entity._droneLines[sourceId]);
      delete entity._droneLines[sourceId];
    }
  });

  Object.keys(entity._droneLines).forEach(sourceId => {
    if (!dronePathsById[sourceId]) {
      map.removeLayer(entity._droneLines[sourceId]);
      delete entity._droneLines[sourceId];
    }
  });

  applyRelatedVisibilityForEntity(entity);
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
    return L.divIcon({
      className: `map-icon ${iconType}-fixed`,
      html: `<div class="icon-colour" style="color:${fillColor}; fill:${fillColor};">${found.html}</div>`,
      iconSize: [finalSize, finalSize],
      iconAnchor: [finalSize / 2, finalSize / 2],
    });
  }

  return L.divIcon({
    className: "map-icon fallback",
    html: `<div class="icon-colour icon-outlined" style="color:${fillColor}; fill:${fillColor};">${MISSING_ICON_HTML}</div>`,
    iconSize: [finalSize, finalSize],
    iconAnchor: [finalSize / 2, finalSize / 2],
  });
}


// Redraws the drone/target markers that use one of the given icons (overwritten or deleted).
function refreshRelatedMarkersUsingIcons(iconNames) {
  const relatedMarkers = mapEntities.flatMap(entity => entity.related_icons || []).concat(independentTargets);

  relatedMarkers.filter(rel => iconNames.includes(rel.iconType)).forEach(rel => {
    const cfg = getRelatedIconConfig(rel.relType);
    const color = rel.isLatest ? cfg.color : (cfg.historyColor || "#888888");
    rel.marker.setIcon(assignIconFixedColor(rel.iconType, cfg.size, color));
    rel.marker.setOpacity(rel.baseOpacity ?? 1);
    if (rel.marker.getElement()) rel.marker.getElement().style.opacity = rel.baseOpacity ?? 1;
  });
}


// Splits an alert's lists into one entry per Source/Target. With several elements the lists must be aligned
// by position (a missing GeoLocation is a null placeholder); elements without icon or position are dropped.
function getAlertElements(role, idsRaw, categoryRaw, geoRaw) {
  const ids = parseArrayish(idsRaw);
  const geoText = geoRaw == null ? geoRaw : String(geoRaw).replace(/\bNone\b/g, "null");

  if (!Array.isArray(ids) || ids.length <= 1) {
    const iconType = findBoundIconName(role, categoryRaw);
    const point = parseGeoPoint(geoText);
    const singleId = Array.isArray(ids) ? ids[0] : idsRaw;
    return iconType && point && singleId ? [{ id: String(singleId), iconType, point }] : [];
  }

  const categories = parseArrayish(categoryRaw);
  const geoPoints = parseArrayish(geoText);
  if (!Array.isArray(categories) || !Array.isArray(geoPoints) || categories.length !== ids.length || geoPoints.length !== ids.length) {
    console.warn("Alert with " + ids.length + " " + role + " elements ignored: ids, categories and positions are not aligned.");
    return [];
  }

  const elements = [];
  ids.forEach((elementId, index) => {
    const iconType = findBoundIconName(role, categories[index]);
    const point = geoPoints[index] == null ? null : parseLatLngString(geoPoints[index]);
    if (elementId && iconType && point) elements.push({ id: String(elementId), iconType, point, number: index + 1, count: ids.length });
  });
  return elements;
}


function extractLatestDronesFromAlerts(rows) {
  const dronesGrouped = {};

  (rows || []).forEach(r => {
    if (!r || r.length < 8) return;

    const startTime = r[4];
    const timeMs = parseTimeMs(startTime);
    if (timeMs == null) return;

    getAlertElements("source", r[5], r[6], r[7]).forEach(element => {
      if (!dronesGrouped[element.id]) dronesGrouped[element.id] = [];
      dronesGrouped[element.id].push({
        sourceId: element.id,
        lat: element.point.lat,
        lng: element.point.lng,
        timeMs,
        start_time: startTime,
        iconType: element.iconType,
        elementNumber: element.number,
        elementCount: element.count
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


function extractLatestTargetsFromAlerts(rows) {
  const targetsGrouped = {};

  (rows || []).forEach(r => {
    if (!r || r.length < 11) return;

    const startTime = r[4];
    const timeMs = parseTimeMs(startTime);
    if (timeMs == null) return;

    getAlertElements("target", r[8], r[9], r[10]).forEach(element => {
      if (!targetsGrouped[element.id]) targetsGrouped[element.id] = [];
      targetsGrouped[element.id].push({
        sourceId: element.id,
        lat: element.point.lat,
        lng: element.point.lng,
        timeMs,
        start_time: startTime,
        iconType: element.iconType,
        elementNumber: element.number,
        elementCount: element.count
      });
    });
  });

  const allTargets = [];
  Object.keys(targetsGrouped).forEach(vid => {
    let history = targetsGrouped[vid].sort((a, b) => a.timeMs - b.timeMs);

    const totalToKeep = past_positions_limit + 1;

    if (history.length > totalToKeep) {
      history = history.slice(-totalToKeep);
    }

    history.forEach((data, index) => {
      data.isLatest = (index === history.length - 1);
      allTargets.push(data);
    });
  });

  return allTargets;
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


function upsertRelatedMarkerForEntity(entity, relType, sourceId, lat, lng, data, options = {}) {
  if (!entity) return null;

  const relKey = `${sourceId}_${data.timeMs}`;
  const cfg = getRelatedIconConfig(relType, options);
  if (!cfg) return null;

  const existing = findRelatedByKey(entity, relType, relKey);
  const markerIconType = data.iconType || cfg.iconType;

  if (!existing) {
    const isLatest = data.isLatest;

    const finalOpacity = isLatest ? 1.0 : (cfg.historyOpacity || 0.2);
    const finalColor = isLatest ? cfg.color : (cfg.historyColor || "#888888");

    const icon = assignIconFixedColor(markerIconType, cfg.size, finalColor);

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

    const tooltipContent = relType === "target"
      ? getTargetTooltipContent(tooltipData)
      : getDroneTooltipContent(tooltipData);
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
      iconType: markerIconType,
      marker
    };

    entity.related_icons.push(rel);
    return rel;
  } else {
    const wasLatest = existing.isLatest;
    existing.isLatest = data.isLatest;

    // If the "latest" status changed, update the visual appearance of the marker.
    const iconChanged = existing.iconType !== markerIconType;
    existing.iconType = markerIconType;

    if (wasLatest !== data.isLatest || iconChanged) {
      const finalOpacity = data.isLatest ? 1.0 : (cfg.historyOpacity || 0.2);
      const finalColor = data.isLatest ? cfg.color : (cfg.historyColor || "#888888");

      existing.baseOpacity = finalOpacity;

      const newIcon = assignIconFixedColor(markerIconType, cfg.size, finalColor);
      existing.marker.setIcon(newIcon);
      existing.marker.setOpacity(finalOpacity);

      if (existing.marker.getElement()) {
        existing.marker.getElement().style.opacity = finalOpacity;
      }
    }
  }

  return existing;
}


function findIndependentTargetByKey(relKey) {
  const k = (relKey || "").toString();
  return independentTargets.find(r => (r?.relKey || "").toString() === k) || null;
}


function upsertIndependentTargetMarker(sourceId, lat, lng, data) {
  const relKey = `${sourceId}_${data.timeMs}`;
  const cfg = getRelatedIconConfig("target");
  if (!cfg) return null;

  const existing = findIndependentTargetByKey(relKey);
  const markerIconType = data.iconType || cfg.iconType;

  if (!existing) {
    const isLatest = data.isLatest;

    const finalOpacity = isLatest ? 1.0 : (cfg.historyOpacity || 0.2);
    const finalColor = isLatest ? cfg.color : (cfg.historyColor || "#888888");

    const icon = assignIconFixedColor(markerIconType, cfg.size, finalColor);

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

    const tooltipContent = getTargetTooltipContent({ ...data, lat, lng });
    marker.bindTooltip(tooltipContent, {
      direction: 'top',
      offset: [0, -10],
      className: 'drone-tooltip'
    });

    const rel = {
      relId: generateId(),
      relType: "target",
      relKey: relKey,
      lat, lng,
      timeMs: data.timeMs,
      baseOpacity: finalOpacity,
      isLatest: isLatest,
      iconType: markerIconType,
      marker
    };

    independentTargets.push(rel);
    return rel;
  } else {
    const wasLatest = existing.isLatest;
    existing.isLatest = data.isLatest;

    const iconChanged = existing.iconType !== markerIconType;
    existing.iconType = markerIconType;

    if (wasLatest !== data.isLatest || iconChanged) {
      const finalOpacity = data.isLatest ? 1.0 : (cfg.historyOpacity || 0.2);
      const finalColor = data.isLatest ? cfg.color : (cfg.historyColor || "#888888");

      existing.baseOpacity = finalOpacity;

      const newIcon = assignIconFixedColor(markerIconType, cfg.size, finalColor);
      existing.marker.setIcon(newIcon);
      existing.marker.setOpacity(finalOpacity);

      if (existing.marker.getElement()) {
        existing.marker.getElement().style.opacity = finalOpacity;
      }
    }
  }

  return existing;
}


function syncIndependentTargets(alertRows) {
  const allTargetsData = extractLatestTargetsFromAlerts(alertRows);

  const currentKeys = new Set(allTargetsData.map(d => `${d.sourceId}_${d.timeMs}`));

  independentTargets = independentTargets.filter(rel => {
    if (!currentKeys.has(rel.relKey)) {
      if (rel.marker) map.removeLayer(rel.marker);
      return false;
    }
    return true;
  });

  const targetPathsById = {};

  allTargetsData.forEach(d => {
    upsertIndependentTargetMarker(d.sourceId, d.lat, d.lng, d);

    if (!targetPathsById[d.sourceId]) targetPathsById[d.sourceId] = [];
    targetPathsById[d.sourceId].push([d.lat, d.lng]);
  });

  Object.keys(targetPathsById).forEach(sourceId => {
    const coordinates = targetPathsById[sourceId];
    if (coordinates.length >= 2) {
      const lineStyle = RELATED_ICON_DEFAULTS.target.lineOptions;
      if (!independentTargetLines[sourceId]) {
        independentTargetLines[sourceId] = L.polyline(coordinates, lineStyle).addTo(map);
      } else {
        independentTargetLines[sourceId].setLatLngs(coordinates);
        independentTargetLines[sourceId].setStyle(lineStyle);
      }
    } else if (independentTargetLines[sourceId]) {
      map.removeLayer(independentTargetLines[sourceId]);
      delete independentTargetLines[sourceId];
    }
  });

  Object.keys(independentTargetLines).forEach(sourceId => {
    if (!targetPathsById[sourceId]) {
      map.removeLayer(independentTargetLines[sourceId]);
      delete independentTargetLines[sourceId];
    }
  });

  applyIndependentTargetsVisibility();
}


function applyIndependentTargetsVisibility(z = null) {
  if (!map) return;
  const zoom = z == null ? map.getZoom() : z;
  const cfg = RELATED_ICON_DEFAULTS.target;

  independentTargets.forEach(rel => {
    if (!rel?.marker) return;

    let isVisible = zoom >= cfg.minZoomVisible;

    if (!allTargetsVisible) {
      isVisible = false;
    } else if (!showTargetHistory && !rel.isLatest) {
      isVisible = false;
    }

    setLayerVisibility(rel.marker, isVisible);

    if (isVisible) {
      const baseOpacity = rel.baseOpacity ?? 1;
      if (rel._lastOpacity !== baseOpacity) {
        rel.marker.setOpacity(baseOpacity);
        rel._lastOpacity = baseOpacity;
      }
    }

    if (isVisible && rel.marker._icon) {
      const pointerEvents = isVisible ? "auto" : "none";
      if (rel.marker._icon.style.pointerEvents !== pointerEvents) {
        rel.marker._icon.style.pointerEvents = pointerEvents;
      }
    }
  });

  Object.values(independentTargetLines).forEach(line => {
    const lineVisible = allTargetsVisible && showTargetHistory && zoom >= cfg.minZoomVisible;
    setLayerVisibility(line, lineVisible);

    if (lineVisible) {
      const nextOpacity = cfg.lineOptions.opacity;
      if (line._lastOpacity !== nextOpacity) {
        line.setStyle({ opacity: nextOpacity });
        line._lastOpacity = nextOpacity;
      }
    }
  });
}


function removeAllIndependentTargets() {
  independentTargets.forEach(rel => {
    if (rel?.marker) map.removeLayer(rel.marker);
  });
  independentTargets = [];

  Object.values(independentTargetLines).forEach(line => {
    map.removeLayer(line);
  });
  independentTargetLines = {};
}


// Only alerts with several Sources/Targets show which one of them the marker is.
function getElementNumberLine(data) {
  return data.elementCount > 1 ? `<b>Position in alert:</b> ${data.elementNumber} of ${data.elementCount}<br/>` : "";
}


function getDroneTooltipContent(data) {
  if (!data) return "";

  return `
        <div class="drone-tooltip" style="text-align:left;">
            <b>Source ID:</b> ${data.sourceId || "Unknown"}<br/>
            ${getElementNumberLine(data)}
            <b>Time:</b> ${data.start_time || "N/A"}<br/>
            <b>Location:</b> ${data.lat?.toFixed(5)}, ${data.lng?.toFixed(5)}<br/>
            <b>Distance:</b> ${data.distance || "N/A"}<br/>
        </div>
    `;
}


function getTargetTooltipContent(data) {
  if (!data) return "";

  const distanceLine = data.distance ? `<b>Distance:</b> ${data.distance}<br/>` : "";

  return `
        <div class="drone-tooltip" style="text-align:left;">
            <b>Target ID:</b> ${data.sourceId || "Unknown"}<br/>
            ${getElementNumberLine(data)}
            <b>Time:</b> ${data.start_time || "N/A"}<br/>
            <b>Location:</b> ${data.lat?.toFixed(5)}, ${data.lng?.toFixed(5)}<br/>
            ${distanceLine}
        </div>
    `;
}


