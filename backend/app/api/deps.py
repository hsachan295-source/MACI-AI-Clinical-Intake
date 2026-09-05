"""FastAPI dependencies."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.repositories import get_repository
from app.repositories.base import BaseRepository


def get_repo() -> BaseRepository:
    return get_repository()


RepoDep = Annotated[BaseRepository, Depends(get_repo)]
