<%!
  import itertools
  from prewikka import hookmanager, utils
%>

<link
  rel="stylesheet"
  type="text/css"
  href="macro_map/css/macro_map.css"
/>
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />

<div id="wrapper" class="plugin-container">
  <div class="map-controls">
    <button
      type="button"
      id="upload-assets"
      class="controls-button"
      title="Upload entities"
      onclick="openUploadModal()"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M10 9h-6l8-9 8 9h-6v11h-4v-11zm11 11v2h-18v-2h-2v4h22v-4h-2z"/></svg>
    </button>
  </div>
  <div id="map"></div>
</div>

<div id="upload-modal" class="crud-modal-border crud-modal">
  <div class="custom-modal-header bg-primary">
    <div class="flex justify-between">
      <h3>Upload your entities into the map</h3>
      <div class="cursor-pointer flex align-center">
        <svg
          id="close-upload-modal"
          clip-rule="evenodd"
          fill-rule="evenodd"
          fill="white"
          stroke-linejoin="round"
          stroke-miterlimit="2"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="m12 10.93 5.719-5.72c.146-.146.339-.219.531-.219.404 0 .75.324.75.749 0 .193-.073.385-.219.532l-5.72 5.719 5.719 5.719c.147.147.22.339.22.531 0 .427-.349.75-.75.75-.192 0-.385-.073-.531-.219l-5.719-5.719-5.719 5.719c-.146.146-.339.219-.531.219-.401 0-.75-.323-.75-.75 0-.192.073-.384.22-.531l5.719-5.719-5.72-5.719c-.146-.147-.219-.339-.219-.532 0-.425.346-.749.75-.749.192 0 .385.073.531.219z"
          />
        </svg>
      </div>
    </div>
  </div>

  <!-- template upload -->
  <div class="custom-modal-body">
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
      <div class="flex w-100 justify-end pl-1 pr-1">
        <button id="submit-csv-button" class="btn btn-primary" type="button">Submit</button>
      </div>
    </div>
  </div>
</div>

<div id="rules-modal" class="crud-modal-border crud-modal">
  <div class="custom-modal-header bg-primary">
    <div class="flex justify-between">
      <h3>Define the entity's color rules</h3>
      <div class="cursor-pointer flex align-center">
        <svg
          id="close-rules-modal"
          clip-rule="evenodd"
          fill-rule="evenodd"
          fill="white"
          stroke-linejoin="round"
          stroke-miterlimit="2"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="m12 10.93 5.719-5.72c.146-.146.339-.219.531-.219.404 0 .75.324.75.749 0 .193-.073.385-.219.532l-5.72 5.719 5.719 5.719c.147.147.22.339.22.531 0 .427-.349.75-.75.75-.192 0-.385-.073-.531-.219l-5.719-5.719-5.719 5.719c-.146.146-.339.219-.531.219-.401 0-.75-.323-.75-.75 0-.192.073-.384.22-.531l5.719-5.719-5.72-5.719c-.146-.147-.219-.339-.219-.532 0-.425.346-.749.75-.749.192 0 .385.073.531.219z"
          />
        </svg>
      </div>
    </div>
  </div>

  <!-- icon color rules -->
  <div class="custom-modal">
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
        <li><a id="delete_marker">Delete Marker</a></li>
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
    .wait(function() {
      initializeMap();
    });
</script>