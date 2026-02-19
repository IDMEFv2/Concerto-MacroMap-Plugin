# Prewikka Macro Map Plugin

This plugin provides a geospatial visualization layer for IDMEFv2 alerts within the Concerto SIEM (Prewikka) interface. It places monitored entities on an interactive map and visualizes their alert status in real-time.

## Features

### 1. Interactive Map Visualization
- **Entities**: Displays critical infrastructure dependencies (Airports, Buildings, Nuclear Plants) on a Leaflet-based map.
- **Status Badges**: Each entity displays a badge summarising the count of active alerts by severity (High, Medium, Low, Info).
- **Tooltips**: Hovering over entities displays the **Town** name.

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
- **CSV Upload**: Bulk import entity definitions (Name, Coordinates, Type) using a CSV file.
- **Templates**: Download sample CSV and XLSX templates to get started quickly.
- **Guide**: Built-in guide (Markdown) available for download.
- **Server-side Validation**: Comprehensive CSV validation with detailed error messages for each row and field.
- **Supported Fields**: Name, Town, Latitude, Longitude, Icon, MarkerSize, NamePosition, NameVisibleZoom, BadgePosition, BadgeVisibleZoom, EntityName.

### 6. Persistent State Management
- **Auto-save**: The plugin automatically saves the current map state, including all entities, rules, and custom configurations.
- **Session Recovery**: Map position, zoom level, and all entities are restored when revisiting the page.
- **Manual Reset**: Clear all data and start fresh using the "Reset Map" option in Global Settings.
- **File-based Storage**: Map state is persisted in `/tmp/prewikka_macro_map/map_state.json`.

### 7. Map Position Controls
- **Reset Position**: Instantly return to the default map view (Europe-centered).
- **Set Default Position**: Save the current map view (center and zoom) as the new default position.
- **Boundary Constraints**: Map panning is limited to prevent excessive navigation outside the monitored region.

### 8. Zoom-based Visibility
- **Smart Label Display**: Entity names appear only when zooming in beyond a configurable threshold (3-12).
- **Badge Visibility Control**: Alert count badges can be configured to show/hide at specific zoom levels.
- **Related Icon Visibility**: Drones and other related icons have independent zoom thresholds for optimal visibility.

### 9. Context Actions
Right-click or interact with markers to:
- **Go to Alerts**: Navigate to the standard alert listing filtered for that specific entity.
- **Edit Rules**: Open the rule editor for that entity.
- **Delete**: Remove the marker from the map.

### 10. Global Settings
Access advanced configuration through the settings modal:
- **Vector History Tracking**: Configure the maximum number of past drone positions to display.
- **Data Management**: Permanently delete all markers and rules to reset the map.

### 11. Time-based Filtering
- **Automatic Synchronization**: Alert queries respect the Prewikka global time range selector.
- **Dynamic Updates**: Changing the time range automatically refreshes entity alert counts and vector positions.

### 12. Multiple Icon Types
Supports various infrastructure types with distinct visual representations:
- **Airport**: Aviation facilities
- **Building**: Generic infrastructure
- **Nuclear Plant**: Critical energy facilities
- **Drone**: Tracked vectors/threats

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
