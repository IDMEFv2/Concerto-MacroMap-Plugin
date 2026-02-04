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

### 4. Data Management & Import
- **CSV Upload**: Bulk import entity definitions (Name, Coordinates, Type) using a CSV file.
- **Templates**: Download sample CSV and XLSX templates to get started quickly.
- **Guide**: Built-in guide (Markdown) available for download.

### 5. Context Actions
Right-click or interact with markers to:
- **Go to Alerts**: Navigate to the standard alert listing filtered for that specific entity.
- **Edit Rules**: Open the rule editor for that entity.
- **Delete**: Remove the marker from the map.

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
