#!/usr/bin/env python3
"""Read-only Supabase account/project and PostgreSQL schema inspector.

This tool intentionally has no write, migration, delete, or arbitrary SQL command.
Use a scoped Supabase Management API token. Database inspection only runs fixed
catalog queries and starts a read-only PostgreSQL transaction.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

API_BASE = "https://api.supabase.com/v1"
PROJECT_REF = re.compile(r"^[a-z0-9]{10,30}$")


class SupabaseError(RuntimeError):
    """Safe-to-display Supabase integration error."""


def _management_request(path: str) -> Any:
    token = os.getenv("SUPABASE_ACCESS_TOKEN", "").strip()
    if not token:
        raise SupabaseError("SUPABASE_ACCESS_TOKEN is not configured.")
    if not path.startswith("/") or ".." in path:
        raise SupabaseError("Invalid Management API path.")
    request = urllib.request.Request(
        API_BASE + path,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": "ORDIUM-Supabase-Manager/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code in (401, 403):
            raise SupabaseError(f"Supabase Management API authorization failed (HTTP {exc.code}); check token scope.") from None
        if exc.code == 429:
            raise SupabaseError("Supabase Management API rate limit reached; retry later.") from None
        raise SupabaseError(f"Supabase Management API request failed (HTTP {exc.code}).") from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise SupabaseError("Could not reach or decode the Supabase Management API response.") from None


def list_projects() -> list[dict[str, Any]]:
    """List projects visible to the configured scoped token."""
    data = _management_request("/projects")
    if not isinstance(data, list):
        raise SupabaseError("Unexpected project-list response.")
    fields = ("id", "name", "organization_id", "region", "status", "created_at")
    return [{key: item[key] for key in fields if key in item}
            for item in data if isinstance(item, dict)]


def get_project(project_ref: str) -> dict[str, Any]:
    """Return a deliberately small, non-secret project summary."""
    if not PROJECT_REF.fullmatch(project_ref):
        raise SupabaseError("Invalid project reference format.")
    item = _management_request(f"/projects/{project_ref}")
    if not isinstance(item, dict):
        raise SupabaseError("Unexpected project-detail response.")
    keys = ("id", "name", "organization_id", "region", "status", "created_at")
    return {key: item[key] for key in keys if key in item}


def _database_urls() -> dict[str, str]:
    file_path = os.getenv("SUPABASE_DB_URLS_FILE", "").strip()
    raw = os.getenv("SUPABASE_DB_URLS_JSON", "").strip()
    try:
        if file_path:
            # Keep the file outside the repository and restrict its permissions to root/agent.
            raw = Path(file_path).read_text(encoding="utf-8")
        if not raw:
            return {}
        value = json.loads(raw)
    except (OSError, json.JSONDecodeError):
        raise SupabaseError("Could not read/parse Supabase database connection mapping.") from None
    if not isinstance(value, dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in value.items()):
        raise SupabaseError("Database connection mapping must be an object of project refs to connection strings.")
    return value


def inspect_database(project_ref: str) -> dict[str, Any]:
    """List public-schema tables and columns; never reads application table rows."""
    if not PROJECT_REF.fullmatch(project_ref):
        raise SupabaseError("Invalid project reference format.")
    conninfo = _database_urls().get(project_ref)
    if not conninfo:
        raise SupabaseError(f"No database connection is configured for project {project_ref}.")
    try:
        import psycopg
        from psycopg.conninfo import make_conninfo
    except ImportError:
        raise SupabaseError("Database inspection requires psycopg; install the agent requirements.") from None

    safe_conninfo = make_conninfo(
        conninfo, sslmode="require", connect_timeout=8,
        application_name="ordium-supabase-inspector",
    )
    try:
        with psycopg.connect(safe_conninfo) as conn:
            with conn.transaction():
                conn.execute("SET TRANSACTION READ ONLY")
                table_rows = conn.execute(
                    "SELECT table_name FROM information_schema.tables "
                    "WHERE table_schema = %s AND table_type = %s ORDER BY table_name",
                    ("public", "BASE TABLE"),
                ).fetchall()
                tables = []
                for (table_name,) in table_rows:
                    column_rows = conn.execute(
                        "SELECT column_name, data_type, is_nullable "
                        "FROM information_schema.columns "
                        "WHERE table_schema = %s AND table_name = %s "
                        "ORDER BY ordinal_position",
                        ("public", table_name),
                    ).fetchall()
                    tables.append({
                        "table": table_name,
                        "columns": [
                            {"name": name, "type": data_type, "nullable": nullable == "YES"}
                            for name, data_type, nullable in column_rows
                        ],
                    })
        return {"project_ref": project_ref, "schema": "public", "table_count": len(tables), "tables": tables}
    except Exception as exc:
        # Never include connection details or driver exception text in output.
        raise SupabaseError(
            f"Read-only database inspection failed ({type(exc).__name__}). "
            "Check network access, credentials, and SSL."
        ) from None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only Supabase account and database inspector")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("projects", help="List projects visible to SUPABASE_ACCESS_TOKEN")
    project_parser = sub.add_parser("project", help="Show non-secret project details")
    project_parser.add_argument("project_ref")
    db_parser = sub.add_parser("inspect-db", help="List public tables and columns using a read-only DB connection")
    db_parser.add_argument("project_ref")
    args = parser.parse_args(argv)
    try:
        if args.command == "projects":
            result = list_projects()
        elif args.command == "project":
            result = get_project(args.project_ref)
        else:
            result = inspect_database(args.project_ref)
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        return 0
    except SupabaseError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
