1. Installation  
==============  
- Download the repository and run   
```bash
python setup.py install
```
- Restart Prewikka
- Open the GUI, navigate to the "?" menu and open "Apps"
- Click on the "Install update" button in the "Plugin Maintenance" tab  
- You can now find the plugin in the Alert section

2. Implemented features  
==============  
- A static map that uses leaflet.js and konva.js to display assets that have been added to the database by the user.
- Integration with the SQL database to save the assets, settings and icons added by the user.
- A tenant system that only shows each user their own icons and markers.
- Functions to add, modify and delete the markers placed on the map.
- Custom buttons used to save and return to the starting position set by the user.
- A date picker that allows the user to control the time frame the map displays (shared with the Alerts table).
- New markers can be added through a modal by simply clicking on the map.
- Markers can be modified or deleted through a modal by clicking on them.
- Icons in svg format can be added by the user through a button in the top right corner of the map.
- Two modes: View and Edit. The map starts in View Mode which only allows to move around and view the assets. In edit mode the user can place new markers, edit existing ones and add new icons.

3. Known bugs and imperfections  
==============  
- A function intended to refresh the map automatically is present in the code, it is however not currently used, as there is likely a better way to do it.
