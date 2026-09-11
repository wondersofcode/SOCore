"""
Excel export of the AI Shift Summary — an enterprise-grade SOC shift report,
not a raw data dump. One workbook, built entirely from real data already
computed for the on-screen AI Shift Summary card (same window, same Groq
text) plus the underlying alerts/cases/events/decisions for that window.

No Excel formulas are used anywhere — every number is computed in Python and
written as a literal value, so the workbook can never show #REF!/#VALUE!/
#NAME? regardless of how it's opened or re-saved.
"""
from __future__ import annotations

import io
from collections import Counter
from datetime import datetime, timedelta, timezone

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo
from openpyxl.worksheet.worksheet import Worksheet

from . import shift_summary
from .models import Alert, Case, DecisionRecord, Event

# ── Palette — deep navy + restrained accent, semantic color used sparingly ──
NAVY = "0B2545"
NAVY_LIGHT = "13315C"
ACCENT = "2563EB"
WHITE = "FFFFFF"
BG_LIGHT = "F8FAFC"
BORDER_GRAY = "D9DEE7"
TEXT_GRAY = "6B7280"
TEXT_DARK = "111827"

_SEVERITY_COLORS = {
    "Critical": ("F8696B", "9C0006"),
    "High": ("FFB570", "9C5700"),
    "Medium": ("FFEB84", "7F6000"),
    "Low": ("A9D08E", "375623"),
    "Informational": ("E2E8F0", "475569"),
}
_STATUS_COLORS = {
    "New": ("DBEAFE", "1E40AF"),
    "Enriching": ("FEF3C7", "92400E"),
    "Responding": ("FFE4CC", "9A3412"),
    "Resolved": ("D1FAE5", "065F46"),
}
_APPROVAL_COLORS = {
    "Pending": ("FEF3C7", "92400E"),
    "Approved": ("D1FAE5", "065F46"),
    "Rejected": ("FEE2E2", "991B1B"),
    "None": ("E2E8F0", "475569"),
}

_MIN_COL_WIDTH = 12
_MAX_COL_WIDTH = 60

_thin_border = Border(*(Side(style="thin", color=BORDER_GRAY) for _ in range(4)))
_card_border = Border(
    left=Side(style="thin", color=BORDER_GRAY), right=Side(style="thin", color=BORDER_GRAY),
    top=Side(style="thin", color=BORDER_GRAY), bottom=Side(style="thin", color=BORDER_GRAY),
)


def _fill(hex_color: str) -> PatternFill:
    return PatternFill("solid", fgColor=hex_color)


def _autosize(ws: Worksheet, headers: list[str], rows: list[list], start_col: int = 1) -> None:
    for i, header in enumerate(headers):
        col_idx = start_col + i
        letter = get_column_letter(col_idx)
        widest = len(str(header))
        for row in rows:
            value = row[i]
            widest = max(widest, len(str(value)) if value is not None else 0)
        ws.column_dimensions[letter].width = max(_MIN_COL_WIDTH, min(widest + 2, _MAX_COL_WIDTH))


def _style_header_row(ws: Worksheet, row: int, n_cols: int, start_col: int = 1) -> None:
    for col in range(start_col, start_col + n_cols):
        cell = ws.cell(row=row, column=col)
        cell.fill = _fill(NAVY)
        cell.font = Font(bold=True, color=WHITE, size=10)
        cell.alignment = Alignment(vertical="center")
        cell.border = _thin_border


def _write_detail_sheet(
    ws: Worksheet,
    table_name: str,
    headers: list[str],
    rows: list[list],
    empty_message: str,
    color_columns: dict[int, dict[str, tuple[str, str]]] | None = None,
) -> None:
    """A full detail sheet: styled header, Excel Table (when there's data),
    per-column semantic fills, freeze panes, autofilter, footer."""
    for col, header in enumerate(headers, start=1):
        ws.cell(row=1, column=col, value=header)
    _style_header_row(ws, 1, len(headers))
    ws.freeze_panes = "A2"

    if not rows:
        ws.cell(row=2, column=1, value=empty_message).font = Font(italic=True, color=TEXT_GRAY)
        ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=len(headers))
        ws.row_dimensions[2].height = 22
        _autosize(ws, headers, [])
        _footer(ws, 4, len(headers))
        return

    for r, row in enumerate(rows, start=2):
        for c, value in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=value)
            cell.border = _thin_border
            if color_columns and c in color_columns:
                pair = color_columns[c].get(str(value))
                if pair:
                    fill_hex, font_hex = pair
                    cell.fill = _fill(fill_hex)
                    cell.font = Font(bold=True, color=font_hex, size=9)
                    cell.alignment = Alignment(horizontal="center")

    _autosize(ws, headers, rows)
    last_row = len(rows) + 1
    last_col_letter = get_column_letter(len(headers))
    table = Table(displayName=table_name, ref=f"A1:{last_col_letter}{last_row}")
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2", showRowStripes=True, showFirstColumn=False, showLastColumn=False,
    )
    ws.add_table(table)

    _footer(ws, last_row + 2, len(headers))


def _footer(ws: Worksheet, row: int, n_cols: int) -> None:
    cell = ws.cell(row=row, column=1, value="Generated by SOCore SOC Platform · Confidential")
    cell.font = Font(italic=True, size=8, color=TEXT_GRAY)
    if n_cols > 1:
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=n_cols)


def _misp_match(alert: Alert) -> str:
    return "Yes" if any(s.name == "MISP" and s.status.value == "hit" for s in alert.sources) else "No"


def _proposed_action(alert: Alert) -> str:
    if not alert.proposedAction:
        return "—"
    return f"{alert.proposedAction.action} → {alert.proposedAction.target}"


def _hyperlink(ws: Worksheet, cell_ref: str, sheet_name: str, label: str) -> None:
    cell = ws[cell_ref]
    cell.value = label
    cell.hyperlink = f"#'{sheet_name}'!A1"
    cell.font = Font(color=ACCENT, underline="single", size=10)


# ── Executive Summary ────────────────────────────────────────────────────────
def _build_executive_summary(
    ws: Worksheet,
    hours: int,
    generated_at: str,
    generated_by: str,
    windowed: list[Alert],
    opened_cases: list[Case],
    windowed_decisions: list[DecisionRecord],
    windowed_events: list[Event],
    summary_text: str,
    other_sheets: list[str],
) -> None:
    n_cols = 10

    # ── Banner ───────────────────────────────────────────────────────────
    ws.merge_cells("A1:J1")
    ws["A1"] = "SOCore — Security Operations Center"
    ws["A1"].font = Font(bold=True, size=18, color=WHITE)
    ws["A1"].fill = _fill(NAVY)
    ws["A1"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[1].height = 34

    ws.merge_cells("A2:J2")
    ws["A2"] = "AI Shift Summary Report"
    ws["A2"].font = Font(bold=True, size=13, color="BFDBFE")
    ws["A2"].fill = _fill(NAVY_LIGHT)
    ws["A2"].alignment = Alignment(horizontal="left", vertical="center", indent=1)
    ws.row_dimensions[2].height = 24

    now_dt = datetime.now(timezone.utc)
    window_start = now_dt - timedelta(hours=hours)
    shift_period = f"{window_start.strftime('%Y-%m-%d %H:%M')} – {now_dt.strftime('%Y-%m-%d %H:%M')} UTC ({hours}h window)"

    meta_rows = [
        ("Shift period:", shift_period),
        ("Report generated:", generated_at),
        ("Generated by:", generated_by or "—"),
    ]
    for i, (label, value) in enumerate(meta_rows, start=4):
        ws.cell(row=i, column=1, value=label).font = Font(bold=True, size=9, color=TEXT_GRAY)
        ws.merge_cells(start_row=i, start_column=2, end_row=i, end_column=6)
        ws.cell(row=i, column=2, value=value).font = Font(size=9, color=TEXT_DARK)

    # ── Report Contents (hyperlinks) ────────────────────────────────────
    ws.cell(row=4, column=8, value="Report Contents").font = Font(bold=True, size=9, color=TEXT_GRAY)
    for i, sheet_name in enumerate(other_sheets, start=5):
        _hyperlink(ws, f"H{i}", sheet_name, f"→ {sheet_name}")

    # ── KPI cards ────────────────────────────────────────────────────────
    critical_count = sum(1 for a in windowed if a.severity.value == "Critical")
    high_count = sum(1 for a in windowed if a.severity.value == "High")
    resolved_count = sum(1 for a in windowed if a.status.value == "Resolved")
    open_count = len(windowed) - resolved_count

    kpis = [
        ("TOTAL ALERTS", len(windowed), TEXT_DARK),
        ("CRITICAL", critical_count, "DC2626" if critical_count else TEXT_DARK),
        ("HIGH SEVERITY", high_count, TEXT_DARK),
        ("OPEN", open_count, TEXT_DARK),
        ("RESOLVED", resolved_count, "059669" if resolved_count else TEXT_DARK),
        ("CASES OPENED", len(opened_cases), TEXT_DARK),
        ("DECISIONS MADE", len(windowed_decisions), TEXT_DARK),
        ("EVENTS", len(windowed_events), TEXT_DARK),
    ]
    kpi_row = 9
    for i, (label, value, value_color) in enumerate(kpis):
        start_col = 1 + (i % 4) * 2 if i < 4 else 1 + ((i - 4) % 4) * 2
        row = kpi_row if i < 4 else kpi_row + 3
        end_col = start_col + 1

        ws.merge_cells(start_row=row, start_column=start_col, end_row=row, end_column=end_col)
        label_cell = ws.cell(row=row, column=start_col, value=label)
        label_cell.font = Font(bold=True, size=8, color=TEXT_GRAY)
        label_cell.alignment = Alignment(horizontal="center")
        label_cell.fill = _fill(BG_LIGHT)
        label_cell.border = _card_border

        ws.merge_cells(start_row=row + 1, start_column=start_col, end_row=row + 2, end_column=end_col)
        value_cell = ws.cell(row=row + 1, column=start_col, value=value)
        value_cell.font = Font(bold=True, size=20, color=value_color)
        value_cell.alignment = Alignment(horizontal="center", vertical="center")
        value_cell.fill = _fill(BG_LIGHT)
        value_cell.border = _card_border
        for r_ in (row, row + 1, row + 2):
            ws.cell(row=r_, column=end_col).border = _card_border

    for col in range(1, 9):
        ws.column_dimensions[get_column_letter(col)].width = 13

    # ── AI Executive Summary ────────────────────────────────────────────
    ai_row = kpi_row + 8
    ws.cell(row=ai_row, column=1, value="AI Shift Summary").font = Font(bold=True, size=12, color=NAVY)
    ai_text_row = ai_row + 1
    ws.merge_cells(start_row=ai_text_row, start_column=1, end_row=ai_text_row + 3, end_column=10)
    text_cell = ws.cell(row=ai_text_row, column=1, value=summary_text or "No AI summary was available for this window.")
    text_cell.alignment = Alignment(wrap_text=True, vertical="top", horizontal="left")
    text_cell.font = Font(size=11, color=TEXT_DARK)
    text_cell.fill = _fill(BG_LIGHT)
    for r_ in range(ai_text_row, ai_text_row + 4):
        for c_ in range(1, 11):
            ws.cell(row=r_, column=c_).border = _card_border
    ws.row_dimensions[ai_text_row].height = 24

    # ── Data tables backing the charts ──────────────────────────────────
    tables_row = ai_text_row + 6

    severity_counts = Counter(a.severity.value for a in windowed)
    severity_order = ["Critical", "High", "Medium", "Low", "Informational"]
    severity_rows = [[s, severity_counts.get(s, 0)] for s in severity_order if severity_counts.get(s, 0) > 0]

    status_counts = Counter(a.status.value for a in windowed)
    status_order = ["New", "Enriching", "Responding", "Resolved"]
    status_rows = [[s, status_counts.get(s, 0)] for s in status_order if status_counts.get(s, 0) > 0]

    attack_rows = Counter(a.attackType for a in windowed).most_common(8)

    ws.cell(row=tables_row, column=1, value="Severity Distribution").font = Font(bold=True, size=10, color=NAVY)
    sev_header_row = tables_row + 1
    ws.cell(row=sev_header_row, column=1, value="Severity")
    ws.cell(row=sev_header_row, column=2, value="Count")
    _style_header_row(ws, sev_header_row, 2)
    for i, (label, count) in enumerate(severity_rows, start=sev_header_row + 1):
        ws.cell(row=i, column=1, value=label)
        ws.cell(row=i, column=2, value=count)
    sev_last_row = sev_header_row + max(len(severity_rows), 1)

    ws.cell(row=tables_row, column=4, value="Status Breakdown").font = Font(bold=True, size=10, color=NAVY)
    status_header_row = tables_row + 1
    ws.cell(row=status_header_row, column=4, value="Status")
    ws.cell(row=status_header_row, column=5, value="Count")
    _style_header_row(ws, status_header_row, 2, start_col=4)
    for i, (label, count) in enumerate(status_rows, start=status_header_row + 1):
        ws.cell(row=i, column=4, value=label)
        ws.cell(row=i, column=5, value=count)
    status_last_row = status_header_row + max(len(status_rows), 1)

    ws.cell(row=tables_row, column=7, value="Top Attack Types").font = Font(bold=True, size=10, color=NAVY)
    attack_header_row = tables_row + 1
    ws.cell(row=attack_header_row, column=7, value="Attack Type")
    ws.cell(row=attack_header_row, column=8, value="Count")
    _style_header_row(ws, attack_header_row, 2, start_col=7)
    for i, (label, count) in enumerate(attack_rows, start=attack_header_row + 1):
        ws.cell(row=i, column=7, value=label)
        ws.cell(row=i, column=8, value=count)
    attack_last_row = attack_header_row + max(len(attack_rows), 1)

    # ── Alerts-over-time (hourly buckets across the window) ─────────────
    hourly_row = max(sev_last_row, status_last_row, attack_last_row) + 3
    ws.cell(row=hourly_row, column=1, value="Alerts Over Time (UTC, hourly)").font = Font(bold=True, size=10, color=NAVY)
    hourly_header_row = hourly_row + 1
    ws.cell(row=hourly_header_row, column=1, value="Hour")
    ws.cell(row=hourly_header_row, column=2, value="Alerts")
    _style_header_row(ws, hourly_header_row, 2)

    buckets: list[tuple[str, int]] = []
    if windowed:
        bucket_counts: Counter[str] = Counter()
        for a in windowed:
            dt = shift_summary.parse_naive_utc(a.timestamp)
            if dt:
                bucket_counts[dt.strftime("%m-%d %H:00")] += 1
        cursor = window_start.replace(minute=0, second=0, microsecond=0)
        while cursor <= now_dt:
            key = cursor.strftime("%m-%d %H:00")
            buckets.append((key, bucket_counts.get(key, 0)))
            cursor += timedelta(hours=1)
    for i, (label, count) in enumerate(buckets, start=hourly_header_row + 1):
        ws.cell(row=i, column=1, value=label)
        ws.cell(row=i, column=2, value=count)
    hourly_last_row = hourly_header_row + max(len(buckets), 1)

    charts_anchor_row = hourly_last_row + 3

    # ── Charts (only when the backing data is non-empty) ────────────────
    chart_col_anchor = 1
    if severity_rows:
        chart = BarChart()
        chart.type = "col"
        chart.title = "Severity Distribution"
        chart.style = 10
        chart.y_axis.title = "Alerts"
        chart.x_axis.title = None
        chart.legend = None
        data = Reference(ws, min_col=2, min_row=sev_header_row, max_row=sev_header_row + len(severity_rows))
        cats = Reference(ws, min_col=1, min_row=sev_header_row + 1, max_row=sev_header_row + len(severity_rows))
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)
        chart.width, chart.height = 10, 7
        ws.add_chart(chart, f"A{charts_anchor_row}")

    if status_rows:
        chart = BarChart()
        chart.type = "col"
        chart.title = "Alert Status Breakdown"
        chart.style = 11
        chart.y_axis.title = "Alerts"
        chart.legend = None
        data = Reference(ws, min_col=5, min_row=status_header_row, max_row=status_header_row + len(status_rows))
        cats = Reference(ws, min_col=4, min_row=status_header_row + 1, max_row=status_header_row + len(status_rows))
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)
        chart.width, chart.height = 10, 7
        ws.add_chart(chart, f"F{charts_anchor_row}")

    charts_anchor_row_2 = charts_anchor_row + 16

    if attack_rows:
        chart = BarChart()
        chart.type = "bar"
        chart.title = "Top Attack Types"
        chart.style = 12
        chart.x_axis.title = "Alerts"
        chart.legend = None
        data = Reference(ws, min_col=8, min_row=attack_header_row, max_row=attack_header_row + len(attack_rows))
        cats = Reference(ws, min_col=7, min_row=attack_header_row + 1, max_row=attack_header_row + len(attack_rows))
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)
        chart.width, chart.height = 10, 7
        ws.add_chart(chart, f"A{charts_anchor_row_2}")

    if len(buckets) > 1 and any(c for _, c in buckets):
        chart = LineChart()
        chart.title = "Alerts Over Time"
        chart.style = 13
        chart.y_axis.title = "Alerts"
        chart.legend = None
        data = Reference(ws, min_col=2, min_row=hourly_header_row, max_row=hourly_last_row)
        cats = Reference(ws, min_col=1, min_row=hourly_header_row + 1, max_row=hourly_last_row)
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)
        chart.width, chart.height = 10, 7
        ws.add_chart(chart, f"F{charts_anchor_row_2}")

    footer_row = charts_anchor_row_2 + 16
    _footer(ws, footer_row, n_cols)


def build_workbook(
    alerts: list[Alert],
    cases: list[Case],
    decisions: list[DecisionRecord],
    events: list[Event],
    hours: int,
    summary_text: str,
    generated_at: str,
    generated_by: str = "",
) -> bytes:
    windowed = shift_summary.windowed_alerts(alerts, hours)
    opened_cases = shift_summary.windowed_cases(cases, hours)
    windowed_ids = {a.id for a in windowed}
    windowed_decisions = [d for d in decisions if d.alertId in windowed_ids]

    cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
    windowed_events = [
        e for e in events
        if (dt := shift_summary.parse_naive_utc(e.timestamp)) and dt.timestamp() >= cutoff
    ]

    wb = Workbook()

    other_sheets = ["Alerts", "Cases", "Events", "Decisions"]
    ws_exec = wb.active
    ws_exec.title = "Executive Summary"
    ws_exec.sheet_view.showGridLines = False
    _build_executive_summary(
        ws_exec, hours, generated_at, generated_by,
        windowed, opened_cases, windowed_decisions, windowed_events,
        summary_text, other_sheets,
    )

    # ── Alerts ───────────────────────────────────────────────────────────
    ws_alerts = wb.create_sheet("Alerts")
    alert_headers = [
        "ID", "Timestamp", "Severity", "Source IP", "Attack Type",
        "MITRE ID", "MITRE Technique", "Country", "ASN",
        "VirusTotal Score", "AbuseIPDB Score", "MISP Match",
        "Risk Score", "Status", "Approval Status", "Proposed Action", "Analyst",
    ]
    alert_rows = [
        [
            a.id, a.timestamp, a.severity.value, a.sourceIP, a.attackType,
            a.mitreId, a.mitreName, a.country or "—", a.asn or "—",
            a.vtScore, a.abuseScore, _misp_match(a),
            a.riskScore, a.status.value, a.approvalStatus.value, _proposed_action(a), a.analyst,
        ]
        for a in windowed
    ]
    _write_detail_sheet(
        ws_alerts, "AlertsTable", alert_headers, alert_rows,
        "No alerts were recorded during this shift.",
        color_columns={
            3: _SEVERITY_COLORS,   # Severity
            14: _STATUS_COLORS,    # Status
            15: _APPROVAL_COLORS,  # Approval Status
        },
    )
    # Risk Score is numeric, not a severity label, so it can't use the
    # value->color lookup above — color it directly from each alert's severity.
    risk_col = alert_headers.index("Risk Score") + 1
    for r, a in enumerate(windowed, start=2):
        pair = _SEVERITY_COLORS.get(a.severity.value)
        if pair:
            cell = ws_alerts.cell(row=r, column=risk_col)
            cell.fill = _fill(pair[0])
            cell.font = Font(bold=True, color=pair[1], size=9)
            cell.alignment = Alignment(horizontal="center")

    # ── Cases ────────────────────────────────────────────────────────────
    ws_cases = wb.create_sheet("Cases")
    _write_detail_sheet(
        ws_cases, "CasesTable",
        ["ID", "Title", "Severity", "Status", "Assigned To", "Created"],
        [[c.id, c.title, c.severity.value, c.status.value, c.assignedTo, c.createdAt] for c in opened_cases],
        "No cases were opened during this shift.",
        color_columns={3: _SEVERITY_COLORS},
    )

    # ── Events ───────────────────────────────────────────────────────────
    ws_events = wb.create_sheet("Events")
    _write_detail_sheet(
        ws_events, "EventsTable",
        ["ID", "Timestamp", "Source IP", "Rule ID", "Rule Level", "Rule Description", "Agent", "Converted to Alert"],
        [
            [e.id, e.timestamp, e.sourceIP, e.ruleId or "—", e.ruleLevel,
             e.ruleDescription or "—", e.agentName or e.agentId or "—", "Yes" if e.alertId else "No"]
            for e in windowed_events
        ],
        "No raw events were recorded during this shift.",
    )

    # ── Decisions ────────────────────────────────────────────────────────
    ws_decisions = wb.create_sheet("Decisions")
    _write_detail_sheet(
        ws_decisions, "DecisionsTable",
        ["Alert ID", "Decision", "By", "At", "Reason"],
        [[d.alertId, d.status, d.by, d.at, d.reason] for d in windowed_decisions],
        "No approval decisions were logged during this shift.",
        color_columns={2: _APPROVAL_COLORS},
    )

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
