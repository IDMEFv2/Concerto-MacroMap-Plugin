// Imposta le coordinate e lo zoom iniziali
var initialCoordinates = [47, 10];
var initialZoom = 5;

// Variabile per la mappa
var map;

// Funzione per inizializzare la mappa
function initializeMap() {
  // Leggi la posizione salvata dal localStorage
  const savedPosition = JSON.parse(localStorage.getItem("savedMapPosition"));

  // Se ci sono dati salvati, usa quelli, altrimenti usa i valori di default
  const centerCoordinates = savedPosition
    ? savedPosition.center
    : initialCoordinates;
  const zoom = savedPosition ? savedPosition.zoom : initialZoom;

  // Inizializza la mappa
  map = L.map("map", {
    center: centerCoordinates, // Usa la posizione salvata (o quella di default)
    zoom: zoom, // Usa il livello di zoom salvato (o quello di default)
    minZoom: 2.9,
  });

  // Aggiungi il tile layer alla mappa
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(map);

  // Definisci i confini originali
  var bounds = new L.LatLngBounds(
    [30, -20], // Sud-Ovest
    [65, 50] // Nord-Est
  );

  // Calcola il centro e l'estensione attuale
  var boundsCenter = bounds.getCenter(); // Evita conflitti con la variabile 'center'
  var sw = bounds.getSouthWest();
  var ne = bounds.getNorthEast();

  // Calcola la nuova estensione raddoppiando la distanza dal centro
  var newSw = [
    boundsCenter.lat - (boundsCenter.lat - sw.lat) * 6,
    boundsCenter.lng - (boundsCenter.lng - sw.lng) * 6,
  ];
  var newNe = [
    boundsCenter.lat + (ne.lat - boundsCenter.lat) * 6,
    boundsCenter.lng + (ne.lng - boundsCenter.lng) * 6,
  ];

  // Definisci i nuovi confini raddoppiati
  var expandedBounds = new L.LatLngBounds(newSw, newNe);

  // Imposta i limiti senza influire sulla vista
  map.setMaxBounds(expandedBounds);

  // Opzionale: Garantisci che la mappa non vada fuori dai limiti durante il drag
  map.on("drag", function () {
    map.panInsideBounds(expandedBounds, { animate: false });
  });

  // Chiama la funzione al caricamento della pagina
//   document.addEventListener("DOMContentLoaded", loadInventory);

  var widthlayer = document.getElementById("map").clientWidth;
  var heightlayer = document.getElementById("map").clientHeight;
  var fontsize = 11.5;
  var alertLayer = new Konva.Layer();
  var stageAlert = new Konva.Stage({
    container: "canvas-container2",
    width: widthlayer,
    height: heightlayer,
  });
  stageAlert.add(alertLayer);

  var existingAlerts = [];

  map.on("movestart", function () {
    alertLayer.hide();
    alertLayer.draw();
  });

  map.on("moveend", function () {
    alertLayer.show();
    drawAlerts();
  });

  json_data = [];
  $.ajax({
    url: "/get_db",
    type: "GET",
    success: function (data) {
      // let x = JSON.stringify(data);
      json_data = data;
      const assetList = json_data.inventory[0].asset_position_list; // Prendiamo la lista dei marker

      assetList.forEach((markerObj) => {
        let icon = addIcon(markerObj.iconType, markerObj.id); // Usa il valore del JSON
        let marker = L.marker([markerObj.lat, markerObj.lng], {
          icon: icon,
        }).addTo(map);

        // Aggiungiamo il marker alla lista locale
        markerObj.marker = marker;

        // Se serve, aggiungiamo un alert
        DrawNewAlert(markerObj.lat, markerObj.lng, markerObj.id, markerObj.name, markerObj.ip);
        startRefreshing();
      });
    },
    error: function (error) {
      console.log(`Error ${error}`);
    },
  });

  function startRefreshing() {
    let first = true;

    setInterval(function() {
        if(!first) {
            $.ajax({
                url: "/get_db",
                type: "GET",
                success: function (data) {
                    
                  json_data = data;
                  const assetList = json_data.inventory[0].asset_position_list;
            
                  assetList.forEach((markerObj) => {
                    let icon = addIcon(markerObj.iconType, markerObj.id);
                    let marker = L.marker([markerObj.lat, markerObj.lng], {
                      icon: icon,
                    }).addTo(map);
                    markerObj.marker = marker;
                    existingAlerts = []
                    DrawNewAlert(markerObj.lat, markerObj.lng, markerObj.id, markerObj.name, markerObj.ip);
                  });
                },
                error: function (error) {
                  console.log(`Error ${error}`);
                },
            });
        }

        if(first) {
            first = false;
        }
    }, 10000);
  }

  function addIcon(icon, id) {
    // const fillColor = getColor(id);
    const fillColor = "green";
    switch (icon) {
      case "building":
        return L.divIcon({
          className: "building",
          html: `<svg width="24" height="24"  stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd"  clip-rule="evenodd"><path fill="${fillColor}" d="M13 2h2v2h1v19h1v-15l6 3v12h1v1h-24v-1h1v-11h7v11h1v-19h1v-2h2v-2h1v2zm8 21v-2h-2v2h2zm-15 0v-2h-3v2h3zm8 0v-2h-3v2h3zm-2-4v-13h-1v13h1zm9 0v-1h-2v1h2zm-18 0v-2h-1v2h1zm4 0v-2h-1v2h1zm-2 0v-2h-1v2h1zm9 0v-13h-1v13h1zm7-2v-1h-2v1h2zm0-2.139v-1h-2v1h2z"/></svg>`,
          iconSize: [32, 32],
          iconAnchor: [12, 24],
        });
      case "nuclearPlant":
        return L.divIcon({
          className: "nuclear-plant",
          html: `<svg width="24" height="24"  stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd"><path fill="${fillColor}" d="M24 24h-24v-2h1c2.996-4.904 3.945-12.985 4-16h7c.054 2.94 1.005 10.982 4 16h1.742l-.642-1.093c-1.195-2.145-1.948-4.546-2.501-6.924.268-1.659.385-3.106.401-3.983h5c.04 2.205.753 8.236 3 12h1v2zm-18.287-6h2l-1.167 3 4.167-5h-2l1.167-3-4.167 5zm12.924-12.915c.238-.522.759-.885 1.363-.885s1.125.363 1.363.885c.154-.08.328-.125.512-.125.621 0 1.125.511 1.125 1.14 0 .629-.504 1.14-1.125 1.14-.184 0-.358-.045-.512-.125-.238.522-.759.885-1.363.885s-1.125-.363-1.363-.885c-.154.08-.328.125-.512.125-.621 0-1.125-.511-1.125-1.14 0-.629.504-1.14 1.125-1.14.184 0 .358.045.512.125zm-10.637-.085c.198-2.182 1.785-4 3.5-4 .246 0 .478.059.683.164.316-.687 1.011-1.164 1.817-1.164s1.501.477 1.817 1.164c.205-.105.437-.164.683-.164.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5c-.246 0-.478-.059-.683-.164-.316.687-1.011 1.164-1.817 1.164-2.345 0-3.722-2.951-5 0h-1z"/></svg>`,
          iconSize: [32, 32],
          iconAnchor: [12, 24],
        });
      case "factory":
        return L.divIcon({
          className: "factory",
          html: `<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="${fillColor}" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 240.000000 240.000000"><g transform="translate(0.000000,240.000000) scale(0.100000,-0.100000)" fill="${fillColor}" stroke="black" stroke-width="50"><path fill="${fillColor}" d="M732 2389 c-18 -6 -51 -28 -74 -51 -41 -41 -43 -42 -112 -43 -53 -1 -82 -7 -114 -23 -113 -60 -204 -192 -227 -329 l-7 -43 51 0 c49 0 51 1 70 39 28 54 75 91 117 91 21 0 69 -18 130 -50 159 -83 241 -98 321 -59 24 12 55 36 69 54 24 32 28 34 73 28 120 -14 207 104 156 211 -27 57 -69 81 -140 81 -58 1 -63 3 -102 42 -58 58 -129 75 -211 52z"/><path d="M0 900 l0 -900 1200 0 1200 0 0 750 0 751 -337 -282 c-186 -155 -348 -291 -359 -301 -21 -19 -22 -19 -53 21 l-31 39 89 74 90 73 0 188 1 188 -357 -299 c-270 -226 -361 -297 -371 -289 -7 6 -22 22 -32 37 l-20 28 90 77 90 76 0 185 0 184 -350 -300 -350 -300 0 450 0 450 -250 0 -250 0 0 -900z m600 -450 l0 -150 -100 0 -100 0 0 150 0 150 100 0 100 0 0 -150z m500 0 l0 -150 -100 0 -100 0 0 150 0 150 100 0 100 0 0 -150z m500 0 l0 -150 -100 0 -100 0 0 150 0 150 100 0 100 0 0 -150z m500 0 l0 -150 -100 0 -100 0 0 150 0 150 100 0 100 0 0 -150z" /></g></svg>`,
          IconSize: [32, 32],
          iconAnchor: [12, 24],
        });
      case "airport":
        return L.divIcon({
          className: "airport",
          html: `<svg width="24" height="24" stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd"><path fill="${fillColor}" d="M22 1h-2v1h4v5l-2 2v13h2v2h-24v-2h2v-9h12v-4l-2-2v-5h4v-1h-2v-1h8v1zm-13 18h-3v4h3v-4zm5 0h-4v4h4v-4zm4 0h-3v4h3v-4zm-2-15h-2v2l1 1h1v-3zm3 0h-2v3h2v-3zm3 0h-2v3h1l1-1v-2z"/></svg>`,
          iconSize: [32, 32],
          iconAnchor: [12, 24],
        });
      case "hospital":
        return L.divIcon({
          className: "hospital",
          html: `<svg width="24" height="24" stroke="black" stroke-width="0.5"  xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd"><path fill="${fillColor}" d="M24 24h-24v-2h1v-13c1.793-1.211 3.484-2.153 5.116-2.826.534 2.743 2.997 4.864 5.961 4.826 2.914-.037 5.314-2.167 5.814-4.855 1.636.675 3.324 1.627 5.109 2.855v13h1v2zm-14-1h4v-4h-4v4zm-5 0h4v-4h-4v4zm10 0h4v-4h-4v4zm-10-6h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm-12-3h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm-5-14c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5m1 2h-2v2h-2v2h2v2h2v-2h2v-2h-2v-2z"/></svg>`,
          iconSize: [32, 32],
          iconAnchor: [12, 24],
        });
      case "central_soc":
        return L.divIcon({
          className: "Central Soc",
          html: `<svg fill="#000000" height="24" width="24" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 346.163 346.163" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <g id="Layer_5_49_"> <g> <g> <path  stroke="black" stroke-width="2" fill="${fillColor}" d="M49.089,108.977c-2.602,0-5.171-1.19-6.838-3.442c-2.793-3.773-1.999-9.096,1.773-11.89l46.88-34.71 c3.773-2.793,9.096-1.999,11.89,1.773c2.794,3.773,1.999,9.096-1.773,11.89l-46.88,34.71 C52.619,108.434,50.846,108.977,49.089,108.977z"></path> </g> <g> <path fill="${fillColor}"  stroke="black" stroke-width="2" d="M53.72,153.587c-2.664,0-5.287-1.248-6.944-3.588c-2.713-3.831-1.807-9.136,2.023-11.849l100.449-71.145 c3.833-2.712,9.136-1.807,11.85,2.024c2.713,3.831,1.807,9.136-2.023,11.849L58.626,152.023 C57.134,153.08,55.418,153.587,53.72,153.587z"></path> </g> <path fill="${fillColor}" stroke="black" stroke-width="10" d="M331.933,10.229H14.23C6.403,10.229,0,16.633,0,24.46v101.953v49v93.857c0,7.827,6.403,14.231,14.23,14.231h115.985 c0,0,4.153-0.249,4.153,3.813c0,4.734,0,15.766,0,21.313c0,2.017-0.152,3.308-2.527,3.308c-7.555,0-30.219,0-30.219,0 c-6.627,0-12,5.373-12,12c0,6.628,5.373,12,12,12h142.92c6.627,0,12-5.372,12-12c0-6.627-5.373-12-12-12c0,0-22.765,0-30.492,0 c-1.75,0-2.254-1.064-2.254-2.287c0-4.985,0-17.819,0-23.021c0-3.188,2.982-3.126,2.982-3.126h117.154 c7.827,0,14.231-6.404,14.231-14.231V24.46C346.164,16.633,339.76,10.229,331.933,10.229z M187.796,287.377 c0,5.042,0,17.203,0,21.979c0,1.146-0.58,2.496-2.33,2.496c-6.297,0-18.027,0-24.813,0c-2.188,0-2.285-1.152-2.285-2.975 c0-5.393,0-16.658,0-21.313c0-3.125,3.723-3.237,3.723-3.237h22.563C184.653,284.327,187.796,284.127,187.796,287.377z M173.082,267.765c-7.734,0-14.003-6.27-14.003-14.003c0-7.734,6.269-14.003,14.003-14.003c7.733,0,14.003,6.269,14.003,14.003 C187.085,261.495,180.815,267.765,173.082,267.765z M325.217,213.728c0,7.827-6.404,14.231-14.23,14.231H35.177 c-7.827,0-14.23-6.404-14.23-14.231V47.983c0-7.827,6.403-14.231,14.23-14.231h275.81c7.826,0,14.23,6.404,14.23,14.231V213.728z "></path> </g> </g> </g> </g></svg>`,
          iconSize: [32, 32],
          iconAnchor: [12, 24],
        });
      default:
        return null;
    }
  }

  function drawAlerts() {
    alertLayer.destroyChildren(); // Rimuovi qualsiasi elemento esistente nella layer
  
    existingAlerts.forEach(function (alert) {
      var lat = alert.lat;
      var lng = alert.lng;
      if (isNaN(lat) || isNaN(lng)) {
        console.error("Coordinate non valide:", lat, lng);
        return;
      }
      var startPoint = map.latLngToContainerPoint([lat, lng]);
  
      var group = new Konva.Group({
        draggable: true, // Permetti di spostare l'intero gruppo
      });
  
      // Crea un rettangolo per ciascun tipo di alert
      var alertTypes = ['a_high', 'a_medium', 'a_low', 'a_info'];  // Lista delle proprietà da usare
  
      alertTypes.forEach(function (alertType, index) {
        var rect = new Konva.Rect({
          x: startPoint.x + (index - 2) * 21, // Spazio tra i rettangoli
          y: startPoint.y + 5, // Posizione verticale
          width: 18,
          height: 17,
          fill: getAlertColor(alertType), // Colore in base al tipo
          stroke: "black",
          strokeWidth: 0.5,
          cornerRadius: 3, // Angoli arrotondati
          draggable: true, // Ogni rettangolo è spostabile individualmente
        });
  
        // Crea il testo per ogni tipo di alert (usando a_high, a_medium, a_low, a_info)
        var text = new Konva.Text({
          x: rect.x() + 0.5, // Posizione del testo dentro il rettangolo
          y: rect.y() + 3, // Centra il testo verticalmente
          text: alert[alertType], // Usa il valore dinamico (a_high, a_medium, a_low, a_info)
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
  

  function DrawNewAlert(lat, lng, id, name, ip) {
    if (!isNaN(lat) && !isNaN(lng)) {
        $.ajax({
            url: `/get_alerts_by_name/${name}/${ip}`, // L'endpoint della tua route
            type: "POST",
            contentType: "application/json", // Tipo di contenuto JSON
            success: function (response) {
                // Verifica lo status della risposta
                console.log(response)
                if (response.status === "no_match") {
                    console.log("Nessun match trovato per il nome:", name);
                    existingAlerts.push({
                        lat: lat,
                        lng: lng,
                        id: id,
                        a_high: 0,
                        a_medium: 0,
                        a_low: 0,
                        a_info: 0,
                    });
                } else if (response.status === "success" && response.data.length > 0) {
                    // Se la risposta contiene dati, aggiungi gli alert
                    existingAlerts.push({
                        lat: lat,
                        lng: lng,
                        id: id,
                        a_high: countAlerts(response.data, "High"),
                        a_medium: countAlerts(response.data, "Medium"),
                        a_low: countAlerts(response.data, "Low"),
                        a_info: countAlerts(response.data, "Info"),
                    });
                    console.log(existingAlerts)
                } else {
                    console.log("empty data")
                    // Caso in cui la risposta è vuota
                    existingAlerts.push({
                        lat: lat,
                        lng: lng,
                        id: id,
                        a_high: 0,
                        a_medium: 0,
                        a_low: 0,
                        a_info: 0,
                    });
                }
                drawAlerts();
            },
            error: function (xhr, status, error) {
                console.log("Errore:", error);
            },
        });  
    }
  }

  function countAlerts(array, severity) {
    count = 0;
    console.log(array)
    console.log(severity)
    array.forEach(alert => {
        if(alert[1] == severity) {
            count++;
        }
    })
    console.log(count)
    return count;
  }

  function getColor(id) {
    var sum = 0;
    var perc = [];
    choose = 0;
    indexchoose = 0;
    var alert = existingAlerts.find((alert) => alert.id === id);
    sum = alert.a_high + alert.a_medium + alert.a_low;
    perc[0] = sum / alert.a_high;
    perc[1] = sum / alert.a_medium;
    perc[2] = sum / alert.a_low;
    choose = perc[0];
    indexchoose = 0;
    for (let i = 1; i < 3; i++) {
      if (choose > perc[i]) {
        indexchoose = i;
      }
    }
    switch (indexchoose) {
      case 2:
        return "#5cb85c";
      case 1:
        return "#f0ad4e";
      case 0:
        return "#Fe0000";
      default:
        return "black";
    }
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
}

function savePosition() {
  console.log("Funzione savePosition chiamata!");

  const center = map.getCenter();
  const zoom = map.getZoom();

  // Crea l'oggetto di posizione
  const mapPosition = {
    center: { lat: center.lat, lng: center.lng },
    zoom: zoom,
  };

  // Salva la posizione nel localStorage
  localStorage.setItem("savedMapPosition", JSON.stringify(mapPosition));
  console.log("Posizione salvata:", mapPosition);

  // Mostra la modale
  const modal = document.getElementById("savedModal");
  modal.classList.remove("hidden");
  modal.classList.add("show");

  // Nascondi la modale dopo 3 secondi
  setTimeout(() => {
    modal.classList.remove("show");
    modal.classList.add("hidden");
  }, 2000);

  // Recupera la posizione salvata dal localStorage
  const savedPosition = JSON.parse(localStorage.getItem("savedMapPosition"));

  /*if (savedPosition) {
    // Carica i dati dal file JSON (utilizzando fetch)
    fetch("http://localhost:3000/inventory")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const user = data.find((user) => user.username === "admin");

        if (user && user.id) {
          // Controlliamo che l'utente esista e abbia un id
          user.saved_position = {
            lat: savedPosition.center.lat,
            lng: savedPosition.center.lng,
          };

          console.log("Dati aggiornati:", user);

          fetch(`http://localhost:3000/inventory/${user.id}`, {
            // CORRETTO
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(user),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(
                  `HTTP error on update! Status: ${response.status}`
                );
              }
              return response.json();
            })
            .then((updatedData) => {
              console.log("Posizione aggiornata con successo:", updatedData);
            })
            .catch((error) => {
              console.error(
                "Errore nel salvataggio dei dati aggiornati:",
                error
              );
            });
        } else {
          console.error("Utente non trovato o senza ID.");
        }
      })
      .catch((error) => {
        console.error(
          "Errore nel caricamento o aggiornamento del JSON:",
          error
        );
      });
  }*/
}

// Funzione per tornare alla posizione salvata
function backToSavePosition() {
  // Leggi la posizione salvata dal localStorage
  const savedPosition = JSON.parse(localStorage.getItem("savedMapPosition"));

  // Controlla se esiste una posizione salvata
  if (savedPosition && savedPosition.center && savedPosition.zoom) {
    // Imposta la mappa con la posizione salvata
    const { lat, lng } = savedPosition.center;
    map.setView([lat, lng], savedPosition.zoom);
    // Mostra la modale
    const modal = document.getElementById("backModal");
    modal.classList.remove("hidden");
    modal.classList.add("show");

    // Nascondi la modale dopo 3 secondi
    setTimeout(() => {
      modal.classList.remove("show");
      modal.classList.add("hidden");
    }, 2000);
  } else {
    // Mostra la modale
    const modal = document.getElementById("noSavedModal");
    modal.classList.remove("hidden");
    modal.classList.add("show");

    // Nascondi la modale dopo 3 secondi
    setTimeout(() => {
      modal.classList.remove("show");
      modal.classList.add("hidden");
    }, 2000);
  }
}

// Funzione per resettare la posizione della mappa
function resetPosition() {
  // localStorage.removeItem("savedMapPosition"); // Rimuove i dati salvati
  map.setView(initialCoordinates, initialZoom); // Ripristina i valori di default

  // Mostra la modale
  const modal = document.getElementById("resetModal");
  modal.classList.remove("hidden");
  modal.classList.add("show");

  // Nascondi la modale dopo 3 secondi
  setTimeout(() => {
    modal.classList.remove("show");
    modal.classList.add("hidden");
  }, 2000);
}

// Aggiungi gli event listener ai bottoni
document
  .getElementById("save-position")
  .addEventListener("click", savePosition);
document.getElementById("reset-view").addEventListener("click", resetPosition);
document
  .getElementById("backToSavePosition")
  .addEventListener("click", backToSavePosition);

// Inizializza la mappa al caricamento della pagina
document.getElementById("initButton").addEventListener("click", function () {
    initializeMap();
    this.style.display = "none";
});

// function loadInventory() {
//   fetch("http://localhost:3000/inventory")
//     .then((response) => {
//       if (!response.ok) {
//         throw new Error(`HTTP error! Status: ${response.status}`);
//       }
//       return response.json();
//     })
//     .then((data) => {
//       console.log("Dati caricati:", data);
//     })
//     .catch((error) => {
//       console.error("Errore nel caricamento del JSON:", error);
//     });
// }

// Chiama la funzione al caricamento della pagina
// document.addEventListener("DOMContentLoaded", loadInventory);
