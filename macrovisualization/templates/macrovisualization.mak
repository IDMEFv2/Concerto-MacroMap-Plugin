<%!
  import itertools
  from prewikka import hookmanager, utils
%>

<link
  rel="stylesheet"
  type="text/css"
  href="macrovisualization/css/macrovisualization.css"
/>
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
/>
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />

<div class="plugin-container">
  <button id="initButton" type="button" onclick="openMap()">
    <div id="instructions-div">
      <h2 id="instruction-text">Click to open the map</h2>
    </div>
  </button>

  <!-- Custom buttons to add fuctions to the map -->

  <div class="map-controls">
    <button
      type="button"
      id="reset-view"
      class="controls-button"
      title="Reset Default View"
      onclick="resetPosition()"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 3c2.131 0 4 1.73 4 3.702 0 2.05-1.714 4.941-4 8.561-2.286-3.62-4-6.511-4-8.561 0-1.972 1.869-3.702 4-3.702zm0-2c-3.148 0-6 2.553-6 5.702 0 3.148 2.602 6.907 6 12.298 3.398-5.391 6-9.15 6-12.298 0-3.149-2.851-5.702-6-5.702zm0 8c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm8 6h-3.135c-.385.641-.798 1.309-1.232 2h3.131l.5 1h-4.264l-.344.544-.289.456h.558l.858 2h-7.488l.858-2h.479l-.289-.456-.343-.544h-2.042l-1.011-1h2.42c-.435-.691-.848-1.359-1.232-2h-3.135l-4 8h24l-4-8zm-12.794 6h-3.97l1.764-3.528 1.516 1.528h1.549l-.859 2zm8.808-2h3.75l1 2h-3.892l-.858-2z"
        />
      </svg>
    </button>
    <div type="modal" id="resetModal" class="modal-custom hidden">
      <p>Return to Default View!</p>
    </div>

    <button
      type="button"
      id="save-position"
      class="controls-button"
      title="Save Position"
      onclick="savePosition()"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path
          d="M14 3h2.997v5h-2.997v-5zm9 1v20h-22v-24h17.997l4.003 4zm-17 5h12v-7h-12v7zm14 4h-16v9h16v-9z"
        />
      </svg>
    </button>

    <button
      type="button"
      id="backToSavePosition"
      class="controls-button"
      title="Back to Saved Position"
      onclick="returnToSaved()"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path
          d="M10 12h-1v-12h1v12zm5.11-10.233c-1.243 0-1.272-1.267-2.716-1.267-.527 0-1.028.196-1.395.42v5.08c.361-.344.943-.645 1.399-.645 1.363 0 1.556 1.205 2.771 1.205.785 0 1.83-.595 1.83-.595v-4.824c.001 0-1.099.626-1.889.626zm-3.937 9.684l-.1.069-.047.013-.047.058.005.032-.058.071c-.056.057.003.093.061.068.083-.037.195-.035.205-.146l.055-.066c.024-.036-.045-.093-.074-.099zm.072.471c.062.091.549-.13.471-.117.15-.075.02-.083-.064-.127-.029-.143-.053-.364-.141-.453l.057-.067c-.138-.199-.239.241-.239.241l.073-.021-.034.09c.058.104.013.166.005.221l-.1.062c-.035.044.172.05.174.057.006.023-.251.06-.202.114zm1.79 1.457c-.046 0-.296.023-.272.068.142.233.322-.062.272-.068zm-1.035-5.379c-.34 0-.672.028-1 .069v1.408c.443-.079.898-.126 1.367-.126.729 0 1.815.299 2.065.448.377.226-.164.209-.225.357-.044.114-.15.268-.197.33-.082.106-.319.061-.273-.066.048-.133.278-.184-.069-.216-.355-.032-.454-.272-.812.027-.106.09-.188.228-.255.347l-.435.317c-.097.154.055.41.242.296.049-.03.611.516.539.076-.047-.292.156-.49.161-.71.003-.146.224-.053.164.024-.077.097-.163.427.04.443.088.007.34-.184.369-.042-.042-.137-.284.281-.269.275-.086.039-.188-.016-.12.168.061.182-.328.16-.396.197-.03.016-.332-.09-.327-.022-.104-.087.03-.303-.058-.338-.087.135-.047.41-.235.41-.161 0-.384.183-.483.295-.067.076-.486.246-.531.24.24.025.229.201.209.35-.049.347-.797.025-.765.157.03.125-.087.469-.112.579-.021.1.322.164.303.214.002-.006.467-.16.512-.2l.105-.235c.087-.059.181-.106.279-.143l.119-.207c.04-.016.517-.089.549-.074.12.055.342.283.425.386.03.039.181.094.181.15l-.002.178c.082.155.104-.321.068-.231 0-.152.112.056.139.039l-.526-.523c-.163-.274.437.146.513.197s.229.503.429.401l.086-.183.359-.071c-.285.208.223.481.146.444.128.06.203-.046.283-.017.045.018.529.012.451-.065.123.061.066.598-.033.681-.163.135-.945.079-1.12-.046-.289-.209-.237.223-.378.282-.274.113-.686-.37-.974-.386.14.021.012-.356.012-.382-.11-.137-.816.015-1.001.04-.35.046-.713.042-.979.258-.188.152-.19.4-.382.521-.123.077-.259.052-.364.152-.188.178-.402.441-.508.676-.044.098.056.333.032.459-.244.773.061 1.846.999 1.964.228.028.465.152.694.083.185-.055.346-.18.543-.194.274-.019.16.385.535.275.184-.054.266.125.266.261-.061.285-.194.443.064.643.176.137.322.332.354.567.019.132.142.359-.011.438-.109.055-.188.368-.188.472.022.12.266.35.339.451.105.146.028.317.114.482.089.169.174.298.236.469.08.236.696-.005.84-.004.489.003.738-.686 1.083-.898.192-.12.14-.448.37-.617.216-.157.442-.25.462-.539.017-.25-.188-.772-.075-.983.137-.252 1.576-2.287 1.146-2.389l-.606.288c-.118.011-.573-.48-.69-.599-.221-.221-.318-.614-.5-.884-.104-.158-.424-.471-.424-.667.013.036.146.262.209.214l.012-.111c-.005.06.375.496.459.542.185.104.182.403.365.543.35.269.254 1.031.765.568.344-.31 1.013-.897.835-1.433-.094-.284-.527-.076-.662.025-.142-.075-.664-.643-.458-.717.101-.037.324.262.403.307l.382-.005c.109.229.829-.235 1-.169.113.043.2.136.239.252.12.368.238 1.064.238 1.754 0 3.678-2.981 6.66-6.66 6.66-1.893 0-3.6-.791-4.812-2.058-.145-.151-.252-.509-.014-.655l.24-.062c.188-.16-.177-.808-.031-.912.448-.321.234-.714-.041-1.039-.117-.138-.758-.8-.831-.682.055-.181-.116-.618-.219-.791-.175-.29-.401-.467-.493-.786-.037-.126-.037-.512-.111-.601-.031-.036-.262-.134-.252-.187.289-1.72 1.236-3.149 2.568-4.129v-1.676c-2.389 1.384-4 3.962-4 6.921 0 4.418 3.581 8 8 8 4.418 0 8-3.582 8-8s-3.582-8-8-8zm3.042 4.869c-.092-.025-.562-.168-.581.017 0 .11-.448.001-.378-.116.049-.078.033-.255.123-.371.127-.168.25-.077.255.021 0 .26.263-.246.409-.263.055-.006-.07.111-.07.111.021.169.146.262.383.348.287.102.024.299-.141.253z"
        />
      </svg>
    </button>

    <button
      type="button"
      id="addNewIcon"
      class="controls-button"
      title="Add a new icon"
      onclick="openIconModal()"
    >
      <svg
        clip-rule="evenodd"
        fill-rule="evenodd"
        stroke-linejoin="round"
        stroke-miterlimit="2"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="m20 20h-15.25c-.414 0-.75.336-.75.75s.336.75.75.75h15.75c.53 0 1-.47 1-1v-15.75c0-.414-.336-.75-.75-.75s-.75.336-.75.75zm-1-17c0-.478-.379-1-1-1h-15c-.62 0-1 .519-1 1v15c0 .621.52 1 1 1h15c.478 0 1-.379 1-1zm-9.25 6.75v-3c0-.414.336-.75.75-.75s.75.336.75.75v3h3c.414 0 .75.336.75.75s-.336.75-.75.75h-3v3c0 .414-.336.75-.75.75s-.75-.336-.75-.75v-3h-3c-.414 0-.75-.336-.75-.75s.336-.75.75-.75z"
          fill-rule="nonzero"
        />
      </svg>
    </button>
  </div>

  <!-- Messages used to show successful operations -->

  <div id="savedModal" class="modal-custom hidden">
    <p>Position Saved!</p>
  </div>

  <div id="backModal" class="modal-custom hidden">
    <p>Return to Saved Position!</p>
  </div>

  <div id="noSavedModal" class="modal-custom hidden">
    <p>No Saved Position Found!</p>
  </div>

  <!-- Divs used by leaflet.js and konva.js -->

  <div id="map"></div>
  <div id="canvas-container"></div>
</div>

<!-- Modal to insert new markers -->

<div id="insert-modal" class="crud-modal-border crud-modal">
  <div class="modal-header bg-primary">
    <div class="modal-row justify-between">
      <h3>Add a new marker</h3>
      <div class="cursor-pointer flex align-center">
        <svg
          id="close-insert-modal"
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

  <div class="modal-body">
    <div class="modal-row">
      <div class="w-1/2 crud-modal-section pr-1/2">
        <label for="ip-address-add">IP address:</label>
        <input
          class="modal-input"
          type="text"
          id="ip-address-add"
          name="ip-address-add"
        />
      </div>
      <div class="w-1/2 crud-modal-section">
        <label for="site-name-add">Name:</label>
        <input
          class="modal-input"
          type="text"
          id="site-name-add"
          name="site-name-add"
        />
      </div>
    </div>
  
    <div class="modal-row">
      <div class="w-1/2 crud-modal-section pr-1/2">
        <label for="selected-lat-add">Latitude:</label>
        <input
          class="modal-input"
          type="text"
          id="selected-lat-add"
          name="selected-lat-add"
        />
      </div>
      <div class="w-1/2 crud-modal-section">
        <label for="selected-lng-add">Longitude:</label>
        <input
          class="modal-input"
          type="text"
          id="selected-lng-add"
          name="selected-lng-add"
        />
      </div>
    </div>
  
    <div class="modal-row">
      <div class="w-full crud-modal-section">
        <label for="icons-dropdown-add">Choose an icon:</label>
        <select id="icons-dropdown-add" class="icons-dropdown"></select>
      </div>
    </div>
  
    <div class="modal-row justify-end">
      <button
        onclick="submitAsset()"
        id="submit-asset"
        type="button"
        class="btn btn-primary mt-1"
      >
        Confirm
      </button>
    </div>
  </div>
</div>

<!-- Modal to edit markers -->

<div id="edit-modal" class="crud-modal-border crud-modal">
  <div class="modal-header bg-primary">
    <div class="modal-row justify-between">
      <h3>Edit a marker</h3>
      <div class="cursor-pointer flex align-center">
        <svg
          id="close-edit-modal"
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

  <div class="modal-body">
    <div class="modal-row">
      <div class="w-1/2 crud-modal-section pr-1/2">
        <label for="ip-address-edit">IP address:</label>
        <input
          class="modal-input"
          type="text"
          id="ip-address-edit"
          name="ip-address-edit"
        />
      </div>
      <div class="w-1/2 crud-modal-section">
        <label for="site-name-edit">Name:</label>
        <input
          class="modal-input"
          type="text"
          id="site-name-edit"
          name="site-name-edit"
        />
      </div>
    </div>
  
    <div class="modal-row">
      <div class="w-1/2 crud-modal-section pr-1/2">
        <label for="selected-lat-edit">Latitude:</label>
        <input
          class="modal-input"
          type="text"
          id="selected-lat-edit"
          name="selected-lat-edit"
        />
      </div>
      <div class="w-1/2 crud-modal-section">
        <label for="selected-lng-edit">Longitude:</label>
        <input
          class="modal-input"
          type="text"
          id="selected-lng-edit"
          name="selected-lng-edit"
        />
      </div>
    </div>
  
    <div class="modal-row">
      <div class="w-full crud-modal-section">
        <label for="icons-dropdown-edit">Choose an icon:</label>
        <select id="icons-dropdown-edit" class="icons-dropdown"></select>
      </div>
    </div>
  
    <div class="modal-row justify-between">
      <button onclick="deleteAsset()" id="delete-asset" type="button" class="btn btn-danger mt-1">Delete</button>
      <button onclick="editAsset()" id="edit-asset" type="button" class="btn btn-primary mt-1">Edit</button>
    </div>
  </div>
</div>

<!-- Icon addition modal -->

<div id="icon-modal" class="crud-modal-border crud-modal">
  <div class="modal-header bg-primary">
    <div class="modal-row justify-between">
      <h3>Add a new icon</h3>
      <div class="cursor-pointer flex align-center">
        <svg
          id="close-icon-modal"
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

  <div class="modal-body">
    <div class="modal-row">
      <div class="w-full crud-modal-section">
        <label for="icon-name">Icon name:</label>
        <input
          class="modal-input"
          type="text"
          id="icon-name"
          name="icon-name"
        />
      </div>
    </div>
  
    <div class="modal-row">
      <div class="w-full crud-modal-section">
        <label for="svg-raw">Icon SVG:</label>
        <textarea id="svg-raw" name="svg-raw" rows="10" cols="100"></textarea>
      </div>
    </div>
  
    <div class="modal-row justify-end">
      <button onclick="addNewMapIcon()" id="edit-asset" type="button" class="btn btn-primary mt-1">Confirm</button>
    </div>
  </div>

</div>

<!-- Date selector -->

<div id="date_filter_container" class="settings-div">
  <div class="form-group-date">
    <input
      type="text"
      id="start_date"
      name="timeline_start_map"
      class="form-control timeline_start_map"
      data-toggle="tooltip"
      title="Start date"
      data-name="timeline_start_map"
    />
  </div>
  <div class="form-group-date">
    <input
      type="text"
      id="end_date"
      name="timeline_end_map"
      class="form-control timeline_end_map"
      data-toggle="tooltip"
      title="End date"
      data-name="timeline_end_map"
    />
  </div>
  <button id="submit_date_filter" class="btn btn-primary" type="button">
    <i class="fa fa-search fa-lg fa-fw"></i>
  </button>
</div>

<div id="modal-mask" class="modal-mask"></div>

<script type="text/javascript">
  $LAB
    .script("macrovisualization/js/macrovisualization.js")
    .script("https://unpkg.com/leaflet/dist/leaflet.js")
    .script("https://unpkg.com/konva/konva.min.js")
    .script("prewikka/js/moment.min.js");
</script>
