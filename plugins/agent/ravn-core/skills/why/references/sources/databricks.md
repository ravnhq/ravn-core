# Databricks Analytics & System Tables

The product-analytics, data-pipeline, and warehouse-telemetry layer. It complements Datadog: Datadog is the *infra/runtime* view, Databricks the *product/data* view (what users did, which experiments ran, how feature usage evolved, where a threshold constant came from).

- **Product analytics events.** `your_warehouse.events.analytics_track_event` (raw) and typed, deduplicated per-event dbt models in `<your_analytics_db>.<schema>.<table>`: feature invocations, clicks, accepts/rejects, submissions, client-reported errors.
- **Usage & billing events.** `your_warehouse.events.usage_event` / `<your_analytics_db>.<schema>.stg_usage_events`, `your_warehouse.events.raw_model_event` / `<your_analytics_db>.<schema>.stg_raw_model_events`, for cost- or volume-driven decisions.
- **Experiment / feature-flag data.** Exposure and outcome tables, with company-specific schema.
- **System tables.** `system.query.history`, `system.compute.warehouses`, `system.billing.*`, `system.access.audit`: "was this query expensive?", "how often did anyone run this?", "when did warehouse load spike?"
- **dbt lineage.** Models in `<your_analytics_db>.<schema>` reveal which pipelines depend on a table or field; upstream changes frequently motivate consumer-code changes.
- **Notebooks** hold exploratory analyses written before code changes but are not queryable via the SQL MCP. If you suspect the rationale lives in one, report a gap.

## How to search it

Use the Databricks SQL MCP. Primary tool: `execute_sql_read_only`. If it returns a `statement_id`, poll with `poll_sql_result` rather than re-running.

**Probe before trusting a table name.** Schemas are company-specific; a result from a table whose existence you never confirmed is a classic failure.

```sql
SHOW TABLES IN <your_analytics_db>.<schema> LIKE '*<keyword>*';
DESCRIBE TABLE <your_analytics_db>.<schema>.stg_<event>;
```

**Time-bound every query.** The tables are huge and unconstrained scans time out. Filter on `_timestamp` (events) or `start_time` (`system.query.history`) with a window bracketing the ship date, typically ~30 days before and after, wider only for strong reason.

**Prefer typed dbt models over the raw table.** `<your_analytics_db>.<schema>.<table>` is deduplicated, typed, and liquid-clustered; `your_warehouse.events.analytics_track_event` has duplicates and untyped `properties_json`. Model names follow `stg_<source>_<event_name_with_underscores>`, where `<source>` is `app`, `backend`, `website`, or `cli`; confirm with `SHOW TABLES`. Drop to the raw table only when no dbt model exists yet or you need events inside the dbt refresh lag (the models rebuild hourly or daily; deduplicate raw rows by `_id`).

**Column conventions on the typed models:**

- `_timestamp`, `_id`, `_auth_id`, `_request_id`, `event_name`: on every model
- `properties_<name>`: typed, underscore-cased event properties (`properties_entrypoint`, `properties_size_bytes`)
- `context_team_id`, `context_client_version`, `context_country`, `context_client_os`: pre-extracted client context

### Investigation patterns that tend to pay off

1. **Event usage trajectory.** Daily counts on the relevant `stg_*` model across a ±30d window around the PR merge. A step function from zero to steady volume within a day or two of the merge is strong circumstantial evidence the PR launched the feature; a decay to zero suggests deprecation or deletion.
2. **Guard-rail origin.** Median / p99 / max of the relevant `properties_<name>` column in the 14 days *before* the PR. A p99 matching the target's threshold constant suggests the number was chosen from data.
3. **Experiment / flag lookup.** `SHOW TABLES ... LIKE '*experiment*'` to find the exposure table, then exposure counts by variant for the flag key near the PR date. A row naming the flag with a "shipped" / "concluded" decision near the ship date is good evidence.
4. **Query history for migrations, backfills, or perf rewrites.** `system.query.history` filtered by `statement_text ILIKE '%<table_or_symbol>%'` in a tight `start_time` window; sort by `total_duration_ms` or aggregate `SUM(read_bytes)`, `COUNT(*)` to surface the expensive queries that likely motivated the change.
5. **dbt lineage.** If the target reads from or writes into a dbt model, the model's own git history often carries the rationale. Hand that lead to the git investigator.
6. **Error-class drop.** An error-classifying event's count falling to near zero after a defensive-code PR suggests the PR resolved that error class.

## Common pitfalls

- **Silent instrumentation changes.** A step in event volume may mean a new event started being logged, not that behavior changed. Check for instrumentation PRs in the same window before reading the ramp as a launch signal.
- **Schema drift.** A column on the typed model today may not have existed when the target was written; older data may carry the property only inside raw `properties_json`.
- **Retention cliff.** A window that predates the table's retention or the dbt model's creation is a *gap*; name it so the synthesizer doesn't read "no results" as "no activity."

## What to return

For each relevant finding: type (product event / experiment exposure / usage or billing event / system-table row / dbt model), fully-qualified table name and the exact query, time window, a compact numeric summary (counts, percentiles, first/last-seen timestamps, never raw rows), temporal correlation with the ship date (e.g. "first row 2024-08-15, PR #49074 merged 2024-08-14"), and strength: direct / circumstantial / weak.
