# Prewikka Macro Map Plugin

This plugin provides a geospatial visualization layer for IDMEFv2 alerts within the Concerto SIEM (Prewikka) interface. It places monitored entities on an interactive map and visualizes their alert status in real-time.

## Features

### 1. Interactive Map Visualization
- **Entities**: Displays critical infrastructure assets (Airports, Banks, Hospitals, Nuclear Plants, Ports, and more) on a Leaflet-based map.
- **Status Badges**: Each entity displays a badge summarising the count of active alerts by severity (High, Medium, Low, Info). Badges can be independently positioned (Up, Down, Left, Right) relative to the marker.
- **Name Labels**: Each entity can display a name label, independently positioned relative to the marker.
- **Tooltips**: Hovering over entities displays a rich tooltip showing the entity **Name**, **Town**, and a summary of active alert counts by severity.
- **Flag Badges**: Entities with a `Nationality` code display a country/organisation flag badge overlaid on the marker icon.
- **Infrastructure Links**: Entities can be connected by visual lines on the map using the `LinksTo` field, representing infrastructure dependencies.

### 2. Dynamic Alert Visualization
- **Color Coding**: Entity icons change color (e.g., Green, Yellow, Red) dynamically based on configurable rules.
- **Vector Tracking**: Automatically visualizes specific vectors, such as **Drones**, when detected in alerts associated with a monitored entity. The drone appears near the target entity.

### 3. Custom Rule Engine
Users can define rules directly from the UI to control entity appearance:
- **Percentage Rules**: Change color if High/Medium/Low alerts exceed a certain percentage of total alerts (e.g., "Turn Red if High Priority alerts >= 50%").
- **Regex Rules**: Change color if an alert description matches a specific keyword (e.g., "Turn Red if description contains 'Drone'").
- **Rule Priority**: Rules are evaluated from top to bottom; the first matching rule determines the icon color.
- **Dynamic Editing**: Rules can be added, modified, or deleted in real-time with immediate visual feedback.

### 4. Advanced Vector Tracking
- **Drone Path History**: Visualizes the movement history of detected drones with a configurable trail length.
- **Position Trail**: Historical drone positions are shown with reduced opacity and connect to the target entity via dashed lines.
- **Real-time Updates**: Drone positions update automatically based on incoming alert data within the selected time range.
- **Configurable History**: Set the maximum number of past positions to display (default: 10).

### 5. Data Management & Import
- **CSV Upload**: Bulk import entity definitions using a CSV file (semicolon-delimited).
- **Quick Start Presets**: Load built-in use-case presets from the upload modal with one click.
- **Templates**: Download sample CSV and XLSX templates to get started quickly.
- **Guide**: Built-in Markdown guide available for download, describing all fields and validation rules.
- **Server-side Validation**: Comprehensive CSV validation with detailed error messages for each row and field.
- **Supported Fields**:

  | Field | Description |
  |---|---|
  | `Name` | Display name shown on the map |
  | `Town` | City/town where the asset is located |
  | `Latitude` | Geographic latitude (-90 to 90) |
  | `Longitude` | Geographic longitude (-180 to 180) |
  | `Icon` | Icon type (see [Icon Types](#12-multiple-icon-types)) |
  | `MarkerSize` | Marker size in pixels (≥ 0) |
  | `NamePosition` | Name label position: `Up`, `Down`, `Left`, `Right` |
  | `NameVisibleZoom` | Minimum zoom level to show the name (3–12) |
  | `BadgePosition` | Alert badge position: `Up`, `Down`, `Left`, `Right` |
  | `BadgeVisibleZoom` | Minimum zoom level to show the badge (3–12) |
  | `EntityName` | Logical identifier used to associate alerts |
  | `LinksTo` | Comma-separated `EntityName` values to draw infrastructure links to |
  | `Nationality` | Country/region code for the flag badge (ISO 3166-1 alpha-2 or exceptions such as `eu`, `un`) |

### 6. Persistent State Management
- **Auto-save**: The plugin automatically saves the current map state (entities, rules, global settings, and map position) after every change.
- **Server-side Recovery**: Map position, zoom level, entities, and rules are fully restored from `/tmp/prewikka_macro_map/map_state.json` when revisiting the page.
- **Browser-side Last View**: The last visited map position (center + zoom) is also stored in the browser's `localStorage` and used to restore the viewport immediately on load, before the server state is fetched.
- **Manual Reset**: Clear all data and start fresh using the "Reset Map" option in Global Settings.
- **File-based Storage**: Map state is persisted server-side in `/tmp/prewikka_macro_map/map_state.json`.

### 7. Map Position Controls
- **Reset Position**: Instantly return to the default map view (Europe-centered).
- **Set Default Position**: Save the current map view (center and zoom) as the new default position.
- **Boundary Constraints**: Map panning is limited to prevent excessive navigation outside the monitored region.

### 8. Zoom-based Visibility
- **Smart Label Display**: Entity names appear only when zooming in beyond a configurable threshold (3-12).
- **Badge Visibility Control**: Alert count badges can be configured to show/hide at specific zoom levels.
- **Related Icon Visibility**: Drones and other related icons have independent zoom thresholds for optimal visibility.

### 9. Context Actions
Clicking a marker opens a context menu with the following options:
- **Search > Go to alerts table**: Navigate to the standard alert listing pre-filtered for that specific entity and alert type.
- **Marker settings > Edit color rules**: Open the rule editor for that entity.
- **Actions > Center map on entity**: Pan the map to centre on the selected entity.
- **Actions > Center and zoom map on entity**: Pan to the selected entity and apply a focused zoom level.
- **Actions > Delete marker**: Remove the marker from the map.

### 10. Global Settings
Access advanced configuration through the settings modal:

**Vector History Tracking**
- **Enable history tracking**: Toggle drone position trail recording on or off.
- **Max past positions**: Configure the maximum number of past drone positions to display (default: 10).

**Visual Settings**
- **Show entity names**: Globally toggle visibility of all entity name labels.
- **Show alerts display**: Globally toggle visibility of all alert count badges.
- **Apply global entity size**: Force a shared icon size for all entities.
- **Global size**: Set the icon size value (in pixels) when global size is enabled.

**Data Management**
- **Restore initial map position**: Reset the map view to the original system default (Europe-centred, zoom 5), discarding any saved custom default.
- **Reset Map**: Permanently delete all markers, rules, and state — cannot be undone.

### 11. Time-based Filtering
- **Automatic Synchronization**: Alert queries respect the Prewikka global time range selector.
- **Dynamic Updates**: Changing the time range automatically refreshes entity alert counts and vector positions.

### 12. Multiple Icon Types
Supports the following infrastructure types with distinct SVG icons:

| Icon name | Description |
|---|---|
| `Administration` | Administrative/government facilities |
| `Airport` | Aviation facilities |
| `Bank` | Financial institutions |
| `Hospital` | Healthcare facilities |
| `Industry` | Industrial sites |
| `Nuclear` | Nuclear energy facilities |
| `Port` | Maritime port facilities |
| `Radar` | Radar/surveillance installations |
| `Telecom` | Telecommunications infrastructure |
| `Water` | Water treatment/supply facilities |
| `Drone` | Tracked vectors/threats (used for related icons) |

### 13. Infrastructure Links
- **Visual connections**: Entities can be linked on the map with lines representing infrastructure dependencies, configured via the `LinksTo` CSV field.
- **Automatic rendering**: Links are redrawn automatically after every state change.
- **Multi-target**: A single entity can link to multiple targets using a comma-separated list of `EntityName` values.

### 14. Nationality & Flag Badges
- **Flag overlay**: Each marker can display a small flag badge (bottom-left corner) using the `Nationality` field.
- **Standard codes**: Supports ISO 3166-1 alpha-2 country codes (e.g. `fr`, `us`, `de`).
- **Extended codes**: Also supports organisation and subnational codes present in the flag assets (e.g. `eu`, `un`, `asean`, `arab`, `gb-eng`, `es-ct`).
- **Graceful fallback**: If the code has no matching flag image, the badge is silently hidden.

### 15. Testing Resources (Development)
- **Resources modal**: A development-only modal is available from the map controls to open external testing references.

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
