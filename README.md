# Prewikka Macro Map Plugin

This plugin provides a geospatial visualization layer for IDMEFv2 alerts within the Concerto SIEM (Prewikka) interface. It places monitored entities on an interactive map and visualizes their alert status in real-time.

## Features

### 1. Interactive Map Visualization
- **Entities**: Displays critical infrastructure assets (Airports, Banks, Hospitals, Nuclear Plants, Ports, and more) on a Leaflet-based map.
- **Status Badges**: Each entity displays a badge summarising the count of active alerts by severity (High, Medium, Low, Info). Badges can be independently positioned (Up, Down, Left, Right) relative to the marker.
- **Name Labels**: Each entity can display a name label, independently positioned relative to the marker. Label placement adapts to icon size to keep alignment consistent.
- **Tooltips**: Hovering over entities displays a rich tooltip showing the entity **Name**, **Town**, and a summary of active alert counts by severity, including nationality information through the related flag indicator when available.
- **Flag Badges**: Entities with a `Nationality` code display a country/organisation flag badge overlaid on the marker icon.
- **Infrastructure Links**: Entities can be connected by visual lines on the map using the `LinksTo` field, representing infrastructure dependencies.

### 2. Dynamic Alert Visualization
- **Color Coding**: Entity icons change color (e.g., Green, Yellow, Red) dynamically based on configurable rules.
- **Source and Target Icons**: Alert sources and targets are drawn on the map at the position given by their `GeoLocation`, with the icon associated with their category (see [Icon Library and Management](#13-icon-library-and-management)). By default, `Object.Vehicles.Aircraft` sources appear as drones and `Logistics.Vehicles` targets as taxis.
- **Independent Targets**: Targets are retrieved by category and do not need to belong to a monitored entity (no `EntityName` is required).
- **Several Elements per Alert**: An alert may list several sources or targets. Each element is drawn at its own position with the icon of its own category; elements without `GeoLocation` or without an associated icon are not drawn. Their tooltip shows "Position in alert: N of M". If the lists of an alert are not aligned (different lengths), the alert is ignored and a warning is written in the browser console.

### 3. Custom Rule Engine
Users can define rules directly from the UI to control entity appearance:
- **Percentage Rules**: Change color if High/Medium/Low alerts exceed a certain percentage of total alerts (e.g., "Turn Red if High Priority alerts >= 50%").
- **Regex Rules**: Change color if an alert description matches a specific keyword or regular expression (e.g., "Turn Red if description contains 'Drone'"). The match is case-insensitive; if the text is not a valid regular expression it is searched as plain text.
- **Rule Priority**: Rules are evaluated from top to bottom; the first matching rule determines the icon color.
- **Dynamic Editing**: Rules can be added, modified, or deleted in real-time with immediate visual feedback.

### 4. Source and Target Tracking
- **Path History**: Visualizes the movement history of sources (e.g. drones) and targets with a configurable trail length. History can be enabled separately for sources and for targets.
- **Position Trail**: Historical positions are shown with reduced opacity and connect to the entity via dashed lines.
- **Real-time Updates**: Source and target positions update automatically based on incoming alert data within the selected time range.
- **Configurable History**: Set the maximum number of past positions to display (default: 10).
- **Independent Visibility**: Sources and targets can be shown or hidden independently from Global Settings.

### 5. Data Management & Import
- **CSV Upload**: Bulk import entity definitions using a CSV file (semicolon-delimited).
- **Quick Start Presets**: Load built-in use-case presets from the upload modal with one click.
- **Templates**: Download sample CSV and XLSX templates to get started quickly.
- **Guide**: Built-in Markdown guide available for download, describing all fields and validation rules.
- **Server-side Validation**: Comprehensive CSV validation with detailed error messages for each row and field.
- **Mandatory Header Columns** (must always be present):

   ```
   EntityName;Town;Nationality;Latitude;Longitude
   ```

- **Optional Header Columns** (can be omitted):

   ```
   Icon;IconSize;NamePosition;NameVisibleZoom;AlertPosition;AlertVisibleZoom;LinksTo
   ```

- **Default Values for Optional Columns** (used when the column is missing or the row value is empty):

   ```
   Airport;32;Up;7;Right;7;
   ```

- **Supported Fields**:

  | Field | Description |
  |---|---|
   | `EntityName` | Display name shown on the map and logical identifier used to associate alerts |
  | `Town` | City/town where the asset is located |
   | `Nationality` | Country/region code for the flag badge (ISO 3166-1 alpha-2 or exceptions such as `eu`, `un`) |
  | `Latitude` | Geographic latitude (-90 to 90) |
  | `Longitude` | Geographic longitude (-180 to 180) |
  | `Icon` | Name of an icon in the library (case-sensitive, see [Icon Library and Management](#13-icon-library-and-management)); it is not validated at import time and a missing icon is shown as a circle with a question mark |
   | `IconSize` | Marker size in pixels (≥ 0) |
  | `NamePosition` | Name label position: `Up`, `Down`, `Left`, `Right` |
  | `NameVisibleZoom` | Minimum zoom level to show the name (3–12) |
   | `AlertPosition` | Alert badge position: `Up`, `Down`, `Left`, `Right` |
   | `AlertVisibleZoom` | Minimum zoom level to show the badge (3–12) |
  | `LinksTo` | Comma-separated `EntityName` values to draw infrastructure links to |

### 6. Persistent State Management
- **Auto-save**: The plugin automatically saves the current map state (entities, rules, global settings, and map position) after every change.
- **Server-side Recovery**: Map position, zoom level, entities, and rules are fully restored from `/tmp/prewikka_macro_map/map_state.json` when revisiting the page.
- **Browser-side Last View**: The last visited map position (center + zoom) is also stored in the browser's `localStorage` and used to restore the viewport immediately on load, before the server state is fetched.
- **Modal Session Restore**: If a modal is open during a refresh, it is automatically reopened.
- **Modal Content Restore**: Current values inside modal controls are persisted and restored.
- **Incremental Modal Autosave**: Modal state is saved on slider/select/checkbox changes and on input blur events.
- **Manual Reset**: Clear all data and start fresh using the "Reset Map" option in Global Settings.
- **File-based Storage**: Map state is persisted server-side in `/tmp/prewikka_macro_map/map_state.json`.
- **Custom Icons and Associations**: Uploaded icons are stored in `/tmp/prewikka_macro_map/custom_icons/` and icon associations in `/tmp/prewikka_macro_map/custom_bindings.json`. "Reset Map" does not delete them. Like the map state, they are lost if the container is recreated.

### 7. Map Position Controls
- **Reset Position**: Instantly return to the default map view (Europe-centered).
- **Set Default Position**: Save the current map view (center and zoom) as the new default position.
- **Boundary Constraints**: Map panning is limited to prevent excessive navigation outside the monitored region.

### 8. Zoom-based Visibility
- **Smart Label Display**: Entity names appear only when zooming in beyond a configurable threshold (3-12).
- **Badge Visibility Control**: Alert count badges can be configured to show/hide at specific zoom levels.
- **Related Icon Visibility**: Source and target icons have independent zoom thresholds for optimal visibility.

### 9. Context Actions
Clicking a marker opens a context menu with the following options:
- **Search > Go to alerts table**: Navigate to the standard alert listing pre-filtered for that specific entity and alert type.
- **Micro Map > Per-plan entries**: When Micro plans exist for the selected entity, the submenu shows one entry per plan name and navigates directly to that specific Micro floor plan.
- **Micro Map > Open Micro Map**: Fallback entry shown when no plan is available, opening Micro Map on the selected asset without forcing a plan.
- **Marker settings > Edit color rules**: Open the rule editor for that entity.
- **Actions > Center map on entity**: Pan the map to centre on the selected entity.
- **Actions > Center and zoom map on entity**: Pan to the selected entity and apply a focused zoom level.
- **Actions > Delete marker**: Remove the marker from the map.
- **Report > Guard / Police / Fire Department**: Open the Emergency Service Request form (proof of concept, static: "Submit" only shows a local confirmation and nothing is sent to a backend).

### 10. Macro/Micro Route Separation And Navigation Contract
- **Separated route namespaces**: Macro and Micro features now use explicit, non-overlapping route families:
   - Macro routes: `/macro_map/*`
   - Micro routes: `/micro_map/*`
- **Dedicated navigation endpoint**: Macro-to-Micro handoff uses `/macro_map/navigate_to_micro_map` and stores per-user navigation context in `/tmp/prewikka_plugin_navigation/context.json`.
- **Context payload**: The navigation context includes:
   - `asset_ref`
   - `ref_type`
   - `source`
   - `svg_name` (when a specific floor plan is selected from the Macro context submenu)
- **Consumption model**: Micro reads the context via `/micro_map/get_micro_navigation_context`; context is consumed once per user navigation flow.
- **Plan discovery for context menu**: Macro resolves Micro plan names in bulk through `/micro_map/get_micro_plans_list_bulk` to build the dynamic submenu efficiently.

### 11. Global Settings
Access advanced configuration through the settings modal:

**Vector History Tracking**
- **Enable history tracking**: Toggle the position trail of sources on or off.
- **Enable target history tracking**: Toggle the position trail of targets on or off.
- **Max past positions**: Configure the maximum number of past positions to display (default: 10).

**Visual Settings**
- **Map layer**: Select the base tiles. Only `OpenStreetMap` is currently offered: `Voyager` is disabled because CARTO now requires an API key (tiles are watermarked without one).
- **Show entity names**: Globally toggle visibility of all entity name labels.
- **Show alerts display**: Globally toggle visibility of all alert count badges.
- **Show sources**: Globally toggle visibility of all source icons.
- **Show targets**: Globally toggle visibility of all target icons.
- **Apply global entity size**: Force a shared icon size for all entities.
- **Global size**: Set the icon size value (in pixels) when global size is enabled.
- **Alert badge font size**: Set the global font size used for alert badges.
- **Name label font size**: Set the global font size used for name labels.

**Data Management**
- **Restore initial map position**: Reset the map view to the original system default (Europe-centred, zoom 5), discarding any saved custom default.
- **Reset Map**: Permanently delete all markers, rules, and state — cannot be undone.

**Window Behaviour**
- **Draggable modals**: Main modals can be moved by dragging their header.
- **Resizable modals**: Main modals support resizing to improve usability on smaller screens.

### 12. Time-based Filtering
- **Automatic Synchronization**: Alert queries respect the Prewikka global time range selector.
- **Dynamic Updates**: Changing the time range automatically refreshes entity alert counts and source/target positions.
- **Manual Refresh**: The "Refresh data" button of the map controls re-fetches the alert data on demand. Manual and automatic refreshes only redraw the entities whose alerts changed.

### 13. Icon Library and Management
Icons are SVG files, so the set can be extended from the UI without changing the source code. The **Manage Icons** button of the map controls opens the icon library.

**Default icons** (read-only, shipped with the plugin in `htdocs/assets/default_icons/`):
`Administration`, `Airport`, `Bank`, `Chemical`, `Church`, `Cultural`, `Defense`, `Digital`, `Drone`, `Education`, `Emergency`, `Energy`, `Finance`, `Grave`, `Health`, `Hospital`, `Industry`, `Mining`, `Nuclear`, `Port`, `Radar`, `Road`, `Taxi`, `Telecom`, `Television`, `Waste`, `Water`.

**Custom icons** are uploaded from the UI and stored outside the package, so plugin updates and "Reset Map" do not remove them. A custom icon with the same name as a default one replaces it; deleting the custom icon restores the default.

#### Library
- **Grid**: one tile per icon, with a `Default` or `Custom` badge and one badge per association (Source/Target). Chips filter the grid by All, Default or Custom.
- **Restore defaults**: deletes the custom icons that replace a default one (and their associations).
- **Delete all custom**: deletes every custom icon and every custom association.

#### Uploading an icon
- **Form**: Name, Type, Category, optional starting file (the SVG can also be pasted), preview and an editable SVG text. What is saved is the text, after **Validate**.
- **Validation**: performed by the server. Results are *ok*, *note*, *warning* or *error*. Elements that are not allowed are rejected (`script`, `foreignObject`, `style`, `image`, `iframe`, `use`, animations, `on*` attributes, external references, `DOCTYPE`/`ENTITY`). The `viewBox` is derived from `width`/`height` when missing, and a single fixed colour is converted to `currentColor`. An icon with several fixed colours is accepted with a warning because it will not follow the colour rules.
- **Limits**: 50 KB per file; names use `A-Z a-z 0-9 _ -` (1–40 characters).
- **Colour**: the colour of an icon comes from `currentColor` (or from shapes without `fill`), so entity icons follow the colour rules.
- **Editing and deleting**: clicking a tile opens the same form with the name locked; custom icons can be deleted from it.

#### Uploading several icons
- **Upload multiple** opens a review table with one row per selected file (up to 50). Name, Type and Category are pre-filled and editable, and each row is validated by the server before anything is saved.
- Blocking errors: duplicate names in the batch, the same Type + Category in two rows, invalid name or SVG error. A name that already exists is saved only if **Overwrite** is ticked.
- Non-blocking warning: the chosen category is already associated with another icon.
- **Confirm upload** saves the rows one by one; failed rows stay in the table and can be fixed and retried (**Retry failed**).

#### Associating an icon with an alert category
- **Type**: `Generic` (no association, default), `Source` or `Target`. For Source and Target, **Category** lists the IDMEFv2 `Source.Category` (155 values) or `Target.Category` (36 values) of schema V08.
- Saving with a category creates or replaces the association; the form warns when the category is already associated with another icon. Saving with Type `Generic` removes all associations of the icon.
- An association matches the exact category; if an element has several categories, the first one with an associated icon is used.
- Default associations are listed in `htdocs/assets/idmef_icon_bindings.json` and can be replaced or hidden from the UI. Custom associations are stored in `custom_bindings.json`.
- Deleting a custom icon, or restoring defaults, also removes its associations.

#### Files that cannot be loaded
- Files placed by hand in the icon folders are validated when the library is read; a file with an error is not loaded and the result is cached until the file changes.
- A custom file that is not loaded appears in the grid as a red tile ("Not loaded", the reason is in the tooltip); clicking it opens the edit form with the file text so it can be fixed or deleted. Default files that are not loaded are listed in a banner at the top of the library.
- If a marker uses an icon name that does not exist, it is drawn as a circle with a question mark, coloured like the other icons.

### 14. Infrastructure Links
- **Visual connections**: Entities can be linked on the map with lines representing infrastructure dependencies, configured via the `LinksTo` CSV field.
- **Automatic rendering**: Links are redrawn automatically after every state change.
- **Multi-target**: A single entity can link to multiple targets using a comma-separated list of `EntityName` values.

### 15. Nationality & Flag Badges
- **Flag overlay**: Each marker can display a small flag badge (bottom-left corner) using the `Nationality` field.
- **Standard codes**: Supports ISO 3166-1 alpha-2 country codes (e.g. `fr`, `us`, `de`).
- **Extended codes**: Also supports organisation and subnational codes present in the flag assets (e.g. `eu`, `un`, `asean`, `arab`, `gb-eng`, `es-ct`).
- **Graceful fallback**: If the code has no matching flag image, the badge is silently hidden.

### 16. Testing Resources (Development)
- **Resources modal**: A development-only modal is available from the map controls to open external testing references.

### 17. Code Organisation
- **JavaScript**: split into classic global scripts in `htdocs/js/`, loaded in this order by the template: `macro_map_icons.js` (icon catalogue), `macro_map_utils.js` (pure helpers), `macro_map_api.js` (AJAX wrappers), `macro_map_related_icons.js` (source and target icons) and `macro_map.js` (main, `initializeMap()`).
- **Python**: the view is composed of mixins (`db.py`, `views_presets.py`, `views_alerts.py`, `views_state.py`, `views_icons.py`) used by the `macroMapView` class in `macro_map.py`.
- **Icon routes**: `/macro_map/get_icons`, `/macro_map/get_icon_bindings`, `/macro_map/validate_icon`, `/macro_map/save_icon`, `/macro_map/delete_icon`, `/macro_map/reset_icons`.
- **Targets route**: `/macro_map/get_independent_targets_bulk`.
- **Packaging**: new files are covered by `package_data` in `setup.py` (including `htdocs/assets/default_icons/*.svg` and `htdocs/assets/*.json`).

---

## Installation

To install the plugin, you need to execute the installation command inside the Prewikka container and then restart the service.

### Prerequisites
- The SIEM stack must be running.
- Access to the `gui` container (via docker/podman).

### Environment Setup

Before installing, you must ensure the plugin source code is accessible inside the `gui` container. The recommended way is to mount the plugin directory as a volume in your `docker-compose.yml`.

1. **Locate your `docker-compose.yml` file**.
2. **Find the `gui` service definition**.
3. **Add a volume mapping** linking your local plugin folder to the container's plugin directory:

   ```yaml
   services:
     gui:
       # ... other configurations
       volumes:
         - ./prewikka_apps_macro_map:/prewikka/prewikka_apps_macro_map:Z
         # ... other volumes
   ```

   *Note: Adjust the local path (`./prewikka_apps_macro_map`) if your repository structure is different.*

4. **Recreate the container** to apply the volume change:
   ```bash
   docker-compose up -d gui
   ```

### Manual Installation Steps

1. **Install the plugin inside the container**:
   Execute the `setup.py install` command within the running `gui` container.
   
   Using Docker Compose (v1):
   ```bash
   docker-compose exec gui sh -lc "cd /prewikka/prewikka_apps_macro_map && python3 setup.py install"
   ```
   
   Using Docker Compose (v2):
   ```bash
   docker compose exec gui sh -lc "cd /prewikka/prewikka_apps_macro_map && python3 setup.py install"
   ```

2. **Restart the GUI service**:
   Reload the service to apply the changes.

   Using Docker Compose (v1):
   ```bash
   docker-compose restart gui
   ```

   Using Docker Compose (v2):
   ```bash
   docker compose restart gui
   ```

3. **Verify Installation**:
   Check the logs to ensure the service started correctly.
   ```bash
   docker-compose logs --tail=30 gui
   ```

4. **Access the Plugin**:
   - Open your web browser and log in to the Prewikka interface.
   - Navigate to **Alerts** > **Macro Map** in the menu.
