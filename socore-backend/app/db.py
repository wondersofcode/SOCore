"""
Database layer — Supabase (Postgres).

Replaces the in-memory store so alerts/cases/decisions survive a backend
restart. Uses psycopg2 with a small connection pool; JSON-shaped fields
(sources, proposedAction, tags, tasks, notes, alertIds) are stored as JSONB
columns so the rest of the codebase can keep passing around plain dicts/lists
without an ORM layer in between.
"""
from __future__ import annotations

import json
import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2.pool import SimpleConnectionPool

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

_pool: SimpleConnectionPool | None = None


def is_configured() -> bool:
    return bool(DATABASE_URL)


def _get_pool() -> SimpleConnectionPool:
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not set")
        _pool = SimpleConnectionPool(1, 10, dsn=DATABASE_URL)
    return _pool


@contextmanager
def get_cursor(commit: bool = False):
    """Yield a RealDictCursor from the pool; commits and returns the
    connection when the block exits cleanly."""
    pool = _get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


SCHEMA = """
CREATE TABLE IF NOT EXISTS alerts (
    id              TEXT PRIMARY KEY,
    timestamp       TEXT NOT NULL,
    severity        TEXT NOT NULL,
    source_ip       TEXT NOT NULL,
    attack_type     TEXT NOT NULL,
    mitre_id        TEXT,
    mitre_name      TEXT,
    status          TEXT NOT NULL,
    analyst         TEXT NOT NULL DEFAULT 'Unassigned',
    raw             TEXT,
    vt_score        INTEGER NOT NULL DEFAULT 0,
    abuse_score     INTEGER NOT NULL DEFAULT 0,
    country         TEXT,
    asn             TEXT,
    detected_at     TEXT,
    enriched_at     TEXT,
    responded_at    TEXT,
    risk_score      INTEGER NOT NULL DEFAULT 0,
    ai_explanation  TEXT,
    ai_confidence   INTEGER NOT NULL DEFAULT 0,
    proposed_action JSONB,
    approval_status TEXT NOT NULL DEFAULT 'None',
    sources         JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The raw Wazuh event, kept independent of whatever Alert it may or may not
-- become. alert_id is nullable: not every event is (yet) turned into an
-- alert, and this table is the append-only history layer either way.
CREATE TABLE IF NOT EXISTS events (
    id                TEXT PRIMARY KEY,
    timestamp         TEXT NOT NULL,
    source_ip         TEXT NOT NULL,
    rule_id           TEXT,
    rule_level        INTEGER NOT NULL DEFAULT 0,
    rule_description  TEXT,
    raw               TEXT,
    agent_id          TEXT,
    agent_name        TEXT,
    alert_id          TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_alert_id ON events (alert_id);

CREATE TABLE IF NOT EXISTS cases (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    severity     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'Open',
    assigned_to  TEXT NOT NULL DEFAULT 'Unassigned',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    alert_ids    JSONB NOT NULL DEFAULT '[]',
    risk_score   INTEGER NOT NULL DEFAULT 0,
    summary      TEXT,
    tags         JSONB NOT NULL DEFAULT '[]',
    tasks        JSONB NOT NULL DEFAULT '[]',
    notes        JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS decisions (
    seq       SERIAL PRIMARY KEY,
    alert_id  TEXT NOT NULL,
    status    TEXT NOT NULL,
    by_whom   TEXT NOT NULL,
    at        TEXT NOT NULL,
    reason    TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'analyst',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Simulation Center: controlled detection-validation test runs. The
-- simulation *definitions* live in code (simulation_catalog.py) as a fixed
-- allowlist — this table only records what an analyst actually ran and,
-- later, what the evaluator observed. Nothing here is ever written to mark
-- a PASS without a matching event_id/alert_id also being recorded.
CREATE TABLE IF NOT EXISTS simulation_runs (
    id                          TEXT PRIMARY KEY,
    simulation_id               TEXT NOT NULL,
    simulation_name             TEXT NOT NULL,
    technique_id                TEXT NOT NULL,
    technique_name              TEXT,
    tactic_id                   TEXT,
    tactic_name                 TEXT,
    platform                    TEXT,
    objective                   TEXT,
    status                      TEXT NOT NULL DEFAULT 'running',
    source_hint                 TEXT,
    window_seconds              INTEGER NOT NULL DEFAULT 300,
    started_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_by                  TEXT NOT NULL,
    started_by_id               TEXT NOT NULL,
    executed_at                 TIMESTAMPTZ,
    completed_at                TIMESTAMPTZ,
    detection_event_id          TEXT,
    detection_alert_id          TEXT,
    detection_latency_seconds   INTEGER,
    notes                       TEXT
);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_technique ON simulation_runs (technique_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_status ON simulation_runs (status);

-- Backs AlertStore._next_seq_id: one row per (prefix, day), incremented with
-- a single atomic UPSERT so two near-simultaneous requests (e.g. Wazuh
-- forwarding the same event twice) can never be handed the same next id —
-- unlike deriving it from MAX(id) in the target table, which reads and
-- writes in separate statements and races.
CREATE TABLE IF NOT EXISTS id_counters (
    prefix_day TEXT PRIMARY KEY,
    seq        INTEGER NOT NULL DEFAULT 0
);
"""

# Additive migrations against tables that may already exist in production
# with data — CREATE TABLE IF NOT EXISTS above won't add a column to an
# existing table, so new alert columns land here instead. Each statement is
# idempotent and safe to run on every startup.
MIGRATIONS = """
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source_event_id TEXT;
"""


def init_schema() -> None:
    """Create tables if they don't exist yet, then apply additive column
    migrations. Safe to call on every startup."""
    with get_cursor(commit=True) as cur:
        cur.execute(SCHEMA)
        cur.execute(MIGRATIONS)
