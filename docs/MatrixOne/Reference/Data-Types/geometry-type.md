---
title: "Geometry Types"
doc_type: reference
mysql_compat: partial
differs_from_mysql: []
mo_only: false
since: v3.0.12
last_updated: 2026-05-19
llms_summary: "MatrixOne supports spatial geometry types (POINT, LINESTRING, POLYGON, etc.) defined by the OGC standard, with subtype validation on INSERT and UPDATE enforced since v3.0.12."
---

# Geometry Types

> MatrixOne supports spatial geometry types defined by the Open Geospatial Consortium (OGC) standard. Since v3.0.12, INSERT and UPDATE operations on geometry columns validate the geometry subtype at bind time, rejecting invalid geometries with an error instead of storing them silently.

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
GEOMETRY(POINT)
GEOMETRY(LINESTRING)
GEOMETRY(POLYGON)
...
```

A geometry column can be declared with or without a specific subtype constraint. When a subtype is specified (e.g., `GEOMETRY(POINT)`), only values of that exact subtype can be stored.

## Subtype Validation (since v3.0.12)

Starting from v3.0.12, INSERT and UPDATE operations on geometry columns validate the geometry subtype at bind time:

- When inserting into a subtype-constrained column (e.g., `GEOMETRY(POINT)`), the value is checked to ensure it matches the declared subtype.
- When inserting into an unconstrained `GEOMETRY` column, the value is validated to be a well-formed geometry of a recognized subtype.
- Invalid geometries are rejected with an error, rather than being stored silently as in previous versions.

### Example — Subtype validation

```sql
DROP DATABASE IF EXISTS geo_demo;
CREATE DATABASE geo_demo;
USE geo_demo;

CREATE TABLE geo_test (
    id INT PRIMARY KEY,
    shape GEOMETRY
);

-- Insert valid geometries
INSERT INTO geo_test VALUES (1, POINT(1, 2));
INSERT INTO geo_test VALUES (2, LINESTRING(POINT(0, 0), POINT(1, 1)));

SELECT id, ST_AsText(shape) FROM geo_test ORDER BY id;

-- Insert an invalid geometry string
-- Expected-Success: false
INSERT INTO geo_test VALUES (3, 'not_a_geometry');

DROP TABLE geo_test;
DROP DATABASE geo_demo;
```

### Example — Subtype-constrained column

```sql
DROP DATABASE IF EXISTS geo_point_demo;
CREATE DATABASE geo_point_demo;
USE geo_point_demo;

CREATE TABLE locations (
    id INT PRIMARY KEY,
    name VARCHAR(100),
    coord GEOMETRY(POINT)
);

INSERT INTO locations VALUES (1, 'Origin', POINT(0, 0));
INSERT INTO locations VALUES (2, 'Somewhere', POINT(12.34, 56.78));

SELECT id, name, ST_AsText(coord) FROM locations ORDER BY id;

DROP TABLE locations;
DROP DATABASE geo_point_demo;
```

## Notes

- Geometry functions (e.g., `ST_AsText`, `ST_GeomFromText`, `ST_Distance`) are available for working with geometry values.
- Geometry subtype validation is enforced at bind time only for INSERT and UPDATE. SELECT and LOAD DATA may have different validation behavior.
- For a complete list of spatial functions, see the [Functions and Operators](../Functions-and-Operators/README.md) reference.
