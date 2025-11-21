from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

# This is a lightweight service layer skeleton for the Model Registry.
# It should be connected to your database layer (e.g. asyncpg, SQLAlchemy) and storage provider (Supabase storage).


class ModelCreate(BaseModel):
    name: str
    description: Optional[str] = None
    model_type: Optional[str] = "classification"
    framework: Optional[str] = "sklearn"
    owner_id: Optional[str]


class ModelVersionCreate(BaseModel):
    model_id: str
    version: str
    description: Optional[str] = None
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    tags: Optional[List[str]] = []


# Mock in-memory store for development; replace with DB calls
_models: Dict[str, Dict[str, Any]] = {}
_versions: Dict[str, List[Dict[str, Any]]] = {}


def list_models(owner_id: Optional[str] = None) -> List[Dict[str, Any]]:
    # TODO: replace with real DB query
    if owner_id:
        return [m for m in _models.values() if m.get("owner_id") == owner_id]
    return list(_models.values())


def create_model(payload: ModelCreate) -> Dict[str, Any]:
    model_id = f"model_{len(_models) + 1}"
    model = {
        "id": model_id,
        "name": payload.name,
        "description": payload.description,
        "model_type": payload.model_type,
        "framework": payload.framework,
        "owner_id": payload.owner_id,
        "uploaded_at": datetime.utcnow().isoformat(),
        "file_path": None,
        "file_size": 0,
    }
    _models[model_id] = model
    _versions[model_id] = []
    return model


def get_model(model_id: str) -> Optional[Dict[str, Any]]:
    return _models.get(model_id)


def create_model_version(payload: ModelVersionCreate) -> Dict[str, Any]:
    version_id = f"{payload.model_id}-v{len(_versions.get(payload.model_id, [])) + 1}"
    version = {
        "id": version_id,
        "model_id": payload.model_id,
        "version": payload.version,
        "description": payload.description,
        "file_path": payload.file_path,
        "file_size": payload.file_size,
        "tags": payload.tags or [],
        "is_production": False,
        "is_archived": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    _versions.setdefault(payload.model_id, []).append(version)
    # update model latest
    if payload.model_id in _models:
        _models[payload.model_id]["file_path"] = payload.file_path
        _models[payload.model_id]["file_size"] = payload.file_size or 0
    return version


def list_versions(model_id: str) -> List[Dict[str, Any]]:
    return _versions.get(model_id, [])


def promote_version_to_production(model_id: str, version: str) -> bool:
    versions = _versions.get(model_id, [])
    for v in versions:
        if v["version"] == version:
            v["is_production"] = True
        else:
            v["is_production"] = False
    if model_id in _models:
        _models[model_id]["production_version"] = version
        return True
    return False
