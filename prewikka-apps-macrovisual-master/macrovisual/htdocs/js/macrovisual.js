var errorMessage = document.getElementById("error-message");
var currentMarker = undefined;
var hideConnections = false;
var mapMarkers = [];
var existingConnections = [];
var editMode = false;
var deleteMode = false;
var layer = new Konva.Layer();
var stage = new Konva.Stage({
    container: 'canvas-container',
    width: document.getElementById('map').clientWidth,
    height: document.getElementById('map').clientHeight
});
var map = L.map('map').setView([41.9028, 12.4964], 5);

function initMap() {
    // Controlla se esiste già un'istanza di `map` e `stage`
    if (map && map.remove) {
        map.remove(); // Rimuove la mappa esistente
    }
    
    if (stage) {
        stage.destroy(); // Distrugge l'istanza di Konva.Stage esistente
    }

    errorMessage = document.getElementById("error-message");
    currentMarker = undefined;
    hideConnections = false;
    mapMarkers = [];
    existingConnections = [];
    editMode = false;
    deleteMode = false;


    const mapContainer = document.getElementById('map');
    mapContainer.innerHTML = '';

    map = L.map('map').setView([41.9028, 12.4964], 5);
    document.getElementById("initDiv").style.display = "none";

    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
        noWrap: true
    }).addTo(map);


    stage = new Konva.Stage({
        container: 'canvas-container',
        width: mapContainer.clientWidth,
        height: mapContainer.clientHeight
    });

    
    stage.add(layer);

    
    map.on('movestart', function () {
        layer.hide();
        layer.draw();
    });

    map.on('moveend', function () {
        layer.show();
        drawLines();
    });

    window.addEventListener('resize', function () {
        
        stage.width(mapContainer.clientWidth);
        stage.height(mapContainer.clientHeight);
        drawLines();
    });

    map.on('click', function(e) {
        openPopup(e.latlng.lat, e.latlng.lng, "new", undefined);
    });

    document.getElementById('edit-mode').addEventListener('click', function () {
        editMode = true;
        document.getElementById('canvas-container').style.pointerEvents = 'auto';
        document.getElementById('edit-mode').style.display = 'none';
        document.getElementById('save-mode').style.display = 'inline';
        document.getElementById('edit-controls').style.display = 'inline';
        drawLines();
    });
    
    document.getElementById('delete-line-button').addEventListener('click', function () {
        deleteMode = !deleteMode;
        const deleteButton = document.getElementById("delete-line-button");
        const svgPath = deleteButton.querySelector("svg path");
    
        svgPath.setAttribute("fill", deleteMode ? "red" : "black");
        drawLines();
    });
    
    document.getElementById('save-mode').addEventListener('click', function () {
        editMode = false;
        deleteMode = false;
        const deleteButton = document.getElementById("delete-line-button");
        const svgPath = deleteButton.querySelector("svg path");
        svgPath.setAttribute("fill", deleteMode ? "red" : "black");
        document.getElementById('canvas-container').style.pointerEvents = 'none';
        document.getElementById('edit-mode').style.display = 'inline';
        document.getElementById('save-mode').style.display = 'none';
        document.getElementById('edit-controls').style.display = 'none';
        drawLines();
    });
    
    document.getElementById('export-button').addEventListener('click', function () {
        var center = map.getCenter();
        var zoom = map.getZoom();
        const exportData = {
            konvaLayer: JSON.parse(layer.toJSON()).children,
            mapMarkers: mapMarkers.map(marker => ({
                name: marker.name,
                iconType: marker.iconType,
                lat: marker.lat,
                lng: marker.lng
            })),
            existingConnections: existingConnections.map(connection => ({
                start: connection.start,
                end: connection.end
            })),
            startingCoordinates: [center.lat, center.lng],
            startingZoom: zoom
        };
    
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'export-data.json';

        a.target = '_blank';
        
        document.body.appendChild(a);
        a.click();
    
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    document.getElementById('import-button').addEventListener('click', function() {
        document.getElementById('file-input').click();
    });
    
    document.getElementById("file-input").addEventListener('change', function(event) {
        const file = event.target.files[0];
        let startPos = document.getElementById("start-position").value;
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const jsonContent = JSON.parse(e.target.result);
                
                layer.removeChildren();
                existingConnections = []; // Reset existingConnections before importing new data
    
                if (jsonContent.existingConnections && jsonContent.mapMarkers) {
                    jsonContent.existingConnections.forEach(function (connection) {
                        // Add connection to existingConnections to persist them
                        existingConnections.push({
                            start: connection.start,
                            end: connection.end
                        });
    
                        const startPoint = map.latLngToContainerPoint(L.latLng(connection.start[0], connection.start[1]));
                        const endPoint = map.latLngToContainerPoint(L.latLng(connection.end[0], connection.end[1]));
            
                        const line = new Konva.Line({
                            points: [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
                            stroke: 'gray',
                            strokeWidth: 5,
                            lineCap: 'round',
                            lineJoin: 'round'
                        });
    
                        layer.add(line);
                    });
    
                    jsonContent.mapMarkers.forEach(marker => {
                        let latLng = [marker.lat, marker.lng];
                        let newMarker = L.marker(latLng, { draggable: true, icon: L.divIcon(marker.iconType.options)}).addTo(map);
                        let positionName = marker.name;
    
                        mapMarkers.push({
                            name: marker.name,
                            iconType: L.divIcon(marker.iconType.options),
                            lat: marker.lat,
                            lng: marker.lng,
                            marker: newMarker
                        })
    
                        attachMarkerClickEvent(newMarker, positionName);
    
                        newMarker.on('dragend', function () {
                            const newLatLng = newMarker.getLatLng();
                            const updatedMarker = mapMarkers.find(m => m.marker === newMarker);
                            if (updatedMarker) {
                                updatedMarker.lat = newLatLng.lat;
                                updatedMarker.lng = newLatLng.lng;
                            }
                            drawLines();
                        });
                    
                        if(startPos != "none") {
                            var selectedStart = startFrom(startPos);
                            existingConnections.push({ start: selectedStart, end: newLatLng });
                        }
                    })
    
                    map.setView(jsonContent.startingCoordinates, jsonContent.startingZoom);
    
                    populateSelect();
                    layer.draw();
                    
                } else {
                    console.error("Errore durante la creazione delle connessioni");
                }
            };
            reader.readAsText(file);
    
            event.target.value = '';
        }
    });
    
    document.getElementById("show-mode").addEventListener('click', function () {
        document.getElementById("show-mode").style.display = "none";
        document.getElementById("hide-mode").style.display = "block";
        hideConnections = true;
        layer.hide();
        layer.draw();
    });
    
    document.getElementById("hide-mode").addEventListener('click', function () {
        document.getElementById("hide-mode").style.display = "none";
        document.getElementById("show-mode").style.display = "block";
        hideConnections = false;
        layer.show();
        drawLines();
    });
    
    document.getElementById("delete-marker").addEventListener('click', function () {
        const index = mapMarkers.findIndex(marker => marker.name === currentMarker.name);
        if (index !== -1) {
            mapMarkers.splice(index, 1);
        }
        currentMarker.marker.remove();
        closePopup();
        populateSelect();
    });
    
    document.getElementById("modify-marker").addEventListener('click', function () {
        document.getElementById("modify-marker").style.display = "none";
        document.getElementById("save-marker").style.display = "block";
        document.getElementById("details-name").readOnly = false;
    });
    
    document.getElementById("save-marker").addEventListener('click', function () {
        document.getElementById("modify-marker").style.display = "block";
        document.getElementById("save-marker").style.display = "none";
        document.getElementById("details-name").readOnly = true;
    
        let element = mapMarkers.find(marker => marker.name === currentMarker.name);
    
        const newName = document.getElementById("details-name").value;
        element.name = newName;
    
        element.marker.off('click'); 
        attachMarkerClickEvent(element.marker, newName);
        populateSelect();
    });
    
    document.getElementById('add-line-button').addEventListener('click', function () {
        document.getElementById("connection-popup").style.display = "block";
        document.getElementById("popup-mask").style.display = "block";
    });
    drawLines();
}


// This only exists to test changing the icons's color
function getRandomColor() {
    const randomNum = Math.floor(Math.random() * 3);
    switch (randomNum) {
        case 0:
            return '#5cb85c';
        case 1:
            return '#f0ad4e';
        case 2:
            return '#d9534f';
        default:
            return 'black';
    }
}

function showPopUp() {
    let error = document.getElementById("errorPopup");
    error.classList.add('pop-up-visible');
    error.classList.remove('pop-up-hidden');
}

function hidePopUp() {
    let error = document.getElementById("errorPopup");
    error.classList.remove('pop-up-visible');
    error.classList.add('pop-up-hidden');
}

function attachMarkerClickEvent(marker, positionName) {
    marker.on('click', function() {
        openPopup(0, 0, "details", positionName);
    });
}

function DrawNewConnection() {    

    let startPos = document.getElementById("connection-select-from").value;
    let endPos = document.getElementById("connection-select-to").value;
    if((startPos != "none" && endPos != "none") && (startPos != endPos)){

        startPosCoordinates = mapMarkers.find(marker => marker.name == startPos);
        endPosCoordinates = mapMarkers.find(marker => marker.name == endPos);

        var connectionExists = existingConnections.some(function(connection) {
            var directMatch = connection.start[0] === startPosCoordinates.lat && connection.start[1] === startPosCoordinates.lng &&
                            connection.end[0] === endPosCoordinates.lat && connection.end[1] === endPosCoordinates.lng;
        
            var reverseMatch = connection.start[0] === endPosCoordinates.lat && connection.start[1] === endPosCoordinates.lng &&
                            connection.end[0] === startPosCoordinates.lat && connection.end[1] === startPosCoordinates.lng;
        
            return directMatch || reverseMatch;
        });
    
        if (connectionExists) {
            console.log("connection")
            errorMessage.textContent = "The connection already exists.";
            showPopUp();
            setTimeout(hidePopUp, 3000);
        } else {
            existingConnections.push({ start: [startPosCoordinates.lat, startPosCoordinates.lng], end: [endPosCoordinates.lat, endPosCoordinates.lng] });
            document.getElementById("connection-select-from").value = "none";
            document.getElementById("connection-select-to").value = "none";
            drawLines();
            closePopup();
        }
    } else {
        console.log("options")
        errorMessage.textContent = "Select two different options or click 'Cancel'.";
        showPopUp();
        setTimeout(hidePopUp, 3000);
    }
}

function openPopup(lat, lng, modalType, markerName) {

    if(modalType == "new") {
        document.getElementById("placement-popup").style.display = "block";
        document.getElementById("popup-lat").value = lat;
        document.getElementById("popup-lng").value = lng;
        document.getElementById("placement-popup").dataset.lat = lat;
        document.getElementById("placement-popup").dataset.lng = lng;
    } else if(modalType == "details") {
        document.getElementById("details-popup").style.display = "block";
        document.getElementById("details-name").value = markerName;
        currentMarker = mapMarkers.find(marker => marker.name == markerName);
    }
    document.getElementById("popup-mask").style.display = "block";
}

function drawLines() {
    layer.destroyChildren();

    if (!hideConnections) {
        existingConnections.forEach(function (connection) {
            var startPoint = map.latLngToContainerPoint(connection.start);
            var endPoint = map.latLngToContainerPoint(connection.end);

            var line = new Konva.Line({
                points: [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
                stroke: 'gray',
                strokeWidth: 5,
                lineCap: 'round',
                lineJoin: 'round'
            });
            layer.add(line);

            if (editMode) {
                var startHandle = new Konva.Circle({
                    x: startPoint.x,
                    y: startPoint.y,
                    radius: 6,
                    fill: 'blue',
                    draggable: !deleteMode 
                });

                var endHandle = new Konva.Circle({
                    x: endPoint.x,
                    y: endPoint.y,
                    radius: 6,
                    fill: 'blue',
                    draggable: !deleteMode 
                });

                function updateCenterPosition() {
                    var centerX = (startHandle.x() + endHandle.x()) / 2;
                    var centerY = (startHandle.y() + endHandle.y()) / 2;
                    centerHandle.position({ x: centerX, y: centerY });
                }

                var centerHandle = new Konva.Circle({
                    x: (startHandle.x() + endHandle.x()) / 2,
                    y: (startHandle.y() + endHandle.y()) / 2,
                    radius: 6,
                    fill: 'purple',
                    draggable: !deleteMode 
                });

                centerHandle.off('click');
                centerHandle.on('click', function () {
                    if (deleteMode) {
                        existingConnections = existingConnections.filter(function(conn) {
                            return !(conn.start[0] === connection.start[0] && conn.start[1] === connection.start[1] &&
                                    conn.end[0] === connection.end[0] && conn.end[1] === connection.end[1]);
                        });

                        drawLines();
                    }
                });

                // Aggiungi sempre il cursore grab per centerHandle
                centerHandle.on('mouseenter', function () {
                    stage.container().style.cursor = deleteMode ? 'pointer' : 'grab';
                });
                centerHandle.on('mouseleave', function () {
                    stage.container().style.cursor = 'default';
                });

                if (!deleteMode) {
                    startHandle.on('mouseenter', function () {
                        stage.container().style.cursor = 'grab';
                    });
                    startHandle.on('mouseleave', function () {
                        stage.container().style.cursor = 'default';
                    });
                    endHandle.on('mouseenter', function () {
                        stage.container().style.cursor = 'grab';
                    });
                    endHandle.on('mouseleave', function () {
                        stage.container().style.cursor = 'default';
                    });
                }

                if (!deleteMode) {
                    centerHandle.on('dragmove', function () {
                        var dx = centerHandle.x() - (startHandle.x() + endHandle.x()) / 2;
                        var dy = centerHandle.y() - (startHandle.y() + endHandle.y()) / 2;

                        startHandle.x(startHandle.x() + dx);
                        startHandle.y(startHandle.y() + dy);
                        endHandle.x(endHandle.x() + dx);
                        endHandle.y(endHandle.y() + dy);

                        line.points([startHandle.x(), startHandle.y(), endHandle.x(), endHandle.y()]);
                        layer.draw();
                    });

                    centerHandle.on('dragend', function () {
                        var newStart = map.containerPointToLatLng({ x: startHandle.x(), y: startHandle.y() });
                        var newEnd = map.containerPointToLatLng({ x: endHandle.x(), y: endHandle.y() });

                        connection.start = [newStart.lat, newStart.lng];
                        connection.end = [newEnd.lat, newEnd.lng];

                        updateCenterPosition(); 
                    });

                    startHandle.on('dragmove', function () {
                        var newStart = map.containerPointToLatLng({ x: startHandle.x(), y: startHandle.y() });
                        connection.start = [newStart.lat, newStart.lng];
                        line.points([startHandle.x(), startHandle.y(), endHandle.x(), endHandle.y()]);

                        updateCenterPosition();
                        layer.draw();
                    });

                    endHandle.on('dragmove', function () {
                        var newEnd = map.containerPointToLatLng({ x: endHandle.x(), y: endHandle.y() });
                        connection.end = [newEnd.lat, newEnd.lng];
                        line.points([startHandle.x(), startHandle.y(), endHandle.x(), endHandle.y()]);

                        updateCenterPosition();
                        layer.draw();
                    });
                }

                if (!deleteMode) {
                    layer.add(startHandle);
                    layer.add(endHandle);
                }
                layer.add(centerHandle);
            }
        });

        layer.draw();
    }
}

function closePopup() {
    document.getElementById("placement-popup").style.display = "none";
    document.getElementById("details-popup").style.display = "none";
    document.getElementById("popup-mask").style.display = "none";
    document.getElementById("popup-name").value = "";
    document.getElementById("connection-select-from").value = "none";
    document.getElementById("connection-select-to").value = "none";
    document.getElementById("connection-popup").style.display = "none";
}

function placeMarker() {
    let targetLat = parseFloat(document.getElementById("popup-lat").value);
    let targetLng = parseFloat(document.getElementById("popup-lng").value);
    let newLatLng = [targetLat, targetLng];
    let icon = document.getElementById("popup-icon-type").value;
    let positionName = document.getElementById("popup-name").value;
    let startPos = document.getElementById("start-position").value;

    if(nameCheck(positionName)) {
        var marker = L.marker(newLatLng, { draggable: true, icon: addIcon(icon) }).addTo(map);
    
        mapMarkers.push({
            name: positionName,
            iconType: addIcon(icon),
            lat: targetLat,
            lng: targetLng,
            marker: marker
        })

        attachMarkerClickEvent(marker, positionName);

        marker.on('dragend', function () {
            const newLatLng = marker.getLatLng();
            const updatedMarker = mapMarkers.find(m => m.marker === marker);
            if (updatedMarker) {
                updatedMarker.lat = newLatLng.lat;
                updatedMarker.lng = newLatLng.lng;
            }
            drawLines();
        });
    
        if(startPos != "none") {
            var selectedStart = startFrom(startPos);
            existingConnections.push({ start: selectedStart, end: newLatLng });
        }
    
        populateSelect();
        drawLines();
    
        closePopup();
    } else {
        showPopUp(); 
        setTimeout(hidePopUp, 3000);
    }
}

function addIcon(icon) {
    const fillColor = getRandomColor();

    switch(icon) {
        case 'building':
            return L.divIcon({
                className: 'building',
                html: `<svg width="24" height="24"  stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd"  clip-rule="evenodd"><path fill="${fillColor}" d="M13 2h2v2h1v19h1v-15l6 3v12h1v1h-24v-1h1v-11h7v11h1v-19h1v-2h2v-2h1v2zm8 21v-2h-2v2h2zm-15 0v-2h-3v2h3zm8 0v-2h-3v2h3zm-2-4v-13h-1v13h1zm9 0v-1h-2v1h2zm-18 0v-2h-1v2h1zm4 0v-2h-1v2h1zm-2 0v-2h-1v2h1zm9 0v-13h-1v13h1zm7-2v-1h-2v1h2zm0-2.139v-1h-2v1h2z"/></svg>`,
                iconSize: [32, 32],
                iconAnchor: [12, 24],
            });
        case 'nuclearPlant':
            return L.divIcon({
                className: 'nuclear-plant',
                html: `<svg width="24" height="24"  stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd"><path fill="${fillColor}" d="M24 24h-24v-2h1c2.996-4.904 3.945-12.985 4-16h7c.054 2.94 1.005 10.982 4 16h1.742l-.642-1.093c-1.195-2.145-1.948-4.546-2.501-6.924.268-1.659.385-3.106.401-3.983h5c.04 2.205.753 8.236 3 12h1v2zm-18.287-6h2l-1.167 3 4.167-5h-2l1.167-3-4.167 5zm12.924-12.915c.238-.522.759-.885 1.363-.885s1.125.363 1.363.885c.154-.08.328-.125.512-.125.621 0 1.125.511 1.125 1.14 0 .629-.504 1.14-1.125 1.14-.184 0-.358-.045-.512-.125-.238.522-.759.885-1.363.885s-1.125-.363-1.363-.885c-.154.08-.328.125-.512.125-.621 0-1.125-.511-1.125-1.14 0-.629.504-1.14 1.125-1.14.184 0 .358.045.512.125zm-10.637-.085c.198-2.182 1.785-4 3.5-4 .246 0 .478.059.683.164.316-.687 1.011-1.164 1.817-1.164s1.501.477 1.817 1.164c.205-.105.437-.164.683-.164.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5c-.246 0-.478-.059-.683-.164-.316.687-1.011 1.164-1.817 1.164-2.345 0-3.722-2.951-5 0h-1z"/></svg>`,
                iconSize: [32, 32],
                iconAnchor: [12, 24],
            });
        case 'factory':
            return L.divIcon({
                className: 'factory',
                html: `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="${fillColor}" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 240.000000 240.000000"><g transform="translate(0.000000,240.000000) scale(0.100000,-0.100000)" fill="${fillColor}" stroke="black" stroke-width="50"><path fill="${fillColor}" d="M732 2389 c-18 -6 -51 -28 -74 -51 -41 -41 -43 -42 -112 -43 -53 -1 -82 -7 -114 -23 -113 -60 -204 -192 -227 -329 l-7 -43 51 0 c49 0 51 1 70 39 28 54 75 91 117 91 21 0 69 -18 130 -50 159 -83 241 -98 321 -59 24 12 55 36 69 54 24 32 28 34 73 28 120 -14 207 104 156 211 -27 57 -69 81 -140 81 -58 1 -63 3 -102 42 -58 58 -129 75 -211 52z"/><path d="M0 900 l0 -900 1200 0 1200 0 0 750 0 751 -337 -282 c-186 -155 -348 -291 -359 -301 -21 -19 -22 -19 -53 21 l-31 39 89 74 90 73 0 188 1 188 -357 -299 c-270 -226 -361 -297 -371 -289 -7 6 -22 22 -32 37 l-20 28 90 77 90 76 0 185 0 184 -350 -300 -350 -300 0 450 0 450 -250 0 -250 0 0 -900z m600 -450 l0 -150 -100 0 -100 0 0 150 0 150 100 0 100 0 0 -150z m500 0 l0 -150 -100 0 -100 0 0 150 0 150 100 0 100 0 0 -150z m500 0 l0 -150 -100 0 -100 0 0 150 0 150 100 0 100 0 0 -150z m500 0 l0 -150 -100 0 -100 0 0 150 0 150 100 0 100 0 0 -150z" /></g></svg>`,
                IconSize: [32, 32],
                iconAnchor: [12, 24],
            });
        case 'airport':
            return L.divIcon({
                className: 'airport',
                html: `<svg width="24" height="24" stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd"><path fill="${fillColor}" d="M22 1h-2v1h4v5l-2 2v13h2v2h-24v-2h2v-9h12v-4l-2-2v-5h4v-1h-2v-1h8v1zm-13 18h-3v4h3v-4zm5 0h-4v4h4v-4zm4 0h-3v4h3v-4zm-2-15h-2v2l1 1h1v-3zm3 0h-2v3h2v-3zm3 0h-2v3h1l1-1v-2z"/></svg>`,
                iconSize: [32, 32],
                iconAnchor: [12, 24],
            });
        case 'hospital':
            return L.divIcon({
                className: 'hospital',
                html: `<svg width="24" height="24" stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd"><path fill="${fillColor}" d="M24 24h-24v-2h1v-13c1.793-1.211 3.484-2.153 5.116-2.826.534 2.743 2.997 4.864 5.961 4.826 2.914-.037 5.314-2.167 5.814-4.855 1.636.675 3.324 1.627 5.109 2.855v13h1v2zm-14-1h4v-4h-4v4zm-5 0h4v-4h-4v4zm10 0h4v-4h-4v4zm-10-6h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm-12-3h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm-5-14c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5m1 2h-2v2h-2v2h2v2h2v-2h2v-2h-2v-2z"/></svg>`,
                iconSize: [32, 32],
                iconAnchor: [12, 24],
            });
        default:
            return null;
    }
}

function startFrom(startPos) {
    let start = mapMarkers.find(marker => marker.name == startPos);
    if(start) {
        return [start.lat, start.lng];
    }
}

function populateSelect() {
    let selectElement_new_marker = document.getElementById("start-position");
    let selectElement_from = document.getElementById("connection-select-from");
    let selectElement_to = document.getElementById("connection-select-to");

    selectElement_new_marker.innerHTML = '<option value="none">Unlinked</option>';
    selectElement_from.innerHTML = '<option value="none">-- Pick One --</option>';
    selectElement_to.innerHTML = '<option value="none">-- Pick One --</option>';
    mapMarkers.forEach(marker => {
        let option_new_marker = document.createElement("option");
        option_new_marker.value = marker.name;
        option_new_marker.textContent = marker.name;
        let option_from = document.createElement("option");
        option_from.value = marker.name;
        option_from.textContent = marker.name;
        let option_to = document.createElement("option");
        option_to.value = marker.name;
        option_to.textContent = marker.name;
        selectElement_new_marker.appendChild(option_new_marker);
        selectElement_from.appendChild(option_from);
        selectElement_to.appendChild(option_to);
    })
}

function nameCheck(nameToCheck) {
    if(nameToCheck == undefined || nameToCheck == "") {
        console.log("no name")
        errorMessage.textContent = "The name field is mandatory.";
        showPopUp(); // Mostra il pop-up
        setTimeout(hidePopUp, 3000); // Nascondi il pop-up dopo 3 secondi
        return false;
    }

    let name = mapMarkers.find(marker => marker.name == nameToCheck);
    if(name) {
        console.log("2 names")
        errorMessage.textContent = "This name is already in use.";    
        return false;
    } else {
        return true;
    }
}

function updateCoordinates() {
    startLatLng = startMarker.getLatLng();
    endLatLng = endMarker.getLatLng();
    existingConnections[0].start = startLatLng;
    existingConnections[0].end = endLatLng;
    drawLines();
}