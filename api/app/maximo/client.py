from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings


@dataclass
class TenantAuth:
    manage_url: str
    api_key: str | None
    username: str | None
    password: str | None
    default_site: str | None


class MaximoClient:
    def __init__(self, auth: TenantAuth):
        self.auth = auth
        self.timeout = settings.maximo_request_timeout_seconds

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {"Accept": "application/json"}
        # MAS often supports API keys when using /maximo/api route.
        if self.auth.api_key:
            headers["apikey"] = self.auth.api_key
        return headers

    def _basic_auth(self):
        if self.auth.username and self.auth.password:
            return (self.auth.username, self.auth.password)
        return None

    async def get_api_home(self) -> dict[str, Any]:
        # /oslc or /api are common API roots.
        url = self.auth.manage_url.rstrip("/")
        candidates = [f"{url}/oslc", f"{url}/api"]
        async with httpx.AsyncClient(timeout=self.timeout, verify=True) as client:
            last_err = None
            for c in candidates:
                try:
                    r = await client.get(c, headers=self._headers(), auth=self._basic_auth())
                    r.raise_for_status()
                    return r.json()
                except Exception as e:
                    last_err = e
            raise RuntimeError(f"Unable to reach Maximo API home at {candidates}: {last_err}")

    async def get_oas(self, include_actions: bool = True) -> dict[str, Any]:
        # Dynamic OAS endpoint varies by system; IBM documents /oslc/oas with includeaction.
        url = self.auth.manage_url.rstrip("/")
        inc = "1" if include_actions else "0"
        candidates = [
            f"{url}/oslc/oas?includeaction={inc}",
            f"{url}/api/oas?includeaction={inc}",
        ]
        async with httpx.AsyncClient(timeout=self.timeout, verify=True) as client:
            last_err = None
            for c in candidates:
                try:
                    r = await client.get(c, headers=self._headers(), auth=self._basic_auth())
                    r.raise_for_status()
                    return r.json()
                except Exception as e:
                    last_err = e
            raise RuntimeError(f"Unable to fetch OAS at {candidates}: {last_err}")

    async def request(self, method: str, path: str, *, params: dict[str, Any] | None = None, json: Any | None = None) -> Any:
        base = self.auth.manage_url.rstrip("/")
        url = f"{base}/{path.lstrip('/')}"
        async with httpx.AsyncClient(timeout=self.timeout, verify=True) as client:
            r = await client.request(method.upper(), url, headers=self._headers(), auth=self._basic_auth(), params=params, json=json)
            r.raise_for_status()
            if r.status_code == 204:
                return None
            return r.json()
