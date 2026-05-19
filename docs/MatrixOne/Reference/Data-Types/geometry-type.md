---
title: "Geometry Types"
doc_type: reference
mysql_compat: partial
differs_from_mysql: []
mo_only: false
since: v3.0.12
last_updated: 2026-05-19
llms_summary: "MatrixOne supports spatial geometry types (POINT, LINESTRING, POLYGON, etc.) defined by the OGC standard, with subtype validation on INSERT and UPDATE."
---

# Geometry Types

> MatrixOne supports spatial geometry types defined by the Open Geospatial Consortium (OGC) standard. INSERT and UPDATE operations on geometry columns validate the geometry subtype at bind time, rejecting invalid geometries with an error.

## Supported Geometry Subtypes

MatrixOne supports the following geometry subtypes:

| Subtype | Description |
|---|---|
| `POINT` | A single point in 2D space |
| `LINESTRING` | A sequence of points forming a line |
| `POLYGON` | A closed polygon defined by an outer ring and optional inner rings |
| `MULTIPOINT` | A collection of points |
| `MULTILINESTRING` | A collection of linestrings |
| `MULTIPOLYGON` | A collection of polygons |
| `GEOMETRYCOLLECTION` | A collection of heterogeneous geometry objects |
| `GEOMETRY` | The base type that can hold any geometry subtype |

## Syntax

```
GEOMETRY
```

A column declared as `GEOMETRY` can store values of any supported geometry subtype (`POINT`, `LINESTRING`, `POLYGON`, `MULTIPOINT`, `MULTILINESTRING`, `MULTIPOLYGON`, `GEOMETRYCOLLECTION`). Use `ST_GeomFromText()` to create geometry values from Well-Known Text (WKT) format, and `ST_AsText()` to convert geometry values back to WKT for display.

## Subtype Validation

INSERT and UPDATE operations on geometry columns validate the geometry subtype at bind time:

- Each value is checked to ensure it is a well-formed geometry of a recognized subtype.
- Invalid geometries (malformed WKT, unsupported subtypes, or non-geometry strings) are rejected with an error.

## Examples

### Insert and query basic geometry subtypes

<!-- validator-ignore-exec -->
```sql
DROP DATABASE IF EXISTS geo_demo;
CREATE DATABASE geo_demo;
USE geo_demo;

CREATE TABLE geo_test (
    id INT PRIMARY KEY,
    shape GEOMETRY
);

INSERT INTO geo_test VALUES (1, ST_GeomFromText('POINT(1 2)'));
INSERT INTO geo_test VALUES (2, ST_GeomFromText('LINESTRING(0 0, 1 1, 2 0)'));
INSERT INTO geo_test VALUES (3, ST_GeomFromText('POLYGON((0 0, 1 0, 1 1, 0 0))'));

SELECT id, ST_AsText(shape) FROM geo_test ORDER BY id;

DROP TABLE geo_test;
DROP DATABASE geo_demo;
```

### Collection subtypes (MULTIPOINT, MULTILINESTRING, MULTIPOLYGON, GEOMETRYCOLLECTION)

<!-- validator-ignore-exec -->
```sql
DROP DATABASE IF EXISTS geo_collection_demo;
CREATE DATABASE geo_collection_demo;
USE geo_collection_demo;

CREATE TABLE geo_col (
    id INT PRIMARY KEY,
    shape GEOMETRY
);

INSERT INTO geo_col VALUES (1, ST_GeomFromText('MULTIPOINT(0 0, 1 1, 2 2)'));
INSERT INTO geo_col VALUES (2, ST_GeomFromText('MULTILINESTRING((0 0, 1 1), (2 2, 3 3))'));
INSERT INTO geo_col VALUES (3, ST_GeomFromText('MULTIPOLYGON(((0 0, 1 0, 1 1, 0 0)), ((2 2, 3 2, 3 3, 2 2)))'));
INSERT INTO geo_col VALUES (4, ST_GeomFromText('GEOMETRYCOLLECTION(POINT(1 2), LINESTRING(0 0, 1 1))'));

SELECT id, ST_AsText(shape) FROM geo_col ORDER BY id;

DROP TABLE geo_col;
DROP DATABASE geo_collection_demo;
```

### Empty geometry and NULL values

<!-- validator-ignore-exec -->
```sql
DROP DATABASE IF EXISTS geo_null_demo;
CREATE DATABASE geo_null_demo;
USE geo_null_demo;

CREATE TABLE geo_null (
    id INT PRIMARY KEY,
    shape GEOMETRY
);

INSERT INTO geo_null VALUES (1, ST_GeomFromText('POINT EMPTY'));
INSERT INTO geo_null VALUES (2, ST_GeomFromText('LINESTRING EMPTY'));
INSERT INTO geo_null VALUES (3, ST_GeomFromText('POLYGON EMPTY'));
INSERT INTO geo_null VALUES (4, ST_GeomFromText('MULTIPOINT EMPTY'));
INSERT INTO geo_null VALUES (5, ST_GeomFromText('GEOMETRYCOLLECTION EMPTY'));
INSERT INTO geo_null VALUES (6, NULL);

SELECT id, ST_AsText(shape) FROM geo_null ORDER BY id;

DROP TABLE geo_null;
DROP DATABASE geo_null_demo;
```

### Validation: non-geometry string and malformed WKT are rejected

<!-- validator-ignore-exec -->
```sql
DROP DATABASE IF EXISTS geo_validation_demo;
CREATE DATABASE geo_validation_demo;
USE geo_validation_demo;

CREATE TABLE geo_val (
    id INT PRIMARY KEY,
    shape GEOMETRY
);

-- A plain non-geometry string is rejected
-- Expected-Success: false
INSERT INTO geo_val VALUES (1, 'not_a_geometry');

-- Malformed WKT is rejected
-- Expected-Success: false
INSERT INTO geo_val VALUES (2, ST_GeomFromText('POINT(1)'));

-- WKT with unsupported structure is rejected
-- Expected-Success: false
INSERT INTO geo_val VALUES (3, ST_GeomFromText('CIRCLE(1 2, 3)'));

INSERT INTO geo_val VALUES (4, ST_GeomFromText('POINT(5 6)'));

SELECT id, ST_AsText(shape) FROM geo_val ORDER BY id;

DROP TABLE geo_val;
DROP DATABASE geo_validation_demo;
```

## Functions

The following geometry functions are available:

| Function | Description |
|---|---|
| `ST_GeomFromText(wkt)` | Creates a geometry value from a WKT string (e.g., `'POINT(1 2)'`) |
| `ST_GeomFromText(wkt, srid)` | Creates a geometry value from a WKT string with a spatial reference ID |
| `ST_AsText(geom)` | Converts a geometry value to its WKT string representation |

Additional spatial analysis functions (e.g., `ST_Distance`, `ST_Area`, `ST_Contains`) are available. See the spatial functions reference for the complete list.

## Notes

- Geometry subtype validation is enforced at bind time for INSERT and UPDATE. SELECT and LOAD DATA may have different validation behavior.
- WKT coordinate values use spaces as separators between x and y (e.g., `POINT(1 2)`, not `POINT(1, 2)`). Commas separate points within multi-point geometries (e.g., `LINESTRING(0 0, 1 1)`).
- Empty geometries use the keyword `EMPTY` (e.g., `POINT EMPTY`, `LINESTRING EMPTY`).
