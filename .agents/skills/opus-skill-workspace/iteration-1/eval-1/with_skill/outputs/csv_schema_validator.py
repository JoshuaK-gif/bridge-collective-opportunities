#!/usr/bin/env python3
"""CSV Schema Validator - validate CSV data against a JSON Schema.

Reads a CSV file, validates each row against a JSON Schema,
writes valid rows to an output CSV and invalid rows (with error messages)
to a separate error file. Supports nested fields via dot-notation in
column headers (e.g., ``address.city``) and automatic type coercion from
CSV string values to schema-declared types.

Usage:
    python csv_schema_validator.py input.csv schema.json
    python csv_schema_validator.py input.csv schema.json -o valid.csv -e errors.csv --no-coerce
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import jsonschema
from jsonschema import ValidationError


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate CSV data against a JSON Schema."
    )
    parser.add_argument("csv", type=Path, help="Path to input CSV file")
    parser.add_argument("schema", type=Path, help="Path to JSON Schema file")
    parser.add_argument(
        "-o", "--output", type=Path, default=None,
        help="Output path for valid rows CSV (default: <input>_valid.csv)"
    )
    parser.add_argument(
        "-e", "--errors", type=Path, default=None,
        help="Output path for invalid rows CSV (default: <input>_errors.csv)"
    )
    parser.add_argument(
        "--no-coerce", action="store_true",
        help="Disable automatic type coercion of CSV string values"
    )
    parser.add_argument(
        "--delimiter", default=",",
        help="CSV delimiter character (default: comma)"
    )
    return parser.parse_args(argv)


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

def load_schema(path: Path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def read_csv(path: Path, delimiter: str = ",") -> Tuple[List[str], List[Dict[str, str]]]:
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        headers: List[str] = reader.fieldnames or []
        rows: List[Dict[str, str]] = list(reader)
    return headers, rows


def write_outputs(
    valid_rows: List[Dict[str, str]],
    invalid_rows: List[Dict[str, str]],
    headers: List[str],
    output_path: Path,
    errors_path: Path,
    delimiter: str = ",",
) -> None:
    error_column = "errors"
    seen = set(headers)
    error_headers = headers + ([error_column] if error_column not in seen else [])

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, delimiter=delimiter, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(valid_rows)

    with open(errors_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=error_headers, delimiter=delimiter, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(invalid_rows)


# ---------------------------------------------------------------------------
# Dot-notation expansion
# ---------------------------------------------------------------------------

def expand_row(row: Dict[str, str]) -> Dict[str, Any]:
    """Convert dot-notation keys into nested dictionaries.

    ``{"user.name": "Alice", "user.address.city": "NYC"}`` →
    ``{"user": {"name": "Alice", "address": {"city": "NYC"}}}``
    """
    result: Dict[str, Any] = {}
    for key, value in row.items():
        if key is None:
            continue
        parts = key.split(".")
        target = result
        for part in parts[:-1]:
            if part not in target:
                target[part] = {}
            target = target[part]
        target[parts[-1]] = value
    return result


# ---------------------------------------------------------------------------
# Type coercion
# ---------------------------------------------------------------------------

def _coerce_value(value: str, schema: Dict[str, Any]) -> Any:
    """Convert a CSV string to the Python type declared in *schema*."""
    if not value or value.strip() == "":
        return value

    schema_type = schema.get("type")
    if schema_type == "integer":
        try:
            return int(value)
        except (ValueError, TypeError):
            return value
    elif schema_type == "number":
        try:
            return float(value)
        except (ValueError, TypeError):
            return value
    elif schema_type == "boolean":
        v = value.strip().lower()
        if v in ("true", "1", "yes"):
            return True
        if v in ("false", "0", "no"):
            return False
        return value
    return value


def coerce_row(data: Dict[str, Any], schema: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively coerce values in *data* according to *schema* type declarations."""
    result: Dict[str, Any] = {}
    schema_type = schema.get("type")
    properties = schema.get("properties", {})

    if schema_type == "object" and properties:
        for key, value in data.items():
            prop_schema = properties.get(key, {})
            if isinstance(value, dict):
                result[key] = coerce_row(value, prop_schema)
            else:
                result[key] = _coerce_value(str(value) if value is not None else "", prop_schema)
    else:
        for key, value in data.items():
            result[key] = _coerce_value(str(value) if value is not None else "", {}) if isinstance(value, str) else value

    return result


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_row(
    row: Dict[str, str],
    schema: Dict[str, Any],
    coerce: bool = True,
) -> Tuple[bool, Optional[str]]:
    expanded = expand_row(row)
    if coerce:
        expanded = coerce_row(expanded, schema)

    try:
        jsonschema.validate(expanded, schema)
        return True, None
    except ValidationError as exc:
        return False, exc.message


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)

    if not args.csv.exists():
        print(f"Error: CSV file not found: {args.csv}", file=sys.stderr)
        return 1
    if not args.schema.exists():
        print(f"Error: Schema file not found: {args.schema}", file=sys.stderr)
        return 1

    stem = args.csv.stem
    output_path = args.output or args.csv.with_name(f"{stem}_valid.csv")
    errors_path = args.errors or args.csv.with_name(f"{stem}_errors.csv")

    schema = load_schema(args.schema)
    headers, rows = read_csv(args.csv, args.delimiter)

    if not headers:
        print("Error: CSV has no headers", file=sys.stderr)
        return 1

    valid_rows: List[Dict[str, str]] = []
    invalid_rows: List[Dict[str, str]] = []

    for row in rows:
        is_valid, err_msg = validate_row(row, schema, coerce=not args.no_coerce)
        if is_valid:
            valid_rows.append(row)
        else:
            row["errors"] = err_msg or "Unknown validation error"
            invalid_rows.append(row)

    write_outputs(
        valid_rows, invalid_rows, headers,
        output_path, errors_path,
        delimiter=args.delimiter,
    )

    print(f"Valid rows:   {len(valid_rows)}  -> {output_path}")
    print(f"Invalid rows: {len(invalid_rows)} -> {errors_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
