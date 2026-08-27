import json
import os
from datetime import datetime, timezone
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, OrderBy, RunReportRequest
from google.analytics.data_v1beta.types.analytics_data_api import RunRealtimeReportRequest
from google.oauth2 import service_account

PROPERTY_ID = os.environ["GA4_PROPERTY_ID"]
SA = json.loads(os.environ["GA4_SERVICE_ACCOUNT_JSON"])
SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]
CREDS = service_account.Credentials.from_service_account_info(SA, scopes=SCOPES)
client = BetaAnalyticsDataClient(credentials=CREDS)


def report(metrics, dimensions=None, start="today", limit=10, order=None):
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=[DateRange(start_date=start, end_date="today")],
        dimensions=[Dimension(name=x) for x in (dimensions or [])],
        metrics=[Metric(name=x) for x in metrics],
        limit=limit,
    )
    if order:
        req.order_bys = [OrderBy(metric=OrderBy.MetricOrderBy(metric_name=order), desc=True)]
    return client.run_report(req)


today = report(["activeUsers", "screenPageViews"], start="today", limit=1)
row = today.rows[0] if today.rows else None
visitors_today = int(row.metric_values[0].value) if row else 0
views_today = int(row.metric_values[1].value) if row else 0

week = report(["activeUsers"], start="7daysAgo", limit=1)
visitors_7d = int(week.rows[0].metric_values[0].value) if week.rows else 0

top = report(["screenPageViews"], dimensions=["pagePath"], start="7daysAgo", limit=1, order="screenPageViews")
top_page = top.rows[0].dimension_values[0].value if top.rows else "/"

live_req = RunRealtimeReportRequest(
    property=f"properties/{PROPERTY_ID}",
    metrics=[Metric(name="activeUsers")],
)
live = client.run_realtime_report(live_req)
live_users = int(live.rows[0].metric_values[0].value) if live.rows else 0

payload = {
    "visitorsToday": visitors_today,
    "viewsToday": views_today,
    "visitors7Days": visitors_7d,
    "topPage": top_page.strip("/") or "Home",
    "liveUsers": live_users,
    "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
}

with open("analytics.json", "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)

print(json.dumps(payload, indent=2))
