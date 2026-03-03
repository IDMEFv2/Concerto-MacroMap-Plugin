# Macro Map – Import File Guide

This document describes the structure and rules of the data used to import assets into the Macro Map.

It explains **which fields are required**, **what they represent**, and **which values are allowed**.

**Important: the upload is supported only in CSV format.**  
A sample template is provided both as CSV and XLSX: the XLSX version is available only for convenience (for example, to edit the data using spreadsheet software) and must be exported or converted to CSV before uploading.

---

## Supported Upload Format

- **Upload format:** CSV only
- **Sample templates provided:**
  - **CSV** – ready to be uploaded without modifications
  - **XLSX** – provided for editing convenience only; must be converted to CSV before upload

All validation rules described in this document apply to the data structure itself, regardless of how the template was initially edited.

---

This structure is identical across all supported file formats.

---

## Field Details

### Name
- **Description:** Display name of the asset shown on the map
- **Type:** Text
- **Rules:**
  - Must not be empty

---

### Town
- **Description:** City or town name where the asset is located
- **Type:** Text
- **Rules:**
  - Must not be empty

---

### Latitude
- **Description:** Geographic latitude of the asset
- **Type:** Number
- **Rules:**
  - Must be a valid number
  - Range: **-90 to 90**

---

### Longitude
- **Description:** Geographic longitude of the asset
- **Type:** Number
- **Rules:**
  - Must be a valid number
  - Range: **-180 to 180**

---

### Icon
- **Description:** Icon type used to represent the asset on the map
- **Type:** Text
- **Rules:**
  - Currently not validated against the list at import time
  - Must match one of the available icon types (case-sensitive)
- **Available values:**
  - `Administration`
  - `Airport`
  - `Bank`
  - `Hospital`
  - `Industry`
  - `Nuclear`
  - `Port`
  - `Radar`
  - `Telecom`
  - `Water`
  - `Drone`

---

### MarkerSize
- **Description:** Size of the marker icon in pixels
- **Type:** Integer
- **Rules:**
  - Must be an integer
  - Must be greater than or equal to **0**

---

### NamePosition
- **Description:** Position of the name label relative to the marker
- **Type:** Enum
- **Allowed values:**
  - `Up`
  - `Down`
  - `Left`
  - `Right`

---

### NameVisibleZoom
- **Description:** Minimum zoom level at which the name label becomes visible
- **Type:** Integer
- **Rules:**
  - Must be an integer
  - Range: **3 to 12**

---

### BadgePosition
- **Description:** Position of the badge relative to the marker
- **Type:** Enum
- **Allowed values:**
  - `Up`
  - `Down`
  - `Left`
  - `Right`

---

### BadgeVisibleZoom
- **Description:** Minimum zoom level at which the badge becomes visible
- **Type:** Integer
- **Rules:**
  - Must be an integer
  - Range: **3 to 12**

---

### EntityName
- **Description:** Logical identifier of the asset used to associate alerts and rules
- **Type:** Text
- **Rules:**
  - Must not be empty
  - Must match the entity name used by the alerting system
  - Used internally to retrieve alerts and apply color rules

---

### LinksTo
- **Description:** Comma-separated list of `EntityName` values that this asset is visually connected to on the map (infrastructure links drawn as lines)
- **Type:** Text (optional)
- **Rules:**
  - Not validated at import time
  - Can be empty (leave the field blank or use `""`)
  - Each value must correspond to the `EntityName` of another asset present on the map; unresolved names are silently ignored
- **Example:** `Entity A,Entity B`

---

### Nationality
- **Description:** Country or region code used to display a flag badge on the marker icon
- **Type:** Text (optional)
- **Rules:**
  - Not validated at import time
  - Can be empty (leave the field blank)
  - Should follow the ISO 3166-1 alpha-2 standard (e.g. `fr`, `us`, `de`, `it`), but exceptions are allowed for special regions, organizations, or subnational flags if present in the system
  - If the code does not correspond to an available flag image, the badge is automatically hidden
- **Notable exceptions:**
  - `eu` (European Union)
  - `asean` (ASEAN)
  - `arab` (Arab League)
  - `un` (United Nations)
  - `gb-eng`, `gb-sct`, `gb-wls`, `gb-nir` (UK subnational flags)
  - `es-ct`, `es-ga`, `es-pv` (Spanish regions)
  - Other codes as present in the `assets/Flags` directory
- **Example:** `fr`, `eu`, `un`, `gb-eng`

---

## Zoom Levels Explained

Zoom levels define **when** labels and badges appear on the map.

**Important rule:**

> A higher zoom value means **more detail** (you are closer to the map).

**Examples:**
- Zoom 3: continent-level view
- Zoom 5: country-level view
- Zoom 7: regional view
- Zoom 10: city-level view

---

## Valid Values Summary

| Field             | Type     | Valid Values / Rules                             |
|-------------------|----------|--------------------------------------------------|
| Name              | Text     | Non-empty                                        |
| Town              | Text     | Non-empty                                        |
| Latitude          | Number   | -90 to 90                                        |
| Longitude         | Number   | -180 to 180                                      |
| Icon              | Text     | Administration, Airport, Bank, Hospital, Industry, Nuclear, Port, Radar, Telecom, Water, Drone |
| MarkerSize        | Integer  | ≥ 0                                              |
| NamePosition      | Enum     | Up, Down, Left, Right                            |
| NameVisibleZoom   | Integer  | 3 to 12                                          |
| BadgePosition     | Enum     | Up, Down, Left, Right                            |
| BadgeVisibleZoom  | Integer  | 3 to 12                                          |
| EntityName        | Text     | Non-empty, valid alert entity identifier         |
| LinksTo           | Text     | Comma-separated list of EntityName values, can be an empty string |
| Nationality       | Text     | ISO 3166-1 alpha-2 country code (e.g. `fr`)      |

---

## Common Errors

- Missing or misspelled field names
- Empty `Name`, `Town`, or `EntityName` field
- Latitude or Longitude outside the valid range
- Invalid enum values (e.g. `UP` instead of `Up`)
- Non-integer zoom values
- `LinksTo` referencing an `EntityName` not present on the map (silently ignored at runtime, but the link will not be drawn)
- `Nationality` using an invalid or unsupported country code (the flag badge will be hidden automatically)

If any validation error is detected, the import is rejected.
