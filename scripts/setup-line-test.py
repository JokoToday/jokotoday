#!/usr/bin/env python3
"""Create LINE OAuth2 on the isolated test project; secrets stay in memory."""
import getpass
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = "szijiljpasxddzgzckra"
BASE = f"https://{PROJECT}.supabase.co"
CALLBACK = f"{BASE}/auth/v1/callback"

def request(method, url, token, data=None, apikey=None):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    if apikey:
        headers["apikey"] = apikey
    req = urllib.request.Request(url, method=method, headers=headers,
        data=None if data is None else json.dumps(data).encode())
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # Never dump responses, request bodies, tokens or credentials.
        raise SystemExit(f"Setup stopped: HTTP {error.code}; credentials were not printed.")
    except urllib.error.URLError:
        raise SystemExit("Setup stopped: network error; no credentials were printed.")

def main():
    if not sys.stdin.isatty():
        raise SystemExit("Run interactively in your trusted terminal; do not pipe secrets.")
    print(f"Target: JOKO Specials Test ({PROJECT}). Production is untouched.")
    print(f"Add this callback to the LINE Login channel, keeping existing callbacks:\n{CALLBACK}")
    client_id = input("LINE Login channel ID: ").strip()
    if not client_id.isdigit():
        raise SystemExit("Expected a numeric LINE Login channel ID.")
    secret = getpass.getpass("LINE Login channel secret (hidden): ").strip()
    if not secret:
        raise SystemExit("No secret supplied; nothing changed.")
    management = Path("/home/nerd/.supabase/access-token").read_text().strip()
    keys = request("GET", f"https://api.supabase.com/v1/projects/{PROJECT}/api-keys", management)
    service = next((key["api_key"] for key in keys if key.get("name") == "service_role"), None)
    if not service:
        raise SystemExit("Test service role key unavailable; nothing changed.")
    admin = f"{BASE}/auth/v1/admin/custom-providers"
    existing = request("GET", admin, service, apikey=service)
    if any(p.get("identifier") == "custom:line" for p in existing.get("providers", [])):
        raise SystemExit("custom:line already exists; refusing to overwrite it.")
    payload = dict(provider_type="oauth2", identifier="custom:line", name="LINE",
        client_id=client_id, client_secret=secret, enabled=True, email_optional=True,
        pkce_enabled=True, scopes=["openid", "profile"],
        authorization_url="https://access.line.me/oauth2/v2.1/authorize",
        token_url="https://api.line.me/oauth2/v2.1/token",
        userinfo_url="https://api.line.me/oauth2/v2.1/userinfo",
        jwks_uri="https://access.line.me/.well-known/jwks.json")
    result = request("POST", admin, service, payload, service)
    if result.get("identifier") != "custom:line" or not result.get("enabled"):
        raise SystemExit("Unexpected provider result; inspect test dashboard before retrying.")
    print("Test LINE OAuth2 provider enabled. No issuer URL is needed for OAuth2.")
    print("Use a test preview built with VITE_ENABLE_LINE_LOGIN=true.")
    print("Only enable VITE_ENABLE_LINE_LINKING=true when testing account linking.")

if __name__ == "__main__":
    main()
