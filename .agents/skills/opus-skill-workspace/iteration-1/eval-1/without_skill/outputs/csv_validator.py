import csv
import json
import os


def _resolve_nested(data, dotted_key):
    parts = dotted_key.split(".")
    current = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current


def _flatten_row(row, schema_properties):
    flat = {}
    for key in row:
        if key in schema_properties:
            flat[key] = row[key]
        else:
            flat[key] = row[key]
    return flat


def _coerce_type(value, schema_type):
    if value is None or value == "":
        return None
    try:
        if schema_type == "string":
            return str(value)
        elif schema_type == "integer":
            return int(value)
        elif schema_type == "number":
            return float(value)
        elif schema_type == "boolean":
            if isinstance(value, bool):
                return value
            if str(value).strip().lower() in ("true", "1", "yes"):
                return True
            if str(value).strip().lower() in ("false", "0", "no"):
                return False
            return bool(value)
        elif schema_type == "array":
            if isinstance(value, str):
                return json.loads(value)
            return list(value)
        elif schema_type == "object":
            if isinstance(value, str):
                return json.loads(value)
            return dict(value)
    except (ValueError, TypeError, json.JSONDecodeError):
        return value
    return value


def _validate_value(value, field_schema, path=""):
    errors = []

    if field_schema.get("type") == "array" and "items" in field_schema:
        coerced = _coerce_type(value, "array")
        if isinstance(coerced, list):
            for i, item in enumerate(coerced):
                sub_path = f"{path}[{i}]"
                item_schema = field_schema["items"]
                if isinstance(item_schema, dict):
                    errors.extend(_validate_value(item, item_schema, sub_path))
            return errors
        else:
            errors.append(f"{path}: expected array, got {type(value).__name__}")
            return errors

    if field_schema.get("type") == "object" and "properties" in field_schema:
        coerced = _coerce_type(value, "object")
        if isinstance(coerced, dict):
            for sub_key, sub_schema in field_schema["properties"].items():
                sub_path = f"{path}.{sub_key}" if path else sub_key
                sub_value = coerced.get(sub_key)
                errors.extend(_validate_value(sub_value, sub_schema, sub_path))
            return errors
        else:
            errors.append(f"{path}: expected object, got {type(value).__name__}")
            return errors

    expected_type = field_schema.get("type")
    if expected_type and expected_type not in ("array", "object"):
        coerced = _coerce_type(value, expected_type)
        if expected_type == "integer":
            if not isinstance(coerced, int) or isinstance(coerced, bool):
                errors.append(f"{path}: expected integer, got {type(value).__name__}")
        elif expected_type == "number":
            if not isinstance(coerced, (int, float)) or isinstance(coerced, bool):
                errors.append(f"{path}: expected number, got {type(value).__name__}")
        elif expected_type == "boolean":
            if not isinstance(coerced, bool):
                errors.append(f"{path}: expected boolean, got {type(value).__name__}")
        elif expected_type == "string":
            if not isinstance(coerced, str):
                errors.append(f"{path}: expected string, got {type(value).__name__}")

    if "minimum" in field_schema and value is not None and value != "":
        try:
            if float(value) < field_schema["minimum"]:
                errors.append(f"{path}: below minimum {field_schema['minimum']}")
        except (ValueError, TypeError):
            pass

    if "maximum" in field_schema and value is not None and value != "":
        try:
            if float(value) > field_schema["maximum"]:
                errors.append(f"{path}: above maximum {field_schema['maximum']}")
        except (ValueError, TypeError):
            pass

    if "minLength" in field_schema and isinstance(value, str):
        if len(value) < field_schema["minLength"]:
            errors.append(f"{path}: shorter than minLength {field_schema['minLength']}")

    if "maxLength" in field_schema and isinstance(value, str):
        if len(value) > field_schema["maxLength"]:
            errors.append(f"{path}: longer than maxLength {field_schema['maxLength']}")

    if "pattern" in field_schema and isinstance(value, str):
        import re
        if not re.match(field_schema["pattern"], value):
            errors.append(f"{path}: does not match pattern {field_schema['pattern']}")

    if "enum" in field_schema and value is not None and value != "":
        if str(value) not in [str(e) for e in field_schema["enum"]]:
            errors.append(f"{path}: not in enum {field_schema['enum']}")

    return errors


def _get_flattened_schema(schema, prefix=""):
    """Flatten a nested JSON schema into dot-notation properties for CSV columns."""
    props = {}
    properties = schema.get("properties", {})
    for key, value_schema in properties.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if value_schema.get("type") == "object" and "properties" in value_schema:
            nested = _get_flattened_schema(value_schema, full_key)
            props.update(nested)
            props[full_key] = value_schema
        else:
            props[full_key] = value_schema
    return props


def validate_csv(csv_path, schema, output_path=None, error_path=None, delimiter=","):
    """
    Validate a CSV file against a JSON schema.

    Parameters
    ----------
    csv_path : str
        Path to the input CSV file.
    schema : dict or str
        JSON schema dict, or path to a JSON schema file.
    output_path : str or None
        Path to write valid rows (CSV). If None, defaults to <csv_path>_valid.csv.
    error_path : str or None
        Path to write invalid rows with errors (CSV). If None, defaults to <csv_path>_errors.csv.
    delimiter : str
        CSV delimiter (default ',').

    Returns
    -------
    dict
        Summary with counts of valid/invalid rows.
    """
    if isinstance(schema, str):
        with open(schema, "r", encoding="utf-8") as f:
            schema = json.load(f)

    if output_path is None:
        base, ext = os.path.splitext(csv_path)
        output_path = f"{base}_valid.csv"

    if error_path is None:
        base, ext = os.path.splitext(csv_path)
        error_path = f"{base}_errors.csv"

    flat_schema = _get_flattened_schema(schema)
    required_fields = schema.get("required", [])
    all_properties = schema.get("properties", {})

    valid_rows = []
    invalid_rows = []

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        if reader.fieldnames is None:
            raise ValueError("CSV file is empty or has no headers")

        input_fieldnames = list(reader.fieldnames)

        for row_num, row in enumerate(reader, start=2):
            row_errors = []

            for req in required_fields:
                if req not in row or row[req] is None or str(row[req]).strip() == "":
                    row_errors.append(f"{req}: missing required field")

            for key, value in row.items():
                matched_schema = None
                if key in flat_schema:
                    matched_schema = flat_schema[key]
                elif key in all_properties:
                    matched_schema = all_properties[key]
                else:
                    continue

                if matched_schema:
                    row_errors.extend(
                        _validate_value(value, matched_schema, path=key)
                    )

            if row_errors:
                invalid_rows.append((row_num, row, "; ".join(row_errors)))
            else:
                valid_rows.append(row)

    fieldnames = input_fieldnames if input_fieldnames else []

    with open(output_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=delimiter)
        writer.writeheader()
        writer.writerows(valid_rows)

    error_fieldnames = list(fieldnames) + ["row_number", "errors"]
    with open(error_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=error_fieldnames, delimiter=delimiter)
        writer.writeheader()
        for row_num, row, err_msg in invalid_rows:
            out = dict(row)
            out["row_number"] = row_num
            out["errors"] = err_msg
            writer.writerow(out)

    return {
        "csv_path": csv_path,
        "output_path": output_path,
        "error_path": error_path,
        "total_rows": len(valid_rows) + len(invalid_rows),
        "valid_rows": len(valid_rows),
        "invalid_rows": len(invalid_rows),
    }
