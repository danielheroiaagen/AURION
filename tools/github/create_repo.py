#!/usr/bin/env python3
"""Create a GitHub repository for AURION using the GitHub REST API.

The script is intentionally dependency-free and safe by default: without
`--execute`, it prints the request that would be sent and does not touch GitHub.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Any


GITHUB_API_URL = "https://api.github.com"
REPO_NAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


def validate_repo_name(name: str) -> str:
    """Validate a GitHub repository name before sending anything over the wire."""
    if not REPO_NAME_PATTERN.fullmatch(name):
        raise ValueError(
            "Repository name must be 1-100 chars and only use letters, numbers, dot, dash, or underscore."
        )
    if name in {".", ".."} or name.startswith(".") and name.count(".") == len(name):
        raise ValueError("Repository name cannot be a path-like value.")
    return name


def build_payload(
    *,
    name: str,
    description: str | None,
    private: bool,
    homepage: str | None = None,
) -> dict[str, Any]:
    """Build the GitHub create-repository payload with professional defaults."""
    validate_repo_name(name)
    payload: dict[str, Any] = {
        "name": name,
        "private": private,
        "description": description or "",
        "homepage": homepage or "",
        "has_issues": True,
        "has_projects": True,
        "has_wiki": False,
        "auto_init": False,
        "delete_branch_on_merge": True,
        "allow_squash_merge": True,
        "allow_merge_commit": False,
        "allow_rebase_merge": True,
    }
    return payload


def resolve_token() -> str:
    """Read a GitHub token from the environment."""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        raise RuntimeError("Missing GITHUB_TOKEN or GH_TOKEN environment variable.")
    return token


def build_request(
    *,
    token: str,
    payload: dict[str, Any],
    org: str | None = None,
) -> urllib.request.Request:
    """Build the HTTP request for user or organization repository creation."""
    endpoint = f"{GITHUB_API_URL}/orgs/{org}/repos" if org else f"{GITHUB_API_URL}/user/repos"
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(endpoint, data=data, method="POST")
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("Accept", "application/vnd.github+json")
    request.add_header("Content-Type", "application/json")
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    return request


def create_repository(
    *,
    token: str,
    payload: dict[str, Any],
    org: str | None = None,
) -> dict[str, Any]:
    """Create the repository and return GitHub's JSON response."""
    request = build_request(token=token, payload=payload, org=org)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            if response.status != 201:
                raise RuntimeError(f"GitHub returned unexpected status {response.status}: {body}")
            return json.loads(body)
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API error {error.code}: {details}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not reach GitHub API: {error.reason}") from error


def set_origin(remote_url: str) -> None:
    """Set the local Git origin remote when requested."""
    existing = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        capture_output=True,
        text=True,
        check=False,
    )
    if existing.returncode == 0:
        subprocess.run(["git", "remote", "set-url", "origin", remote_url], check=True)
    else:
        subprocess.run(["git", "remote", "add", "origin", remote_url], check=True)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a GitHub repository for AURION.")
    parser.add_argument("name", help="Repository name, for example AURION.")
    parser.add_argument("--description", default="AURION Voice Agent SaaS Core documentation and product foundation.")
    parser.add_argument("--homepage", default=None)
    parser.add_argument("--org", default=None, help="GitHub organization. Omit to create under the authenticated user.")
    parser.add_argument("--public", action="store_true", help="Create a public repository. Default is private.")
    parser.add_argument("--execute", action="store_true", help="Actually call GitHub. Without this, runs as dry-run.")
    parser.add_argument("--set-origin", action="store_true", help="Set local git origin to the created repository clone URL.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    payload = build_payload(
        name=args.name,
        description=args.description,
        private=not args.public,
        homepage=args.homepage,
    )

    if not args.execute:
        endpoint = f"{GITHUB_API_URL}/orgs/{args.org}/repos" if args.org else f"{GITHUB_API_URL}/user/repos"
        print("DRY RUN: no GitHub repository was created.")
        print(f"Endpoint: POST {endpoint}")
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0

    token = resolve_token()
    repo = create_repository(token=token, payload=payload, org=args.org)
    print(f"Created repository: {repo['full_name']}")
    print(f"URL: {repo['html_url']}")
    print(f"Clone URL: {repo['clone_url']}")

    if args.set_origin:
        set_origin(repo["clone_url"])
        print("Local git origin configured.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

