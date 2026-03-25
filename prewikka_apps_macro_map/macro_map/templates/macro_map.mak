<%!
  import itertools
  import pkg_resources
  from prewikka import hookmanager, utils
%>

  <link rel="stylesheet" type="text/css" href="macro_map/css/macro_map.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />

  <div id="wrapper" class="plugin-container">
    <div class="map-controls">
      <span class="version">V${pkg_resources.get_distribution('prewikka-apps-macro_map').version}</span>
      <button type="button" id="upload-assets" class="controls-button" title="Upload entities"
        onclick="openUploadModal()">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path d="M10 9h-6l8-9 8 9h-6v11h-4v-11zm11 11v2h-18v-2h-2v4h22v-4h-2z" />
        </svg>
      </button>
      <button type="button" id="reset-position" class="controls-button" title="Reset map position"
        onclick="resetMapPosition()">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path
            d="M11 20h-2v-20h2v20zm10.221-16.467c-2.488 0-2.544-2.533-5.432-2.533-1.056 0-2.057.393-2.789.84v10.16c.723-.688 1.887-1.289 2.799-1.289 2.727 0 3.11 2.41 5.541 2.41 1.571 0 2.66-1.189 2.66-1.189v-9.65s-1.2 1.251-2.779 1.251zm-1.221 13.467h-7v2h5.84l1.714 3h-17.108l1.714-3h1.84v-2h-3l-4 7h24l-4-7z" />
        </svg>
      </button>
      <button type="button" id="set-position" class="controls-button" title="Set default position"
        onclick="setDefaultPosition()">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path
            d="M17.715 3.533c-2.94 0-3.006-2.533-6.419-2.533-1.247 0-2.43.393-3.296.84v-1.84h-2v14.75c0 1.479.354 2.936 1.031 4.25.638-1.316.969-2.76.969-4.222v-2.778c.854-.688 2.229-1.289 3.308-1.289 3.223 0 3.676 2.41 6.549 2.41 1.856 0 3.144-1.189 3.144-1.189v-9.65c-.001 0-1.419 1.251-3.286 1.251zm1.285 7.32c-1.279.589-2.076.159-3.076-.531-.986-.679-2.336-1.61-4.616-1.61-1.118-.001-2.298.394-3.308.912v-5.386c1.354-1.167 3.551-1.885 5.54-.326 1.525 1.194 3.119 1.968 5.46 1.489v5.452zm-8 11.647c0 .829-1.79 1.5-4 1.5s-4-.671-4-1.5 1.79-1.5 4-1.5 4 .671 4 1.5z" />
        </svg>
      </button>
      <button type="button" id="open-settings" class="controls-button" title="Global Settings"
        onclick="openSettingsModal()">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path
            d="M24 14v-4c-1.619 0-2.906.267-3.705-1.476-.697-1.663.604-2.596 1.604-3.596l-2.829-2.828c-1.033 1.033-1.908 2.307-3.666 1.575-1.674-.686-1.404-2.334-1.404-3.675h-4c0 1.312.278 2.985-1.404 3.675-1.761.733-2.646-.553-3.667-1.574l-2.829 2.828c1.033 1.033 2.308 1.909 1.575 3.667-.348.849-1.176 1.404-2.094 1.404h-1.581v4c1.471 0 2.973-.281 3.704 1.475.698 1.661-.604 2.596-1.604 3.596l2.829 2.829c1-1 1.943-2.282 3.667-1.575 1.673.687 1.404 2.332 1.404 3.675h4c0-1.244-.276-2.967 1.475-3.704 1.645-.692 2.586.595 3.596 1.604l2.828-2.829c-1-1-2.301-1.933-1.604-3.595l.03-.072c.687-1.673 2.332-1.404 3.675-1.404zm-12 2c-2.209 0-4-1.791-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4z" />
        </svg>
      </button>
      <button type="button" id="open-resources" class="controls-button" title="Resources"
        onclick="openResourcesModal()">
        <svg clip-rule="evenodd" fill-rule="evenodd" stroke-linejoin="round" stroke-miterlimit="2" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m12.002 2.005c5.518 0 9.998 4.48 9.998 9.997 0 5.518-4.48 9.998-9.998 9.998-5.517 0-9.997-4.48-9.997-9.998 0-5.517 4.48-9.997 9.997-9.997zm0 8c-.414 0-.75.336-.75.75v5.5c0 .414.336.75.75.75s.75-.336.75-.75v-5.5c0-.414-.336-.75-.75-.75zm-.002-3c-.552 0-1 .448-1 1s.448 1 1 1 1-.448 1-1-.448-1-1-1z" fill-rule="nonzero"/></svg>
      </button>
    </div>
    <div id="map"></div>
  </div>

  <div id="upload-modal" class="crud-modal-border crud-modal" data-resizable="true">
    <div class="custom-modal-header bg-primary ui-front" data-draggable="true">
      <div class="flex justify-between">
        <h3>Upload your entities into the map</h3>
        <div class="cursor-pointer flex align-center">
          <svg id="close-upload-modal" clip-rule="evenodd" fill-rule="evenodd" fill="white" stroke-linejoin="round"
            stroke-miterlimit="2" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="m12 10.93 5.719-5.72c.146-.146.339-.219.531-.219.404 0 .75.324.75.749 0 .193-.073.385-.219.532l-5.72 5.719 5.719 5.719c.147.147.22.339.22.531 0 .427-.349.75-.75.75-.192 0-.385-.073-.531-.219l-5.719-5.719-5.719 5.719c-.146.146-.339.219-.531.219-.401 0-.75-.323-.75-.75 0-.192.073-.384.22-.531l5.719-5.719-5.72-5.719c-.146-.147-.219-.339-.219-.532 0-.425.346-.749.75-.749.192 0 .385.073.531.219z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- template upload -->
    <div class="custom-modal-body">
      <div class="flex flex-col gap-1 wrap">
        <span class="bold">Quick Start - Load a preset Use Case</span>
        <div id="presets-div" class="flex gap-1 wrap pl-1 pr-1">
        </div>
      </div>
      <hr class="modal-hr upload-type-hr">
      <div class="flex flex-col gap-1 wrap">
        <span class="bold">Step 1 - Download a template</span>
        <div class="flex gap-1 wrap pl-1 pr-1">
          <button id="download-sample-csv" class="btn btn-primary" type="button">Download as csv</button>
          <button id="download-sample-xlsx" class="btn btn-primary" type="button">Download as xlsx</button>
        </div>
        <div class="flex align-center gap-1/2 wrap pl-1 pr-1">
          <span><span class="bold">(optional)</span> - Read the template usage guide:</span>
          <button id="download-guide" class="btn btn-link pl-0 pr-0">Download</button>
        </div>
      </div>
      <hr class="modal-hr">
      <div class="flex flex-col gap-1 wrap">
        <span class="bold">Step 2 - Upload your entities in CSV format</span>
        <div class="flex gap-1 pl-1 pr-1">
          <button id="select-csv-button" class="btn btn-primary" type="button">Select csv</button>
          <div class="flex w-100 align-stretch">
            <input id="csv-filename" type="text" class="modal-input w-100 modal-input-flat-right" readonly>
            <button id="clear-csv-button" class="btn btn-danger btn-flat-left" type="button">X</button>
            <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display:none" />
          </div>
        </div>
        <div class="flex w-100 justify-end pl-1 pr-1 align-center">
          <button id="submit-csv-button" class="btn btn-primary" type="button">Submit</button>
        </div>
      </div>
    </div>
  </div>

  <div id="rules-modal" class="crud-modal-border crud-modal" data-resizable="true">
    <div class="custom-modal-header bg-primary ui-front" data-draggable="true">
      <div class="flex justify-between">
        <h3>Define the entity's color rules</h3>
        <div class="cursor-pointer flex align-center">
          <svg id="close-rules-modal" clip-rule="evenodd" fill-rule="evenodd" fill="white" stroke-linejoin="round"
            stroke-miterlimit="2" width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="m12 10.93 5.719-5.72c.146-.146.339-.219.531-.219.404 0 .75.324.75.749 0 .193-.073.385-.219.532l-5.72 5.719 5.719 5.719c.147.147.22.339.22.531 0 .427-.349.75-.75.75-.192 0-.385-.073-.531-.219l-5.719-5.719-5.719 5.719c-.146.146-.339.219-.531.219-.401 0-.75-.323-.75-.75 0-.192.073-.384.22-.531l5.719-5.719-5.72-5.719c-.146-.147-.219-.339-.219-.532 0-.425.346-.749.75-.749.192 0 .385.073.531.219z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- icon color rules -->
    <div class="custom-modal-body">
      <span class="pb-1 bold">
        Rules are evaluated from top to bottom (Rule 1 → Rule N). The first matching rule determines the icon color.
      </span>

      <div id="rules-grid-container" class="rules-container"></div>
      <div class="mt-1">
        <button id="add-rule-button" class="btn btn-primary" type="button">Add rule</button>
        <div id="insert-rules-div" class="flex gap-1 justify-between" style="display: none;">
          <div class="flex gap-1">
            <div class="flex gap-1 flex-col">
              <span class="bold">Rule type:</span>
              <select name="rule-type" id="type-dropdown" class="rule-input" data-field="metric">
                <option value="percentage">Percentage</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div class="flex gap-1 flex-col">
              <span class="bold">Position:</span>
              <input type="number" id="position-input" class="rule-input" data-field="position" value="1" min="1" />
            </div>
          </div>
          <div class="flex gap-1 mt-auto">
            <button id="cancel-rules-button" class="btn btn-secondary" type="button">Cancel</button>
            <button id="insert-rules-button" class="btn btn-primary" type="button">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="settings-modal" class="crud-modal-border crud-modal" data-resizable="true">
    <div class="custom-modal-header bg-primary ui-front" data-draggable="true">
      <div class="flex justify-between">
        <h3>Global Map Settings</h3>
        <div class="cursor-pointer flex align-center" onclick="closeSettingsModal()">
          <svg clip-rule="evenodd" fill-rule="evenodd" fill="white" stroke-linejoin="round" stroke-miterlimit="2"
            width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="m12 10.93 5.719-5.72c.146-.146.339-.219.531-.219.404 0 .75.324.75.749 0 .193-.073.385-.219.532l-5.72 5.719 5.719 5.719c.147.147.22.339.22.531 0 .427-.349.75-.75.75-.192 0-.385-.073-.531-.219l-5.719-5.719-5.719 5.719c-.146.146-.339.219-.531.219-.401 0-.75-.323-.75-.75 0-.192.073-.384.22-.531l5.719-5.719-5.72-5.719c-.146-.147-.219-.339-.219-.532 0-.425.346-.749.75-.749.192 0 .385.073.531.219z" />
          </svg>
        </div>
      </div>
    </div>
    <div class="custom-modal-body">
      <div class="flex flex-col gap-1 wrap">
        <span class="bold">Vector History Tracking</span>
        <div class="flex align-center justify-between pl-1 pr-1 mt-1">
          <span>Enable history tracking:</span>
          <label class="switch">
            <input type="checkbox" id="enable-history-tracking" checked />
            <span class="slider round"></span>
          </label>
        </div>
        <div class="flex align-center justify-between gap-1 pl-1 pr-1">
          <span>Max past positions to display:</span>
          <input type="number" id="past-positions-input" class="modal-input" style="width: 80px;" min="0" value="10">
        </div>
        <hr class="modal-hr">
        <div class="flex flex-col gap-1 wrap">
          <span class="bold">Visual Settings</span>
          <div class="flex align-center justify-between gap-1 pl-1 pr-1 mt-1">
            <span>Map layer:</span>
            <select id="map-layer-select" class="modal-input" style="width: 180px;">
              <option value="osm">OpenStreetMap</option>
              <option value="voyager">Voyager</option>
            </select>
          </div>
          <div class="flex align-center justify-between pl-1 pr-1 mt-1">
            <span>Show entity names:</span>
            <label class="switch">
              <input type="checkbox" id="display-entity-names" name="display-entity-names" checked />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="flex align-center justify-between pl-1 pr-1 mt-1">
            <span>Show alerts display:</span>
            <label class="switch">
              <input type="checkbox" id="display-alerts" name="display-alerts" checked />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="flex align-center justify-between pl-1 pr-1 mt-1">
            <span>Apply global entity size:</span>
            <label class="switch">
              <input type="checkbox" id="enable-global-size" name="enable-global-size" checked />
              <span class="slider round"></span>
            </label>
          </div>
          <div class="flex align-center justify-between gap-1 pl-1 pr-1">
            <span>Global size:</span>
          <input type="number" id="global-entity-size-input" class="modal-input" style="width: 80px;" min="0" value="32">
        </div>
          <div class="flex align-center justify-between gap-1 pl-1 pr-1">
            <span>Alert badge font size:</span>
            <input type="number" id="alert-display-size-input" class="modal-input" style="width: 80px;" min="1" value="11">
          </div>
          <div class="flex align-center justify-between gap-1 pl-1 pr-1">
            <span>Name label font size:</span>
            <input type="number" id="name-display-size-input" class="modal-input" style="width: 80px;" min="1" value="11">
          </div>
        </div>
        <hr class="modal-hr">
        <div class="flex flex-col gap-1 wrap">
          <span class="bold">Data Management</span>
          <div class="flex align-center justify-between pl-1 pr-1">
            <span>Restore initial map position:</span>
            <button id="restore-position-button" class="btn btn-primary btn-settings" type="button"
              onclick="restoreDefaultMapPosition()">Restore Position</button>
          </div>
          <div class="flex align-center justify-between pl-1 pr-1">
            <span>Permanently delete all markers and rules:</span>
            <button id="reset-map-button" class="btn btn-danger btn-settings" type="button" onclick="resetMap()">Reset
              Map</button>
          </div>
        </div>
        <div class="flex w-100 justify-end mt-1 pl-1 pr-1">
          <button id="save-settings-button" class="btn btn-primary btn-settings" type="button"
            onclick="applyGlobalSettings()">Apply Settings</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Temporary addition for development only -->
  <div id="resources-modal" class="crud-modal-border crud-modal" data-resizable="true">
    <div class="custom-modal-header bg-primary ui-front" data-draggable="true">
      <div class="flex justify-between">
        <h3>Testing Resources</h3>
        <div class="cursor-pointer flex align-center" onclick="closeResourcesModal()">
          <svg clip-rule="evenodd" fill-rule="evenodd" fill="white" stroke-linejoin="round" stroke-miterlimit="2"
            width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path
              d="m12 10.93 5.719-5.72c.146-.146.339-.219.531-.219.404 0 .75.324.75.749 0 .193-.073.385-.219.532l-5.72 5.719 5.719 5.719c.147.147.22.339.22.531 0 .427-.349.75-.75.75-.192 0-.385-.073-.531-.219l-5.719-5.719-5.719 5.719c-.146.146-.339.219-.531.219-.401 0-.75-.323-.75-.75 0-.192.073-.384.22-.531l5.719-5.719-5.72-5.719c-.146-.147-.219-.339-.219-.532 0-.425.346-.749.75-.749.192 0 .385.073.531.219z" />
          </svg>
        </div>
      </div>
    </div>
    <div class="custom-modal-body">
      <ul>
        <li>
          <a href="https://concerto.central.safe4soc.cosypoc.fr/settings/my_account" target="_blank">
            Concerto Central
          </a>
        </li>
        <li>
          <a href="https://vm1.safe4soc.cosypoc.fr/" target="_blank">
            Concerto Central Console
          </a>
        </li>
        <li>
          <a href="https://temtsp.sharepoint.com/:x:/r/sites/Safe4Soc/_layouts/15/doc2.aspx?sourcedoc=%7BC840A627-4157-4F68-A0BB-20403E7D53A7%7D&file=S4S-MacroMapFeatures-1a.xlsx&action=default&mobileredirect=true" target="_blank">
            Map Specifications File
          </a>
        </li>
      </ul>
    </div>
  </div>

  <div id="modal-mask" class="modal-mask"></div>

  <div id="PopoverOption" class="popover-options">
    <ul class="popover dropdown-menu dropdown-menu-theme multi-level" role="menu" aria-labelledby="dropdownMenu">
      <div class="arrow"></div>
      <li class="dropdown-submenu">
        <a>Search</a>
        <ul class="dropdown-menu dropdown-menu-theme">
          <li><a id="alerts_table">Go to alerts table</a></li>
        </ul>
      </li>
      <li class="dropdown-submenu">
        <a>Marker settings</a>
        <ul class="dropdown-menu dropdown-menu-theme">
          <li><a id="edit_rules">Edit color rules</a></li>
        </ul>
      </li>
      <li class="dropdown-submenu">
        <a>Actions</a>
        <ul class="dropdown-menu dropdown-menu-theme">
          <li><a id="center_map_on_entity">Center map on entity</a></li>
          <li><a id="center_and_zoom_map_on_entity">Center and zoom map on entity</a></li>
          <li><a id="delete_marker">Delete marker</a></li>
        </ul>
      </li>
    </ul>
  </div>

  <script type="text/javascript">
    $LAB
      .script("https://unpkg.com/file-saver@2.0.5/dist/FileSaver.min.js")
      .script("macro_map/js/macro_map.js")
      .script("https://unpkg.com/leaflet/dist/leaflet.js")
      .script("prewikka/js/moment.min.js")
      .wait(function () {
        initializeMap();
      });
  </script>