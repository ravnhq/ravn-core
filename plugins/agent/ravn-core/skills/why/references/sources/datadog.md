# Datadog Telemetry

The runtime record: what actually happened in production, as opposed to what was planned or discussed. A metric's *presence* is itself evidence that someone thought the number worth watching, and a monitor firing on `rate_limit_hit > 10/min` is direct evidence the team worried about that threshold. Also covers dashboards, APM traces and spans, logs, incidents (timelines and linked postmortems), and notebooks.

## How to search it

Use the Datadog MCP. Start broad, then narrow.

1. **Identify the owning service(s)** with `search_datadog_services` and `search_datadog_service_dependencies`.
2. **Dashboards and monitors first**, with `search_datadog_dashboards` and `search_datadog_monitors` (feature name, service name, symbol). Note the queries and watched thresholds: the threshold is frequently the answer to "why is this clamped at N?"
3. **Metrics around the target**: `search_datadog_metrics` (name pattern), `get_datadog_metric_context` (description, units, tags), `get_datadog_metric` (timeseries). A metric's trajectory correlated with the target's add/change date is strong supporting evidence: "`payment_timeout` spiked 2023-11-03, and the retry logic merged 2023-11-06."
4. **Logs, narrow.** `search_datadog_logs` with symbols, error strings, or feature names (`use_log_patterns=true`), time-bounded (about 30 days before and after the change) and filtered by service and tag. Use `analyze_datadog_logs` (SQL-style aggregations) for counts instead of dumping raw logs.
5. **APM** for timeouts, retries, slow paths, and cross-service behavior: `aggregate_spans` (failure stats), `search_datadog_spans`, `get_datadog_trace`.
6. **Incidents**: `search_datadog_incidents` (title, team, date range) and `get_datadog_incident`. For defensive-looking targets, search around the time it was added; an incident timeline reading "added defensive check for X" is near-direct evidence.

## What good evidence looks like here

- A monitor whose query and threshold match the constraint the code enforces (code clamps to 100, monitor alerts above 100/min)
- A dashboard created by the target's author, with widgets matching what the code measures or guards against
- A metric spiking immediately before the merge and stable after
- An incident record referencing the target code, its symbols, or its error strings
- Logs showing an error pattern the defensive code would prevent, in the window before the change

## Common pitfalls

- **Correlation is not causation.** A spike before a PR and stabilization after is suggestive; check neighboring PRs for other changes in the window.
- **Overfitting to the chart you found.** A chart named "retry success rate" shows the team cared about retry success, not why a specific line exists.
- **Renamed or deleted telemetry.** Metrics can be renamed, deleted, or short-lived.

## What to return

For each relevant item: type (dashboard / monitor / metric / log pattern / trace / incident / notebook), title, link or identifier, owner and created/modified date, the specific condition, query, or quote that bears on the question (verbatim where possible), and how strong the connection is.
