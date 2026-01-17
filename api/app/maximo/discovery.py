from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ObjectField:
    name: str
    type: str
    format: str | None
    required: bool


@dataclass
class ObjectRelationship:
    name: str
    target: str
    cardinality: str  # one|many


@dataclass
class ObjectSchema:
    name: str
    fields: list[ObjectField]
    relationships: list[ObjectRelationship]


def _resolve_ref(ref: str) -> str:
    # common OpenAPI v2 + v3-ish refs
    return ref.split("/")[-1]


def parse_oas(oas: dict[str, Any]) -> dict[str, Any]:
    """Parse Maximo's dynamic OAS into an index.

    We extract:
      - objects (schemas/definitions)
      - fields and relationship-like refs
      - actions (paths containing /action/ or operationId patterns)

    This supports relationship import by detecting $ref or array(items.$ref) in schemas.
    """

    defs = oas.get("definitions") or oas.get("components", {}).get("schemas") or {}

    objects: dict[str, Any] = {}
    for obj_name, obj_def in defs.items():
        required = set(obj_def.get("required") or [])
        props = obj_def.get("properties") or {}

        fields: list[dict[str, Any]] = []
        rels: list[dict[str, Any]] = []

        for prop_name, prop_def in props.items():
            # Relationship detection
            if "$ref" in prop_def:
                rels.append({"name": prop_name, "target": _resolve_ref(prop_def["$ref"]), "cardinality": "one"})
                continue
            if prop_def.get("type") == "array" and isinstance(prop_def.get("items"), dict) and "$ref" in prop_def["items"]:
                rels.append({"name": prop_name, "target": _resolve_ref(prop_def["items"]["$ref"]), "cardinality": "many"})
                continue

            f_type = prop_def.get("type") or ("object" if "properties" in prop_def else "unknown")
            fields.append(
                {
                    "name": prop_name,
                    "type": f_type,
                    "format": prop_def.get("format"),
                    "required": prop_name in required,
                }
            )

        objects[obj_name] = {
            "name": obj_name,
            "fields": fields,
            "relationships": rels,
        }

    # Actions: heuristic
    actions: list[dict[str, Any]] = []
    for path, ops in (oas.get("paths") or {}).items():
        for method, op in (ops or {}).items():
            if method.lower() not in {"get", "post", "put", "patch", "delete"}:
                continue
            operation_id = op.get("operationId")
            if "/action" in path or (operation_id and "action" in operation_id.lower()):
                actions.append(
                    {
                        "path": path,
                        "method": method.upper(),
                        "operationId": operation_id,
                        "summary": op.get("summary") or op.get("description"),
                    }
                )

    return {"objects": objects, "actions": actions, "oas_version": oas.get("swagger") or oas.get("openapi")}
