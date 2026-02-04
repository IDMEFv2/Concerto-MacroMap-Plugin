# from prewikka import version
# from prewikka.database import SQLScript


# class SQLUpdate(SQLScript):
#     type = "install"
#     branch = version.__branch__
#     version = "0"

#     def run(self):
#         self.query("""
# DROP TABLE IF EXISTS Prewikka_macrovisualization_settings;

# CREATE TABLE Prewikka_macrovisualization_settings (
#         id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
#         user_id VARCHAR(255) NOT NULL,
#         saved_position_lat VARCHAR(255) NOT NULL,
#         saved_position_lng VARCHAR(255) NOT NULL,
#         saved_zoom VARCHAR(255) NOT NULL
# ) ENGINE=InnoDB;

# DROP TABLE IF EXISTS Prewikka_macrovisualization_assets;

# CREATE TABLE Prewikka_macrovisualization_assets (
#         id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
#         user_id VARCHAR(255) NOT NULL,
#         asset_name VARCHAR(255) NOT NULL,
#         icon_type VARCHAR(255) NOT NULL,
#         asset_ip VARCHAR(255) NOT NULL,
#         lat VARCHAR(255) NOT NULL,
#         lng VARCHAR(255) NOT NULL
# ) ENGINE=InnoDB;

# DROP TABLE IF EXISTS Prewikka_macrovisualization_icons;

# CREATE TABLE Prewikka_macrovisualization_icons (
#         id BIGINT UNSIGNED NOT NULL PRIMARY KEY AUTO_INCREMENT,
#         user_id VARCHAR(255),
#         is_default BOOLEAN NOT NULL,
#         class_name VARCHAR(255) NOT NULL,
#         html TEXT NOT NULL
# ) ENGINE=InnoDB;

# INSERT INTO Prewikka_macrovisualization_icons (is_default, class_name, html)
# VALUES 
#   (
#         TRUE, 
#         'Building', 
#         '<svg width=''24'' height=''24'' stroke=''black'' stroke-width=''0.5'' xmlns=''http://www.w3.org/2000/svg'' fill-rule=''evenodd'' clip-rule=''evenodd''><path fill=''${fillColor}'' d=''M13 2h2v2h1v19h1v-15l6 3v12h1v1h-24v-1h1v-11h7v11h1v-19h1v-2h2v-2h1v2zm8 21v-2h-2v2h2zm-15 0v-2h-3v2h3zm8 0v-2h-3v2h3zm-2-4v-13h-1v13h1zm9 0v-1h-2v1h2zm-18 0v-2h-1v2h1zm4 0v-2h-1v2h1zm-2 0v-2h-1v2h1zm9 0v-13h-1v13h1zm7-2v-1h-2v1h2zm0-2.139v-1h-2v1h2z''/></svg>'
#   ),
#   (
#         TRUE,
#         'Nuclear plant',
#         '<svg width=''24'' height=''24'' stroke=''black'' stroke-width=''0.5'' xmlns=''http://www.w3.org/2000/svg'' fill-rule=''evenodd'' clip-rule=''evenodd''><path fill=''${fillColor}'' d=''M24 24h-24v-2h1c2.996-4.904 3.945-12.985 4-16h7c.054 2.94 1.005 10.982 4 16h1.742l-.642-1.093c-1.195-2.145-1.948-4.546-2.501-6.924.268-1.659.385-3.106.401-3.983h5c.04 2.205.753 8.236 3 12h1v2zm-18.287-6h2l-1.167 3 4.167-5h-2l1.167-3-4.167 5zm12.924-12.915c.238-.522.759-.885 1.363-.885s1.125.363 1.363.885c.154-.08.328-.125.512-.125.621 0 1.125.511 1.125 1.14 0 .629-.504 1.14-1.125 1.14-.184 0-.358-.045-.512-.125-.238.522-.759.885-1.363.885s-1.125-.363-1.363-.885c-.154.08-.328.125-.512.125-.621 0-1.125-.511-1.125-1.14 0-.629.504-1.14 1.125-1.14.184 0 .358.045.512.125zm-10.637-.085c.198-2.182 1.785-4 3.5-4 .246 0 .478.059.683.164.316-.687 1.011-1.164 1.817-1.164s1.501.477 1.817 1.164c.205-.105.437-.164.683-.164.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5c-.246 0-.478-.059-.683-.164-.316.687-1.011 1.164-1.817 1.164-2.345 0-3.722-2.951-5 0h-1z''/></svg>'
#   ),
#   (
#         TRUE, 
#         'Factory', 
#         '<svg xmlns=''http://www.w3.org/2000/svg'' width=''24'' height=''24'' fill-rule=''evenodd'' clip-rule=''evenodd''><path d=''M24 24h-24v-18h5v9l7-6v3.704l-1.828 1.529.642.767 3.367-2.817 3.819-3.183v3.713l-1.816 1.52.641.767 4.602-3.85-.003-.004 2.576-2.146v15zm-18-6h-2v3h2v-3zm10 0h-2v3h2v-3zm-5 0h-2v3h2v-3zm10 0h-2v3h2v-3zm-18-13h-1c.198-2.182 1.785-4 3.5-4 .246 0 .478.059.683.164.316-.687 1.011-1.164 1.817-1.164s1.501.477 1.817 1.164c.205-.105.437-.164.683-.164.828 0 1.5.672 1.5 1.5s-.672 1.5-1.5 1.5c-.246 0-.478-.059-.683-.164-.316.687-1.011 1.164-1.817 1.164-2.345 0-3.722-2.951-5 0z'' fill=''${fillColor}'' stroke=''black'' stroke-width=''0.5''/></svg>'
#   ),
#   (
#         TRUE, 
#         'Airport', 
#         '<svg width=''24'' height=''24'' stroke=''black'' stroke-width=''0.5''  xmlns=''http://www.w3.org/2000/svg'' fill-rule=''evenodd'' clip-rule=''evenodd''><path fill=''${fillColor}'' d=''M22 1h-2v1h4v5l-2 2v13h2v2h-24v-2h2v-9h12v-4l-2-2v-5h4v-1h-2v-1h8v1zm-13 18h-3v4h3v-4zm5 0h-4v4h4v-4zm4 0h-3v4h3v-4zm-2-15h-2v2l1 1h1v-3zm3 0h-2v3h2v-3zm3 0h-2v3h1l1-1v-2z''/></svg>'
#   ),
#   (
#         TRUE, 
#         'Hospital', 
#         '<svg width=''24'' height=''24'' stroke=''black'' stroke-width=''0.5''  xmlns=''http://www.w3.org/2000/svg'' fill-rule=''evenodd'' clip-rule=''evenodd''><path fill=''${fillColor}'' d=''M24 24h-24v-2h1v-13c1.793-1.211 3.484-2.153 5.116-2.826.534 2.743 2.997 4.864 5.961 4.826 2.914-.037 5.314-2.167 5.814-4.855 1.636.675 3.324 1.627 5.109 2.855v13h1v2zm-14-1h4v-4h-4v4zm-5 0h4v-4h-4v4zm10 0h4v-4h-4v4zm-10-6h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm-12-3h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm4 0h2v-2h-2v2zm-5-14c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5m1 2h-2v2h-2v2h2v2h2v-2h2v-2h-2v-2z''/></svg>'
#   ),
#   (
#         TRUE, 
#         'Central Soc', 
#         '<svg fill=''black'' height=''24'' width=''24'' version=''1.1'' id=''Capa_1'' xmlns=''http://www.w3.org/2000/svg'' xmlns:xlink=''http://www.w3.org/1999/xlink'' viewBox=''0 0 346.163 346.163'' xml:space=''preserve''><g id=''SVGRepo_bgCarrier'' stroke-width=''0''></g><g id=''SVGRepo_tracerCarrier'' stroke-linecap=''round'' stroke-linejoin=''round''></g><g id=''SVGRepo_iconCarrier''> <g> <g id=''Layer_5_49_''> <g> <g> <path  stroke=''black'' stroke-width=''2'' fill=''${fillColor}'' d=''M49.089,108.977c-2.602,0-5.171-1.19-6.838-3.442c-2.793-3.773-1.999-9.096,1.773-11.89l46.88-34.71 c3.773-2.793,9.096-1.999,11.89,1.773c2.794,3.773,1.999,9.096-1.773,11.89l-46.88,34.71 C52.619,108.434,50.846,108.977,49.089,108.977z''></path> </g> <g> <path fill=''${fillColor}''  stroke=''black'' stroke-width=''2'' d=''M53.72,153.587c-2.664,0-5.287-1.248-6.944-3.588c-2.713-3.831-1.807-9.136,2.023-11.849l100.449-71.145 c3.833-2.712,9.136-1.807,11.85,2.024c2.713,3.831,1.807,9.136-2.023,11.849L58.626,152.023 C57.134,153.08,55.418,153.587,53.72,153.587z''></path> </g> <path fill=''${fillColor}'' stroke=''black'' stroke-width=''10'' d=''M331.933,10.229H14.23C6.403,10.229,0,16.633,0,24.46v101.953v49v93.857c0,7.827,6.403,14.231,14.23,14.231h115.985 c0,0,4.153-0.249,4.153,3.813c0,4.734,0,15.766,0,21.313c0,2.017-0.152,3.308-2.527,3.308c-7.555,0-30.219,0-30.219,0 c-6.627,0-12,5.373-12,12c0,6.628,5.373,12,12,12h142.92c6.627,0,12-5.372,12-12c0-6.627-5.373-12-12-12c0,0-22.765,0-30.492,0 c-1.75,0-2.254-1.064-2.254-2.287c0-4.985,0-17.819,0-23.021c0-3.188,2.982-3.126,2.982-3.126h117.154 c7.827,0,14.231-6.404,14.231-14.231V24.46C346.164,16.633,339.76,10.229,331.933,10.229z M187.796,287.377 c0,5.042,0,17.203,0,21.979c0,1.146-0.58,2.496-2.33,2.496c-6.297,0-18.027,0-24.813,0c-2.188,0-2.285-1.152-2.285-2.975 c0-5.393,0-16.658,0-21.313c0-3.125,3.723-3.237,3.723-3.237h22.563C184.653,284.327,187.796,284.127,187.796,287.377z M173.082,267.765c-7.734,0-14.003-6.27-14.003-14.003c0-7.734,6.269-14.003,14.003-14.003c7.733,0,14.003,6.269,14.003,14.003 C187.085,261.495,180.815,267.765,173.082,267.765z M325.217,213.728c0,7.827-6.404,14.231-14.23,14.231H35.177 c-7.827,0-14.23-6.404-14.23-14.231V47.983c0-7.827,6.403-14.231,14.23-14.231h275.81c7.826,0,14.23,6.404,14.23,14.231V213.728z ''></path> </g> </g> </g> </g></svg>'
#   );
# """)