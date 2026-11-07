"""Credentials: a .env file plus Schwab's OAuth refresh flow. Stdlib + requests only.

.env is found by walking up from the current directory, so one file at the repo root serves
every strategy. Values already set in the real environment win over the file.

Schwab tokens: an access token lives ~30 minutes, a refresh token ~7 days. Store the app key,
secret and refresh token; every run trades the refresh token for a fresh access token.
`python -m ironfly schwab-login` gets a new refresh token (once a week) and writes it to .env.
"""
from __future__ import annotations
import os
import re
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

import requests

AUTH_URL = "https://api.schwabapi.com/v1/oauth/authorize"
TOKEN_URL = "https://api.schwabapi.com/v1/oauth/token"
DEFAULT_CALLBACK = "https://127.0.0.1"


def find_env(start: Path | None = None) -> Path | None:
    for d in [(start or Path.cwd()).resolve(), *(start or Path.cwd()).resolve().parents]:
        if (d / ".env").is_file():
            return d / ".env"
    return None


def load_env(path: Path | None = None) -> Path | None:
    """Load KEY=VALUE lines into os.environ without overriding existing variables."""
    path = path or find_env()
    if not path:
        return None
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip().removeprefix("export ").strip(), v.strip().strip('"').strip("'")
        if k and v and k not in os.environ:
            os.environ[k] = v
    return path


def set_env_var(path: Path, key: str, value: str) -> None:
    """Replace KEY=... in the file, or append it. Other lines are left untouched."""
    text = path.read_text() if path.exists() else ""
    line = f"{key}={value}"
    if re.search(rf"^\s*{re.escape(key)}\s*=.*$", text, flags=re.M):
        text = re.sub(rf"^\s*{re.escape(key)}\s*=.*$", lambda _: line, text, count=1, flags=re.M)
    else:
        text = text + ("" if text.endswith("\n") or not text else "\n") + line + "\n"
    path.write_text(text)
    os.chmod(path, 0o600)


def callback_code(redirected_url: str) -> str:
    """Pull the authorization code out of the URL the browser was redirected to."""
    code = parse_qs(urlparse(redirected_url.strip()).query).get("code", [None])[0]
    if not code:
        raise ValueError("no ?code= in that URL; copy the full address bar after approving")
    return code


def _app() -> tuple[str, str, str]:
    key, secret = os.environ.get("SCHWAB_APP_KEY"), os.environ.get("SCHWAB_APP_SECRET")
    if not (key and secret):
        raise RuntimeError("Set SCHWAB_APP_KEY and SCHWAB_APP_SECRET in .env (from developer.schwab.com, your app's page).")
    return key, secret, os.environ.get("SCHWAB_CALLBACK_URL", DEFAULT_CALLBACK)


def _token_request(data: dict) -> dict:
    key, secret, _ = _app()
    r = requests.post(TOKEN_URL, data=data, auth=(key, secret), timeout=30,
                      headers={"Content-Type": "application/x-www-form-urlencoded"})
    if r.status_code != 200:
        raise RuntimeError(f"Schwab token request failed ({r.status_code}): {r.text[:300]}")
    return r.json()


def schwab_access_token() -> str:
    """SCHWAB_ACCESS_TOKEN if set (manual override), else a fresh one from the refresh token.
    If Schwab rotates the refresh token, the new one is written back to .env."""
    load_env()
    if os.environ.get("SCHWAB_ACCESS_TOKEN"):
        return os.environ["SCHWAB_ACCESS_TOKEN"]
    refresh = os.environ.get("SCHWAB_REFRESH_TOKEN")
    if not refresh:
        raise RuntimeError("No Schwab credentials. Copy .env.example to .env, fill in the app key and secret, "
                           "then run: python -m ironfly schwab-login")
    try:
        j = _token_request({"grant_type": "refresh_token", "refresh_token": refresh})
    except RuntimeError as e:
        raise RuntimeError(f"{e}\nThe refresh token lasts about 7 days. Run: python -m ironfly schwab-login") from None
    new = j.get("refresh_token")
    if new and new != refresh and (path := find_env()):
        set_env_var(path, "SCHWAB_REFRESH_TOKEN", new)
        os.environ["SCHWAB_REFRESH_TOKEN"] = new
    return j["access_token"]


def schwab_login() -> None:
    """Interactive: open the Schwab consent page, paste back the redirect URL, store the refresh token."""
    load_env()
    key, _, callback = _app()
    path = find_env()
    if path is None:
        raise RuntimeError("No .env found. Copy .env.example to .env at the repo root first.")
    print("1. Open this URL, log in to Schwab and approve the app:\n")
    print(f"   {AUTH_URL}?client_id={quote(key)}&redirect_uri={quote(callback, safe='')}\n")
    print(f"2. The browser is sent to {callback}/?code=... and shows an error page. That is expected.")
    print("   Copy the full address from the address bar and paste it here (the code expires in ~30 s).\n")
    code = callback_code(input("Redirected URL: "))
    j = _token_request({"grant_type": "authorization_code", "code": code, "redirect_uri": callback})
    set_env_var(path, "SCHWAB_REFRESH_TOKEN", j["refresh_token"])
    print(f"\nSaved a new refresh token to {path}. It lasts about 7 days; rerun schwab-login after that.")
