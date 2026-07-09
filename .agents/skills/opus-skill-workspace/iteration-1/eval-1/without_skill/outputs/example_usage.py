"""Example usage of csv_validator."""

import json
import os
from csv_validator import validate_csv

script_dir = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(script_dir, "example.csv")
schema_path = os.path.join(script_dir, "example_schema.json")
output_path = os.path.join(script_dir, "example_output_valid.csv")
error_path = os.path.join(script_dir, "example_output_errors.csv")

summary = validate_csv(
    csv_path=csv_path,
    schema=schema_path,
    output_path=output_path,
    error_path=error_path,
    delimiter=",",
)

print(json.dumps(summary, indent=2))
