1. Installation
==============
No extra steps should be required to install this plugin

2. Implemented features
==============
- A static map that uses leaflet.js and konva.js to display assets that have been added to the database by the user.
- Integration with the SQL database to save the assets, settings and icons added by the user.
- A tenant system that only shows each user their own icons and markers.
- Functions to add, modify and delete the markers placed on the map.
- Custom buttons used to save and return to the starting position set by the user.
- A date picker that allows the user to control the time frame the map displays (by default it shows one month).
- New markers can be added through a modal by simply clicking on the map.
- Markers can be modified or deleted through a modal by clicking on them.
- Icons in svg format can be added by the user through a button in the top right corner of the map.

3. Known bugs and imperfections
==============
- There are currently no controls made on the data sent by the various modals to the database, these will be implemented in future versions.
- The date picker in the bottom left corner of the map changes the date correctly but the time only changes visually at the moment.
- A function intended to refresh the map automatically is present in the code, it is however not currently used, as there is likely a better way to do it.