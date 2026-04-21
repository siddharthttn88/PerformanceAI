# Performance Testing Commands - Knowledge Base

This document contains predefined commands and their usage rules for performance testing automation tasks.

---

## 0. Enhanced Scripts for Load Testing

### Overview
Three enhanced scripts provide automated data extraction, exact timestamp alignment, and comprehensive metrics analysis:

#### 1. inspect-data-enhanced.js - Test Report Analysis
**Purpose**: Extract comprehensive metadata from Locust result.html

**Usage**:
```bash
# Text output (human-readable)
node inspect-data-enhanced.js "<PATH_TO_RESULT_HTML>" text

# JSON output (machine-readable)
node inspect-data-enhanced.js "<PATH_TO_RESULT_HTML>" json
```

**Enhanced Features**:
- ✅ **Exact Timestamps**: Extracts start, end, and buffer end (end + 60s) in ISO and epoch formats
- ✅ **Failure Status Codes**: Auto-groups failures by HTTP status (504, 401, 404, 502, 400)
- ✅ **Top 5 Slowest**: Auto-sorted by avg_response_time (descending)
- ✅ **Top 5 Highest Error Rate**: Auto-sorted by failure_rate (descending)
- ✅ **Duration with Buffer**: Calculates test duration + 60s stabilization period
- ✅ **Dual Output Formats**: Text for viewing, JSON for scripting

**Example Output**:
```
=== TEST TIMESTAMPS ===
Start Time: 2026-04-21T06:46:19.000Z (Epoch: 1776753979)
End Time:   2026-04-21T06:51:19.000Z (Epoch: 1776754279)
Buffer End: 2026-04-21T06:52:19.000Z (Epoch: 1776754339)

=== FAILURE STATUS CODES ===
Status 504: 297,092 failures (99.87%)
Status 401: 183 failures (0.06%)
Status 404: 175 failures (0.06%)

=== TOP 5 SLOWEST ENDPOINTS ===
1. DELETE Remove_Favourite: 12,868ms avg (6,131 requests, 43.70% error)
2. GET Get_Favourite_List: 7,289ms avg (68,638 requests, 67.22% error)
...
```

---

#### 2. get-pod-metrics-enhanced.js - Kubernetes Metrics with AVG/MAX
**Purpose**: Collect infrastructure metrics with both average and maximum values

**Usage**:
```bash
# RECOMMENDED: Use exact epoch timestamps
node get-pod-metrics-enhanced.js <service-name> <START_EPOCH> <END_EPOCH>

# Example with exact timestamps
node get-pod-metrics-enhanced.js subscriber-event-service 1776753979 1776754339

# ALTERNATIVE: Use duration in minutes (legacy)
node get-pod-metrics-enhanced.js <service-name> <DURATION_IN_MINUTES>
```

**Enhanced Features**:
- ✅ **AVG and MAX CPU**: Shows both average and peak CPU utilization (solves 76% vs 99% discrepancy)
- ✅ **AVG and MAX Memory**: Shows both average and peak memory utilization
- ✅ **Exact Time Range**: Uses epoch timestamps for precise Prometheus queries
- ✅ **Range Queries**: Uses `avg_over_time()` and `max_over_time()` for historical analysis
- ✅ **Per-Pod Breakdown**: Shows AVG and MAX for each pod individually
- ✅ **Resource Utilization %**: Calculates CPU/Memory as % of allocated limits

**Example Output**:
```
=== CPU USAGE STATISTICS ===
Per-Pod CPU Statistics:
  subscriber-event-service-5dfbdc7d4-9zq5n:
    AVG CPU: 1174.92 millicores (29.4% of 4000m limit)
    MAX CPU: 3978.08 millicores (99.5% of limit)

Overall CPU Summary:
  AVG Utilization: 29.7%
  MAX Utilization: 100.1%  ← Matches New Relic's 99%!

=== MEMORY USAGE STATISTICS ===
Overall Memory Summary:
  AVG Utilization: 44.9%
  MAX Utilization: 66.8%
```

**Key Insight**: Original script showed AVG CPU (~30%), missing the 100% peaks that New Relic detected!

---

#### 3. get-apm-metrics-enhanced.js - APM Metrics with Transaction Sorting
**Purpose**: Collect New Relic APM metrics with transaction-level analysis

**Usage**:
```bash
# RECOMMENDED: Use exact epoch timestamps with top-N parameter
node get-apm-metrics-enhanced.js <app-name> <START_EPOCH> <END_EPOCH> [TOP_N]

# Example: Get top 5 transactions using exact timestamps
node get-apm-metrics-enhanced.js subscriber-event 1776753979 1776754339 5

# ALTERNATIVE: Use duration in minutes
node get-apm-metrics-enhanced.js <app-name> <DURATION_IN_MINUTES> [TOP_N]
```

**Enhanced Features**:
- ✅ **Top N Slowest**: Auto-sorted by avg_duration (descending) - identifies performance bottlenecks
- ✅ **Top N Highest Error Rate**: Auto-sorted by error_rate (descending) - identifies failure patterns
- ✅ **Exact SINCE/UNTIL**: Uses epoch timestamps in NRQL queries for precision
- ✅ **Configurable Top-N**: Default 10, customize as needed (5, 20, etc.)
- ✅ **HTTP Status Breakdown**: Shows error distribution by status code when available
- ✅ **Host-Level Metrics**: Per-pod performance analysis

**Example Output**:
```
=== TOP 5 SLOWEST TRANSACTIONS ===
1. WebTransaction/SpringController/v3/favourites (GET)
   Requests: 15,211 | Avg Duration: 5425.17 ms | P95: 8234 ms
   Error Rate: 58.39%

2. WebTransaction/SpringController/v3/continue-watch/continue (GET)
   Requests: 19,711 | Avg Duration: 2363.27 ms | P95: 4521 ms
   Error Rate: 55.52%

=== TOP 5 HIGHEST ERROR RATE TRANSACTIONS ===
1. v3/favourites (GET): 58.39% error (15,211 requests, 8,882 failures)
2. v3/continue-watch/continue (GET): 55.52% error (19,711 requests, 10,944 failures)
...
```

---

### Enhanced Workflow Benefits

**Problem Solved: CPU Discrepancy**
- **Old Script**: Showed 76% CPU (incorrect - was showing current/average)
- **New Relic**: Showed 99% CPU (correct - was showing maximum)
- **Enhanced Script**: Shows BOTH - AVG: 29.7%, MAX: 100.1%
- **Root Cause**: Pods briefly maxed CPU at 100%, but avg was only 30%

**Problem Solved: Time Range Alignment**
- **Old Workflow**: Used "last N minutes from NOW" - metrics could drift from test period
- **Enhanced Workflow**: Uses exact epoch timestamps from test start/end - perfect alignment

**Problem Solved: Manual Sorting**
- **Old Workflow**: Manually review all endpoints to find slowest and highest error rate
- **Enhanced Workflow**: Auto-sorted top 5 lists for both criteria

**Problem Solved: Missing Failure Details**
- **Old Workflow**: Only total failure count, no breakdown by type
- **Enhanced Workflow**: HTTP status code breakdown (504: 99.87%, 401: 0.06%, etc.)

**Migration from Legacy Scripts**:
- Legacy scripts preserved: `inspect-data.js`, `get-pod-metrics.js`, `get-apm-metrics.js`
- Enhanced scripts backward compatible: Support both epoch timestamps and duration minutes
- See [ENHANCEMENTS-SUMMARY.md](ENHANCEMENTS-SUMMARY.md) for detailed migration guide

---

## 1. Append Load Test Results to Google Sheet

### Primary Command (Recommended - Enhanced Locust Template)
```bash
node upload-with-Locust_Template.js "<HTML_REPORT_PATH>" "<SPREADSHEET_ID>" --users <USER_COUNT> --rampup "<RAMPUP_TIME>" --targettps <TPS> --comment "<COMMENT_TEXT>" [--timezone <IST|local>]
```

**New Features in Locust Template:**
- ✅ **Merged Comment Cell** - Comment spans columns B-K for better readability
- ✅ **Fixed Name Column Width** - 400px for consistent layout
- ✅ **Right-Aligned Numbers** - Average (ms), RPS, Failures/s columns
- ✅ **Duration Parsing** - Handles both string and numeric duration formats
- ✅ **Timezone Support** - Choose between IST or local timezone
- ✅ **Auto Sheet Creation** - Creates sheet if it doesn't exist
- ✅ **Auto Column Resize** - All columns automatically sized
- ✅ **Bold Summary Labels** - Better visual hierarchy
- ✅ **Enhanced Logging** - Detailed metrics summary display
- ✅ **Better Error Handling** - Stack traces for debugging

### Alternative Command (Legacy Template)
```bash
node upload-with-template.js "<HTML_REPORT_PATH>" "<SPREADSHEET_ID>" --users <USER_COUNT> --rampup "<RAMPUP_TIME>" --comment "<COMMENT_TEXT>"
```

Use the legacy template if you need the original 3-column summary format without merged cells.

### Rules (Both Templates)
- **Leave 6 blank lines** beneath previous test results before appending new results
- **TPS Calculation**: TPS = Users / 60 (for 1-minute ramp-up)
- **Test Time**: Always extracted from `result.html` (auto-detected by script)
  - Script automatically parses test timestamps from HTML report
  - Timezone conversion: UTC → IST (GMT+5:30) or local timezone
  - Format: "M/D/YYYY, H:MM:SS AM/PM - H:MM:SS AM/PM (X minutes Y seconds)"
- **Infrastructure Config (Add to Comments section)**: 
  - Ask user which service is being tested
  - Fetch correct service name from Grafana dashboard or New Relic
  - Collect: Number of pods, CPU allocated, Memory allocated & their MAX & AVG utilization
  - Use test timestamp from HTML report to filter metrics from Grafana/New Relic
  - Include this info in the `--comment` parameter when running the command
- **Format includes**:
  - Summary table (Load, Test Time, Test Status, Comment with merged cell)
  - Data table with 11 columns (Type, Name, # Requests, # Fails, Average (ms), Min (ms), Max (ms), RPS, Failures/s, 90%ile (ms), 95%ile (ms))

### Example (Locust Template - Recommended)
```bash
node upload-with-Locust_Template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 40000 --rampup "4 minutes" --targettps 667 --timezone "local" --comment "Load Test Analysis - 40K Users Breaking Point Test

Test Configuration:
- User Load: 40,000 concurrent users
- Target TPS: 667 | Actual TPS: 3,607
- Ramp-up: 4 minutes
- Duration: 7 minutes 1 second

Test Results: FAIL

Breaking Point Analysis:
✗ Error Rate: 11.38% (Threshold: 5%)
✗ Avg Response Time: 2,733ms (Threshold: 1,000ms)
✗ 12 of 13 endpoints exceeded SLA

Infrastructure:
- Service: subscriber-event-service
- Pods: 10 (8 cores CPU, 8GB RAM each)
- Monitoring: New Relic enabled

Conclusion:
40K users represents the breaking point.
Recommended maximum: 30K users."
```

### Example (Legacy Template)
```bash
node upload-with-template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 80000 --rampup "1 minute" --comment "PayTV API Load Test - 10 endpoints tested\nTotal failures: 250 (0.05%)\nMax response time: 10,282ms"
```

### Parameters

**Locust Template (upload-with-Locust_Template.js):**
- `<HTML_REPORT_PATH>`: Path to Locust HTML report file (e.g., `D:\PerformanceAI\Reports\result.html`)
- `<SPREADSHEET_ID>`: Google Sheet ID from the URL
- `--users <count>`: Actual user count used in the test (required)
- `--rampup <time>`: Ramp-up time (e.g., "1 minute", "4 minutes")
- `--targettps <tps>`: Target TPS for display (optional, defaults to users/60)
- `--sheet <name>`: Sheet name (optional, uses first sheet if not specified)
- `--comment <text>`: Multi-line comment with test details (use `\n` for line breaks)
- `--timezone <tz>`: Timezone for timestamps - "IST" or "local" (default: local)
- `--creds <path>`: Credentials file path (default: credentials.json)

**Legacy Template (upload-with-template.js):**
- Same parameters except `--targettps` and `--timezone` are not available

### Notes
- **Script automatically extracts all timing information from result.html** - no manual time input needed
- Test start time, end time, and duration are parsed directly from the HTML report
- Duration is parsed from HTML (format: "X minutes and Y seconds")
- Timezone conversion options: IST (GMT+5:30) or local timezone
- Status auto-determined based on SLA criteria (>1000ms response time or >5% error rate)
- Do not manually specify test times - always let the script read from result.html
- **Merged comment cell** in Locust template allows detailed multi-line analysis without column width issues

---

## 2. Read Data from Google Sheet

### Command
```bash
node read-gsheet.js <SPREADSHEET_ID> [options]
```

### Options
- `--sheet <name>` - Sheet name to read from (default: first sheet)
- `--range <A1:Z100>` - Cell range to read (default: all data)
- `--creds <path>` - Path to credentials JSON (default: credentials.json)
- `--format <json|csv>` - Output format (default: json)

### Examples
```bash
# Read all data from first sheet (JSON format)
node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw

# Read specific sheet
node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw --sheet "Subscriber_21-04-26"

# Read specific range
node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw --sheet "Load Test Results" --range "A1:K50"

# Output as CSV
node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw --sheet "Subscriber_21-04-26" --format csv

# Use custom credentials file
node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw --creds my-creds.json
```

### Output Formats

**JSON (default):**
- First row used as headers
- Returns array of objects
- Easy to parse programmatically

**CSV:**
- Raw comma-separated values
- All rows including header
- Ready for Excel/spreadsheet import

### Notes
- Requires `credentials.json` with Google Sheets API read access
- Same credentials used for upload-with-template.js work here
- Use `--format json` for structured data parsing
- Use `--format csv` for quick viewing or Excel import
- Empty cells are returned as empty strings

---

## 3. Jenkins Jobs - Locust Load Testing

### Job: "Locust - Test Runner"
**URL**: http://localhost:8080/job/Locust%20-%20Test%20Runner/  
**Status**: Last Build #420 (FAILURE)  

**Description**:
- Primary Locust test execution job
- Runs load/performance tests using Locust framework
- Generates HTML reports (result.html) in the Reports folder
- Executes test scenarios against target APIs/services

**Parameters**:
- `Master_IP` (default: "10.16.7.202") - IP address of Locust master node
- `Users` (required) - Total number of concurrent users to simulate
- `RampUp` (default: "16") - User ramp rate in users/second (calculation based on system-specific formula)
- `Duration` (default: "3m") - Test duration (e.g., "3m", "30s", "1h")

**Usage**:
```bash
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.202 Users=10 RampUp=0.66 Duration=3m
# Note: RampUp is the user ramp rate (users/second) - use system-specific calculation
node jenkins-client.js status "Locust - Test Runner" <BUILD_NUMBER>
```

---

### Job: "Locust Code n Data Copy"
**URL**: http://localhost:8080/job/Locust%20Code%20n%20Data%20Copy/  
**Status**: Not built yet  

**Description**:
- Deployment/copy job for Locust test code and test data
- Distributes test files and configuration to test environments
- Prepares test infrastructure before running load tests
- May sync test scripts, data files, and dependencies

**Parameters**:
- `Master_IP` (required) - IP address of target Locust master node where code/data will be copied

**Usage**:
```bash
node jenkins-client.js build "Locust Code n Data Copy" Master_IP=10.16.7.202
node jenkins-client.js status "Locust Code n Data Copy" <BUILD_NUMBER>
```

---

## 4. Complete Load Testing Workflow

### Overview
End-to-end workflow for running load tests, collecting infrastructure metrics, and publishing results.

### Workflow Steps

#### Step 1: Run Load Test via Jenkins
```bash
# Trigger Locust test with desired parameters
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.202 Users=<USER_COUNT> RampUp=<RAMP_RATE> Duration=<DURATION>
# Note: RampUp is the user ramp rate in users/second (use system-specific calculation)

# Monitor build status
node jenkins-client.js status "Locust - Test Runner" <BUILD_NUMBER>
```

#### Step 2: Fetch Test Report
- Wait for test completion
- Retrieve HTML report from Reports folder
- Default location: `D:\PerformanceAI\Reports\result.html`

#### Step 3: Collect Infrastructure Metrics
**Ask User:**
- Which service was tested?
- Google Sheet link for results?

**Extract Test Metadata & Exact Timestamps (ENHANCED):**
```bash
# Extract comprehensive test metadata using enhanced script
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" text
# Output includes:
# - Exact timestamps: startEpoch, endEpoch, bufferEndEpoch (end + 60s)
# - Test duration with buffer
# - Failure status codes breakdown (504, 401, 404, etc.)
# - Top 5 slowest endpoints by response time
# - Top 5 highest error rate endpoints

# For JSON output (machine-readable):
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" json

# Wait 1 minute after test completion for metrics to stabilize
Start-Sleep -Seconds 60
```

**Fetch from Grafana (Kubernetes Metrics) - ENHANCED with AVG/MAX:**
```bash
# RECOMMENDED: Use exact epoch timestamps from inspect-data-enhanced.js
node get-pod-metrics-enhanced.js <service-name> <START_EPOCH> <END_EPOCH>

# Example: Using exact timestamps from test
node get-pod-metrics-enhanced.js subscriber-event-service 1776753979 1776754339

# ALTERNATIVE: Use duration in minutes (legacy compatibility)
node get-pod-metrics-enhanced.js <service-name> <DURATION_IN_MINUTES>

# Example: For a 3-minute test
node get-pod-metrics-enhanced.js subscriber-event-service 3
```

**New Features:**
- ✅ Shows **both AVG and MAX** CPU/Memory utilization
- ✅ Uses exact timestamps from result.html for precise metrics
- ✅ Prometheus range queries for historical data analysis
- ✅ Per-pod breakdown with AVG and MAX values
- Number of Pods (Running/Pending/Failed)
- CPU Allocated & Utilization per pod
- Memory Allocated & Utilization per pod
- Network I/O (RX/TX rates)
- Pod restarts count
- Pod status and health

**Fetch from New Relic (APM Metrics) - ENHANCED with Transaction Sorting:**
```bash
# RECOMMENDED: Use exact epoch timestamps from inspect-data-enhanced.js
node get-apm-metrics-enhanced.js <application-name> <START_EPOCH> <END_EPOCH> [TOP_N]

# Example: Using exact timestamps, get top 5 transactions
node get-apm-metrics-enhanced.js subscriber-event 1776753979 1776754339 5

# ALTERNATIVE: Use duration in minutes (legacy compatibility)
node get-apm-metrics-enhanced.js <application-name> <DURATION_IN_MINUTES> [TOP_N]

# Example: For a 3-minute test, get top 10 transactions
node get-apm-metrics-enhanced.js subscriber-event 3 10
```

**New Features:**
- ✅ **Top N Slowest Transactions** - Sorted by avg_duration (descending)
- ✅ **Top N Highest Error Rate** - Sorted by error_rate (descending)
- ✅ Uses exact SINCE/UNTIL timestamps for precise NRQL queries
- ✅ Configurable top-N parameter (default: 10)
- ✅ HTTP status code breakdown when available
- ✅ Host-level metrics for all pods
- ✅ Application health status and Apdex score
- ✅ Overall response time and throughput
- ✅ Error rate and error count

**Monitor for Issues:**
- High response times (>1000ms average)
- High CPU utilization (>80%)
- High memory utilization (>80%)
- Error rates and failure patterns
- Slow endpoints (P95/P99 > 1000ms)
- Memory pressure (pods exceeding limits)

#### Step 4: Prepare Enhanced Comment Section
Include in `--comment` parameter (auto-populated from enhanced scripts):
```
Service: <SERVICE_NAME>

Infrastructure at Breaking Point (Kubernetes):
- Pods: <COUNT> (<RUNNING> running, <FAILED> failed)
- CPU: <AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% max  ← Shows BOTH AVG and MAX
- Memory: <AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% max  ← Shows BOTH AVG and MAX
- Network: RX <RX_RATE> KB/s, TX <TX_RATE> KB/s
- Pod Restarts: <COUNT> (if any)

APM Metrics (New Relic):
- Health: <STATUS> | Apdex: <SCORE>
- Response Time: <AVG>ms (P95: <P95>ms, P99: <P99>ms)
- Throughput: <VALUE> rpm
- Error Rate: <PERCENTAGE>%
- Total Errors: <COUNT>

Test Results:
- Total requests: <COUNT>
- Total failures: <COUNT> (<PERCENTAGE>%)
- Avg response time: <VALUE>ms
- Max response time: <VALUE>ms

Top 5 Slowest Endpoints (Auto-sorted by response time):
1. <ENDPOINT_1>: <AVG_TIME>ms avg (<ERROR_RATE>% error, <REQUESTS> requests)
2. <ENDPOINT_2>: <AVG_TIME>ms avg (<ERROR_RATE>% error, <REQUESTS> requests)
3. <ENDPOINT_3>: <AVG_TIME>ms avg (<ERROR_RATE>% error, <REQUESTS> requests)
4. <ENDPOINT_4>: <AVG_TIME>ms avg (<ERROR_RATE>% error, <REQUESTS> requests)
5. <ENDPOINT_5>: <AVG_TIME>ms avg (<ERROR_RATE>% error, <REQUESTS> requests)

Top 5 Highest Error Rate (Auto-sorted by failure rate):
1. <ENDPOINT_1>: <ERROR_RATE>% error (<AVG_TIME>ms avg, <REQUESTS> requests)
2. <ENDPOINT_2>: <ERROR_RATE>% error (<AVG_TIME>ms avg, <REQUESTS> requests)
3. <ENDPOINT_3>: <ERROR_RATE>% error (<AVG_TIME>ms avg, <REQUESTS> requests)
4. <ENDPOINT_4>: <ERROR_RATE>% error (<AVG_TIME>ms avg, <REQUESTS> requests)
5. <ENDPOINT_5>: <ERROR_RATE>% error (<AVG_TIME>ms avg, <REQUESTS> requests)

Failure Status Codes (Auto-extracted from result.html):
- 504 Gateway Timeout: <COUNT> (<PERCENTAGE>%)  ← Most common
- 401 Unauthorized: <COUNT> (<PERCENTAGE>%)
- 404 Not Found: <COUNT> (<PERCENTAGE>%)
- 502 Bad Gateway: <COUNT> (<PERCENTAGE>%)
- 400 Bad Request: <COUNT> (<PERCENTAGE>%)

Root Cause Analysis:
- Primary Bottleneck: <CPU/Memory/I/O/Application>
- Evidence:
  * CPU: <AVG>% avg, <MAX>% max
  * Memory: <AVG>% avg, <MAX>% max
  * Slowest endpoint: <NAME> (<TIME>ms)
  * Primary failure: <STATUS_CODE> (<PERCENTAGE>%)
- Recommended Action: <Specific suggestion based on data>
```

#### Step 5: Upload to Google Sheet
```bash
node upload-with-Locust_Template.js "<HTML_REPORT_PATH>" "<SPREADSHEET_ID>" --users <USER_COUNT> --rampup "<RAMPUP_TIME>" --targettps <TPS> --comment "<COMMENT_TEXT_WITH_INFRA_METRICS>"
```

**Note**: Use `upload-with-template.js` (legacy) if you prefer the original 3-column format without merged cells.

### Example Complete Workflow (Using Enhanced Scripts)
```bash
# 1. Run test
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.202 Users=5000 RampUp=84 Duration=5m

# 2. Wait for completion and fetch report
node jenkins-client.js wait "Locust - Test Runner" 427
# Report location: D:\PerformanceAI\Reports\result.html

# Extract test metadata with EXACT TIMESTAMPS (ENHANCED)
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" text
# Output:
# - Start Time: 2026-04-21T06:46:19Z (Epoch: 1776753979)
# - End Time: 2026-04-21T06:51:19Z (Epoch: 1776754279)
# - Buffer End: 2026-04-21T06:52:19Z (Epoch: 1776754339)
# - Duration: 300s (360s with buffer)
# - Failure Status Codes: 504 (99.87%), 401 (0.06%), 404 (0.06%)
# - Top 5 Slowest: Remove_Favourite (12,868ms), Get_Favourite_List (7,289ms)...
# - Top 5 Highest Error Rate: Get_Favourite_List (67.22%), Get_ContinueWatch (61.37%)...

# Wait 1 minute for metrics to stabilize
Start-Sleep -Seconds 60

# 3. Fetch infrastructure metrics with EXACT TIMESTAMPS and AVG/MAX (ENHANCED)
node get-pod-metrics-enhanced.js subscriber-event-service 1776753979 1776754339
# Output: 
# - 10 pods running
# - CPU: 29.7% avg, 100.1% max  ← Shows BOTH values (solves 76% vs 99% issue)
# - Memory: 44.9% avg, 66.8% max  ← Shows BOTH values
# - No restarts

# Fetch APM metrics with EXACT TIMESTAMPS and TOP 5 SORTING (ENHANCED)
node get-apm-metrics-enhanced.js subscriber-event 1776753979 1776754339 5
# Output:
# - Total Requests: 107,102
# - Top 5 Slowest: v3/favourites (5,425ms), continue-watch (2,363ms)...
# - Top 5 Highest Error Rate: v3/favourites (58.39%), continue-watch (55.52%)...
# - Response time: 1,352ms avg, Throughput: 35,700 rpm, Error rate: 0.16%

# 4. Analyze metrics and identify issues (AUTO-POPULATED FROM ENHANCED SCRIPTS)
# - inspect-data-enhanced.js provides: Failure codes, Top 5 slowest, Top 5 highest error rate
# - get-pod-metrics-enhanced.js provides: AVG/MAX CPU/Memory (solves discrepancy issue)
# - get-apm-metrics-enhanced.js provides: Sorted transactions by duration and error rate
# - Compare all three sources to identify bottlenecks

# 5. Upload results with comprehensive analysis (using auto-extracted data)
node upload-with-Locust_Template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 5000 --rampup "1 minute" --targettps 83 --comment "Subscriber Event Service Load Test

Infrastructure (Kubernetes):
- Pods: 20 (all running, no restarts)
- CPU: 35% avg, 42% max  ← ENHANCED: Shows both AVG and MAX
- Memory: 60% avg, 68% max  ← ENHANCED: Shows both AVG and MAX
- Network: RX 8,200 KB/s, TX 4,100 KB/s

APM Metrics (New Relic):
- Health: Green | Apdex: 0.94
- Response Time: 450ms avg (P95: 670ms, P99: 820ms)
- Throughput: 25,000 rpm
- Error Rate: 0.16%
- Total Errors: 120

Test Results:
- Total requests: 75,000
- Total failures: 120 (0.16%)
- Avg response time: 450ms
- Max response time: 1,850ms

Top 5 Slowest Endpoints (Auto-sorted by response time):
1. /api/get-history: 820ms avg (5.3% error, 15,000 requests)
2. /api/search-content: 650ms avg (2.1% error, 12,000 requests)
3. /api/get-recommendations: 580ms avg (1.5% error, 10,000 requests)
4. /api/user-profile: 420ms avg (0% error, 18,000 requests)
5. /api/get-favorites: 380ms avg (0% error, 8,000 requests)

Top 5 Highest Error Rate (Auto-sorted by failure rate):
1. /api/get-history: 5.3% error (820ms avg, 15,000 requests)
2. /api/search-content: 2.1% error (650ms avg, 12,000 requests)
3. /api/get-recommendations: 1.5% error (580ms avg, 10,000 requests)
4. /api/user-profile: 0% error (420ms avg, 18,000 requests)
5. /api/delete-item: 0% error (180ms avg, 5,000 requests)

Failure Status Codes (Auto-extracted):
- 504 Gateway Timeout: 80 (66.7%)  ← Primary issue
- 500 Internal Server Error: 25 (20.8%)
- 503 Service Unavailable: 15 (12.5%)

Root Cause Analysis:
- Primary Bottleneck: Database I/O (get-history endpoint)
- Evidence: 
  * CPU/Memory healthy (avg <70%, max <80%) - not resource constrained
  * Slowest endpoints all DB-heavy operations
  * 504 timeouts indicate backend database saturation
  * Response times correlate with query complexity
- Recommended Action: Add database indexes on history table, implement query caching

Status: PASS - All metrics within acceptable thresholds
Next Steps: Optimize database queries before scaling to 10K users"
```

### Notes
- **Always wait 1 minute** after test completion before collecting metrics to allow stabilization
- **Use exact epoch timestamps** from inspect-data-enhanced.js (not relative "last N minutes")
- **Always collect all three enhanced scripts** for complete analysis:
  * inspect-data-enhanced.js → Exact timestamps, failure codes, top 5 sorting
  * get-pod-metrics-enhanced.js → AVG/MAX CPU/Memory with exact time range
  * get-apm-metrics-enhanced.js → Transaction sorting by duration and error rate
- **Enhanced scripts solve key issues**:
  * ✅ CPU discrepancy fixed: Shows both AVG (29.7%) and MAX (100.1%)
  * ✅ Exact time alignment: All metrics use same epoch timestamps
  * ✅ Auto-sorting: Top 5 slowest and top 5 highest error rate
  * ✅ Failure codes: Auto-extracted status code breakdown (504, 401, 404, etc.)
- Calculate RampUp as Users/60 for 1-minute ramp (or Users/RampupSeconds for custom durations)
- **Cross-reference all three data sources**: 
  * High response time + low CPU/Memory + 504 errors = Backend I/O bottleneck
  * High response time + high MAX CPU + low AVG CPU = Intermittent CPU spikes
  * High error rate + specific status codes = Application or dependency issues
- **Legacy scripts preserved** for backward compatibility (inspect-data.js, get-pod-metrics.js, get-apm-metrics.js)
- Document all anomalies, correlations, and root cause analysis in the comment section
- Include specific recommendations based on metrics (not generic suggestions)

---

## 5. Breaking Point Load Test Mode

### Overview
Execute multiple load test iterations with increasing user counts (n1, n2, n3...) to identify the application's breaking point. Tests automatically stop when breaking point criteria are met or all iterations complete.

### Breaking Point Criteria
Test stops when ANY of the following conditions are met:
- **API Response Time**: Average response time >1000ms
- **CPU Utilization**: >80% on any pod
- **Memory Utilization**: >80% on any pod
- **Error Rate**: Failures >5%
- **Pod Restarts**: Any pod restarts detected during test

### Workflow

#### Step 1: Define Test Iterations
Plan your load progression (example):
```
Iteration 1: 1,000 users
Iteration 2: 5,000 users
Iteration 3: 10,000 users
Iteration 4: 25,000 users
Iteration 5: 50,000 users
Iteration 6: 100,000 users
```

#### Step 2: Execute Complete Load Test Flow for Each Iteration

For each iteration, follow the **Complete Load Testing Workflow** (Section 4):

##### 2.1 Run Load Test via Jenkins
```bash
# Trigger Locust test
node jenkins-client.js build "Locust - Test Runner" Master_IP=<MASTER_IP> Users=<USER_COUNT> RampUp=<RATE> Duration=<DURATION>

# Wait for test completion
node jenkins-client.js wait "Locust - Test Runner" <BUILD_NUMBER>
```

##### 2.2 Fetch Test Report
```bash
# Report automatically saved to: D:\PerformanceAI\Reports\result.html
# Extract test metadata with EXACT TIMESTAMPS (ENHANCED)
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" text
# Output:
# - Start/End/Buffer timestamps (ISO and Epoch formats)
# - Duration with 60s buffer
# - Failure Status Codes: 504 (count, %), 401 (count, %), etc.
# - Top 5 Slowest Endpoints: Sorted by avg_response_time
# - Top 5 Highest Error Rate: Sorted by failure_rate

# Wait 1 minute after test completion for metrics to stabilize
Start-Sleep -Seconds 60
```

##### 2.3 Collect Infrastructure Metrics (ENHANCED WITH AVG/MAX)
```bash
# Fetch pod metrics with EXACT TIMESTAMPS and AVG/MAX (ENHANCED)
# Use startEpoch and bufferEndEpoch from inspect-data-enhanced.js output
node get-pod-metrics-enhanced.js <SERVICE_NAME> <START_EPOCH> <BUFFER_END_EPOCH>
# Returns:
# - Pod count and status
# - CPU: AVG % and MAX % (e.g., 29.7% avg, 100.1% max)
# - Memory: AVG % and MAX % (e.g., 44.9% avg, 66.8% max)
# - Network I/O, Pod restarts
# - Per-pod breakdown with AVG and MAX values

# Fetch APM metrics with EXACT TIMESTAMPS and TOP N SORTING (ENHANCED)
# Use startEpoch and bufferEndEpoch from inspect-data-enhanced.js output
node get-apm-metrics-enhanced.js <APPLICATION_NAME> <START_EPOCH> <BUFFER_END_EPOCH> [TOP_N]
# Returns:
# - Top N Slowest: Sorted by avg_duration (descending)
# - Top N Highest Error Rate: Sorted by error_rate (descending)
# - Response times, Throughput, Error rates
# - HTTP status breakdown when available
# - Host-level metrics for all pods
```

##### 2.4 Analyze Enhanced Metrics & Check Breaking Point Criteria

**From Enhanced Test Report** (inspect-data-enhanced.js):
- Total requests and failures → Error rate calculated
- Average response time and P95/P99
- **Exact timestamps**: startEpoch, endEpoch, bufferEndEpoch
- **Failure Status Codes**: Auto-grouped by HTTP status (504, 401, 404, 502, 400)
- **Top 5 Slowest**: Auto-sorted by avg_response_time (descending)
- **Top 5 Highest Error Rate**: Auto-sorted by failure_rate (descending)

**From Enhanced Grafana/Prometheus** (get-pod-metrics-enhanced.js):
- Pod count and status (Running/Pending/Failed)
- **AVG CPU utilization**: Average over test period (e.g., 29.7%)
- **MAX CPU utilization**: Peak during test period (e.g., 100.1%)  ← Solves discrepancy!
- **AVG Memory utilization**: Average over test period (e.g., 44.9%)
- **MAX Memory utilization**: Peak during test period (e.g., 66.8%)
- CPU/Memory as % of allocated limits (both AVG and MAX)
- Pod restarts count (during test period)
- Network I/O (RX/TX rates in KB/s)
- Per-pod breakdown with AVG and MAX values

**From Enhanced New Relic** (get-apm-metrics-enhanced.js):
- Application health status and Apdex score
- Application-level response times (avg, P95, P99)
- Throughput (requests per minute)
- Error rates and total error count
- **Top N Slowest Transactions**: Sorted by avg_duration (descending)
  * Example: v3/favourites (5,425ms), continue-watch (2,363ms), progress (545ms)
- **Top N Highest Error Rate**: Sorted by error_rate (descending)
  * Example: v3/favourites (58.39%), continue-watch (55.52%), progress (49.51%)
- HTTP status breakdown when available
- Host-level metrics for all pods
- Recent deployments (if any)

**Breaking Point Check (Using Enhanced Data)**:
```
BREAKING_POINT = false
REASONS = []

# From Enhanced Test Report (inspect-data-enhanced.js)
IF any endpoint avg_response_time > 1000ms:
  BREAKING_POINT = true
  REASONS.append("High API Response Time: <ENDPOINT> at <VALUE>ms")
  
IF error_rate > 5%:
  BREAKING_POINT = true
  REASONS.append("High Error Rate: <VALUE>%")

# From Enhanced Grafana/Prometheus (get-pod-metrics-enhanced.js)
IF MAX CPU utilization > 80%:  ← Check MAX, not AVG
  BREAKING_POINT = true
  REASONS.append("High MAX CPU: <POD_NAME> at <MAX_VALUE>% (AVG: <AVG_VALUE>%)")
  
IF MAX Memory utilization > 80%:  ← Check MAX, not AVG
  BREAKING_POINT = true
  REASONS.append("High MAX Memory: <POD_NAME> at <MAX_VALUE>% (AVG: <AVG_VALUE>%)")
  
IF any pod restarts detected:
  BREAKING_POINT = true
  REASONS.append("Pod Instability: <COUNT> restarts detected")

# From Enhanced New Relic APM (get-apm-metrics-enhanced.js)
IF APM response_time > 1000ms:
  BREAKING_POINT = true
  REASONS.append("High APM Response Time: <VALUE>ms")
  
IF APM error_rate > 5%:
  BREAKING_POINT = true
  REASONS.append("High APM Error Rate: <VALUE>%")

# Enhanced Bottleneck Analysis
IDENTIFY_BOTTLENECK():
  IF MAX_CPU > 80%: BOTTLENECK = "CPU Bound (Peak)"
  ELSE IF MAX_Memory > 80%: BOTTLENECK = "Memory Bound (Peak)"
  ELSE IF response_time high AND MAX_CPU/MAX_Memory low: BOTTLENECK = "I/O Bound (Database/Network)"
  ELSE IF error_rate high: 
    IF failure_code_504 dominant: BOTTLENECK = "Backend Timeout (Database/API)"
    ELSE IF failure_code_503: BOTTLENECK = "Service Unavailable (Overload)"
    ELSE: BOTTLENECK = "Application-level errors"
  
  # Use Top 5 Slowest from get-apm-metrics-enhanced.js
  SLOWEST_ENDPOINT = top_5_slowest[0].name
  SLOWEST_TIME = top_5_slowest[0].avg_duration
  
  # Use Top 5 Highest Error Rate from get-apm-metrics-enhanced.js
  HIGHEST_ERROR_ENDPOINT = top_5_errors[0].name
  HIGHEST_ERROR_RATE = top_5_errors[0].error_rate
```

##### 2.5 Prepare Enhanced Comment Section with Breaking Point Status

```bash
# For iterations that PASS (no breaking point) - Use enhanced auto-sorted data
COMMENT="✅ Breaking Point Test - Iteration <N>

Service: <SERVICE_NAME>
Load: <USER_COUNT> users

Infrastructure (Kubernetes):
- Pods: <COUNT> (<RUNNING> running, <PENDING> pending)
- CPU: <AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% max  ← ENHANCED: Both values
- Memory: <AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% max  ← ENHANCED: Both values
- Network: RX <RX_RATE> KB/s, TX <TX_RATE> KB/s
- Restarts: None

APM Metrics (New Relic):
- Health: <STATUS> | Apdex: <SCORE>
- Response Time: <AVG>ms (P95: <P95>ms)
- Throughput: <VALUE> rpm
- Error Rate: <PERCENTAGE>%

Test Results:
- Total requests: <COUNT>
- Total failures: <COUNT> (<ERROR_RATE>%)
- Avg response time: <VALUE>ms
- Max response time: <VALUE>ms

Top 3 Slowest Endpoints (Auto-sorted by response time):
1. <ENDPOINT_1>: <RESPONSE_TIME>ms avg (<ERROR_RATE>% error, <REQUESTS> requests)
2. <ENDPOINT_2>: <RESPONSE_TIME>ms avg (<ERROR_RATE>% error, <REQUESTS> requests)
3. <ENDPOINT_3>: <RESPONSE_TIME>ms avg (<ERROR_RATE>% error, <REQUESTS> requests)

Top 3 Highest Error Rate (Auto-sorted by failure rate):
1. <ENDPOINT_1>: <ERROR_RATE>% error (<RESPONSE_TIME>ms avg, <REQUESTS> requests)
2. <ENDPOINT_2>: <ERROR_RATE>% error (<RESPONSE_TIME>ms avg, <REQUESTS> requests)
3. <ENDPOINT_3>: <ERROR_RATE>% error (<RESPONSE_TIME>ms avg, <REQUESTS> requests)

Failure Status Codes (Auto-extracted):
- <CODE_1>: <COUNT> (<PERCENTAGE>%)
- <CODE_2>: <COUNT> (<PERCENTAGE>%)

Analysis:
- Bottleneck: None identified
- CPU/Memory: Healthy (avg <70%, max <80%)
- Response Times: Within SLA (<1000ms)
- Error Rate: Acceptable (<5%)

Status: ✅ PASS - No breaking point criteria met
Next: Continue to iteration <N+1>"
```

```bash
# For iteration that FAILS (breaking point reached) - Use enhanced auto-sorted data
COMMENT="🔴 BREAKING POINT TEST - Final Iteration <N>

Service: <SERVICE_NAME>
Load: <USER_COUNT> users

Breaking Point Summary:
- Maximum Stable Load: <PREVIOUS_ITERATION_USERS> users
- Breaking Point Load: <CURRENT_ITERATION_USERS> users
- Criteria Met:
  * <CRITERIA_1>: <VALUE> (Threshold: <THRESHOLD>) 🔴
  * <CRITERIA_2>: <VALUE> (Threshold: <THRESHOLD>) 🔴

Infrastructure at Breaking Point (Kubernetes):
- Pods: <COUNT> (<RUNNING> running, <FAILED> failed)
- CPU: <AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% max  ← ENHANCED: Both values
- Memory: <AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% max  ← ENHANCED: Both values
- Critical Pod: <POD_NAME> - CPU: <MAX_VALUE>% max (AVG: <AVG_VALUE>%)
- Restarts: <COUNT> detected

APM Metrics at Breaking Point (New Relic):
- Health: <STATUS> | Apdex: <SCORE>
- Response Time: <AVG>ms (P95: <P95>ms, P99: <P99>ms)
- Throughput: <VALUE> rpm
- Error Rate: <PERCENTAGE>%
- Total Errors: <COUNT>

Test Results:
- Total requests: <COUNT>
- Total failures: <COUNT> (<ERROR_RATE>%)
- Avg response time: <VALUE>ms
- Max response time: <VALUE>ms

Top 5 Slowest Endpoints (Auto-sorted - Breaking Point):
1. <ENDPOINT_1>: <RESPONSE_TIME>ms avg (<ERROR_RATE>% error, <FAILURES> failures)
2. <ENDPOINT_2>: <RESPONSE_TIME>ms avg (<ERROR_RATE>% error, <FAILURES> failures)
3. <ENDPOINT_3>: <RESPONSE_TIME>ms avg (<ERROR_RATE>% error, <FAILURES> failures)
4. <ENDPOINT_4>: <RESPONSE_TIME>ms avg (<ERROR_RATE>% error, <FAILURES> failures)
5. <ENDPOINT_5>: <RESPONSE_TIME>ms avg (<ERROR_RATE>% error, <FAILURES> failures)

Top 5 Highest Error Rate (Auto-sorted - Breaking Point):
1. <ENDPOINT_1>: <ERROR_RATE>% error (<RESPONSE_TIME>ms avg, <FAILURES> failures)
2. <ENDPOINT_2>: <ERROR_RATE>% error (<RESPONSE_TIME>ms avg, <FAILURES> failures)
3. <ENDPOINT_3>: <ERROR_RATE>% error (<RESPONSE_TIME>ms avg, <FAILURES> failures)
4. <ENDPOINT_4>: <ERROR_RATE>% error (<RESPONSE_TIME>ms avg, <FAILURES> failures)
5. <ENDPOINT_5>: <ERROR_RATE>% error (<RESPONSE_TIME>ms avg, <FAILURES> failures)

Failure Status Codes (Auto-extracted - Breaking Point):
- <CODE_1>: <COUNT> (<PERCENTAGE>%)  ← Dominant failure type
- <CODE_2>: <COUNT> (<PERCENTAGE>%)
- <CODE_3>: <COUNT> (<PERCENTAGE>%)

Root Cause Analysis:
- Primary Bottleneck: <CPU/Memory/I/O/Application>
- Secondary Issues: <LIST>
- Evidence:
  * CPU: <AVG>% avg, <MAX>% max ← ENHANCED: Shows both
  * Memory: <AVG>% avg, <MAX>% max ← ENHANCED: Shows both
  * Slowest endpoint: <NAME> (<TIME>ms) ← Auto-sorted
  * Primary failure: <STATUS_CODE> (<PERCENTAGE>%) ← Auto-extracted
  * Highest error endpoint: <NAME> (<ERROR_RATE>%) ← Auto-sorted

Test Progression:
- Iteration 1: <USERS> users - ✅ PASS (<RT>ms, <ERR>% error, CPU <AVG>%/<MAX>% avg/max, Mem <AVG>%/<MAX>% avg/max)
- Iteration 2: <USERS> users - ✅ PASS (<RT>ms, <ERR>% error, CPU <AVG>%/<MAX>% avg/max, Mem <AVG>%/<MAX>% avg/max)
- Iteration <N>: <USERS> users - 🔴 FAIL (<RT>ms, <ERR>% error, CPU <AVG>%/<MAX>% avg/max, Mem <AVG>%/<MAX>% avg/max)

Recommendations:
- Maximum safe load: <80% of breaking point> users
- Immediate Actions:
  1. <ACTION_1_BASED_ON_BOTTLENECK>
  2. <ACTION_2_BASED_ON_METRICS>
  3. <ACTION_3_FOR_OPTIMIZATION>
- Bottleneck Endpoint: <SLOWEST_ENDPOINT_NAME> (optimize this first) ← From Top 5 Slowest
- High Error Endpoint: <HIGHEST_ERROR_ENDPOINT_NAME> (fix this first) ← From Top 5 Errors
- Failure Root Cause: <PRIMARY_STATUS_CODE> indicates <ISSUE_TYPE> ← From Status Codes
- Infrastructure Action: <SCALING_OR_RESOURCE_INCREASE>
- Application Action: <CODE_OR_CONFIG_OPTIMIZATION>"
```

##### 2.6 Upload Results to Google Sheet
```bash
node upload-with-Locust_Template.js "D:\PerformanceAI\Reports\result.html" "<SPREADSHEET_ID>" --users <USER_COUNT> --rampup "<RAMPUP_TIME>" --targettps <TPS> --comment "<PREPARED_COMMENT>"
```

**Legacy Option**: Use `upload-with-template.js` for the original format without merged comment cells.

#### Step 3: Decision Logic
```
IF BREAKING_POINT == true:
  - Upload final results with breaking point report
  - STOP all iterations
  - Generate breaking point analysis summary
ELSE:
  - Upload current iteration results
  - Wait 2-3 minutes for system cooldown
  - CONTINUE to next iteration
```

#### Step 4: Repeat for All Planned Iterations

Continue executing **Step 2** (Complete Load Test Flow) for each planned iteration until:
- Breaking point is reached (any criteria met), OR
- All planned iterations complete successfully

### Example Breaking Point Test Execution

**Test Plan**: Service: subscriber-event-service | Master IP: 10.16.7.34 | Duration: 3m per iteration

#### Iteration 1: 1,000 Users (Using Enhanced Scripts)

```bash
# Step 1: Run test
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.34 Users=1000 RampUp=17 Duration=3m
node jenkins-client.js wait "Locust - Test Runner" 426

# Step 2: Fetch report and extract metadata (ENHANCED)
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" text
# Output: 
# - Start: 1776753000, End: 1776753180, Buffer: 1776753240
# - Duration: 180s (240s with buffer)
# - Requests: 15,000, Failures: 0 (0%)
# - Avg response: 250ms
# - Failure Status Codes: None
# - Top 5 Slowest: Get_Profile (280ms), Get_History (240ms), Post_Event (220ms)
# - Top 5 Highest Error Rate: All 0%

# Wait 1 minute for metrics to stabilize
Start-Sleep -Seconds 60

# Step 3: Collect metrics with EXACT TIMESTAMPS (ENHANCED)
node get-pod-metrics-enhanced.js subscriber-event-service 1776753000 1776753240
# Output: 20 pods, CPU: 15% avg / 18% max, Memory: 45% avg / 48% max, No restarts

node get-apm-metrics-enhanced.js subscriber-event 1776753000 1776753240 5
# Output: Response time: 250ms avg, Throughput: 5000 rpm, Error rate: 0%
# - Top 5 Slowest: /api/get-profile (280ms), /api/get-history (240ms), /api/post-event (220ms)...
# - Top 5 Highest Error Rate: All 0%

# Step 4: Check breaking point (ENHANCED)
# ✅ Response time: 250ms (<1000ms) - PASS
# ✅ MAX CPU: 18% (<80%) - PASS  ← Check MAX, not AVG
# ✅ MAX Memory: 48% (<80%) - PASS  ← Check MAX, not AVG
# ✅ Error rate: 0% (<5%) - PASS
# ✅ No pod restarts - PASS
# Decision: CONTINUE

# Step 5: Upload results (using auto-extracted enhanced data)
node upload-with-Locust_Template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 1000 --rampup "60 seconds" --targettps 17 --comment "✅ Breaking Point Test - Iteration 1`nService: subscriber-event-service`nLoad: 1,000 users`n`nInfrastructure:`n- Pods: 20`n- CPU: 15% avg, 18% max  ← ENHANCED: Both values`n- Memory: 45% avg, 48% max  ← ENHANCED: Both values`n`nTest Results:`n- Total requests: 15,000`n- Total failures: 0 (0%)`n- Avg response time: 250ms`n- P95: 320ms`n`nTop 3 Slowest Endpoints:`n1. GET /api/get-profile: 280ms avg (0% error, 5,000 requests)`n2. GET /api/get-history: 240ms avg (0% error, 4,000 requests)`n3. POST /api/post-event: 220ms avg (0% error, 6,000 requests)`n`nStatus: ✅ PASS - All criteria met`nNext: Continue to iteration 2"

# Wait 3 minutes for cooldown
Start-Sleep -Seconds 180
```

#### Iteration 2: 5,000 Users (Using Enhanced Scripts)

```bash
# Step 1: Run test
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.34 Users=5000 RampUp=84 Duration=3m
node jenkins-client.js wait "Locust - Test Runner" 427

# Step 2: Fetch report and extract metadata (ENHANCED)
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" text
# Output:
# - Start: 1776754000, End: 1776754180, Buffer: 1776754240
# - Duration: 180s (240s with buffer)
# - Requests: 75,000, Failures: 120 (0.16%)
# - Avg response: 450ms
# - Failure Status Codes: 504 (80, 66.7%), 500 (25, 20.8%), 503 (15, 12.5%)
# - Top 5 Slowest: Get_History (820ms), Search_Content (650ms), Get_Recommendations (580ms)
# - Top 5 Highest Error Rate: Get_History (5.3%), Search_Content (2.1%), Get_Recommendations (1.5%)

# Wait 1 minute for metrics to stabilize
Start-Sleep -Seconds 60

# Step 3: Collect metrics with EXACT TIMESTAMPS (ENHANCED)
node get-pod-metrics-enhanced.js subscriber-event-service 1776754000 1776754240
# Output: 20 pods, CPU: 35% avg / 42% max, Memory: 60% avg / 68% max, No restarts

node get-apm-metrics-enhanced.js subscriber-event 1776754000 1776754240 5
# Output: Response time: 450ms avg, Throughput: 25000 rpm, Error rate: 0.16%
# - Top 5 Slowest: /api/get-history (820ms), /api/search-content (650ms), /api/get-recommendations (580ms)...
# - Top 5 Highest Error Rate: /api/get-history (5.3%), /api/search-content (2.1%)...

# Step 4: Check breaking point (ENHANCED)
# ✅ Response time: 450ms (<1000ms) - PASS
# ✅ MAX CPU: 42% (<80%) - PASS  ← Check MAX, not AVG
# ✅ MAX Memory: 68% (<80%) - PASS  ← Check MAX, not AVG
# ✅ Error rate: 0.16% (<5%) - PASS
# ✅ No pod restarts - PASS
# Decision: CONTINUE

# Step 5: Upload results (using auto-extracted enhanced data)
node upload-with-Locust_Template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 5000 --rampup "60 seconds" --targettps 84 --comment "✅ Breaking Point Test - Iteration 2`nService: subscriber-event-service`nLoad: 5,000 users`n`nInfrastructure:`n- Pods: 20`n- CPU: 35% avg, 42% max  ← ENHANCED: Both values`n- Memory: 60% avg, 68% max  ← ENHANCED: Both values`n`nTest Results:`n- Total requests: 75,000`n- Total failures: 120 (0.16%)`n- Avg response time: 450ms`n- P95: 670ms`n`nTop 3 Slowest Endpoints:`n1. GET /api/get-history: 820ms avg (5.3% error, 15,000 requests)`n2. GET /api/search-content: 650ms avg (2.1% error, 12,000 requests)`n3. GET /api/get-recommendations: 580ms avg (1.5% error, 10,000 requests)`n`nTop 3 Highest Error Rate:`n1. GET /api/get-history: 5.3% error (820ms avg, 15,000 requests)`n2. GET /api/search-content: 2.1% error (650ms avg, 12,000 requests)`n3. GET /api/get-recommendations: 1.5% error (580ms avg, 10,000 requests)`n`nFailure Status Codes:`n- 504 Gateway Timeout: 80 (66.7%)  ← Primary issue`n- 500 Internal Server Error: 25 (20.8%)`n- 503 Service Unavailable: 15 (12.5%)`n`nStatus: ✅ PASS - All criteria met`nNext: Continue to iteration 3"

# Wait 3 minutes for cooldown
Start-Sleep -Seconds 180
```

#### Iteration 3: 10,000 Users (Breaking Point Reached - Using Enhanced Scripts)

```bash
# Step 1: Run test
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.34 Users=10000 RampUp=167 Duration=3m
node jenkins-client.js wait "Locust - Test Runner" 428

# Step 2: Fetch report and extract metadata (ENHANCED)
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" text
# Output:
# - Start: 1776755000, End: 1776755180, Buffer: 1776755240
# - Duration: 180s (240s with buffer)
# - Requests: 150,000, Failures: 2,500 (1.67%)
# - Avg response: 1250ms
# - Failure Status Codes: 504 (1800, 72%), 503 (500, 20%), 500 (200, 8%)
# - Top 5 Slowest: Get_History (1850ms), Search_Content (1450ms), Get_Recommendations (1150ms)
# - Top 5 Highest Error Rate: Get_History (8.0%), Search_Content (6.7%), Get_Recommendations (5.0%)

# Wait 1 minute for metrics to stabilize
Start-Sleep -Seconds 60

# Step 3: Collect metrics with EXACT TIMESTAMPS (ENHANCED)
node get-pod-metrics-enhanced.js subscriber-event-service 1776755000 1776755240
# Output: 20 pods, CPU: 75% avg / 82% max, Memory: 76% avg / 84% max, No restarts

node get-apm-metrics-enhanced.js subscriber-event 1776755000 1776755240 5
# Output: Response time: 1250ms avg, Throughput: 48000 rpm, Error rate: 1.67%
# - Top 5 Slowest: /api/get-history (1850ms), /api/search-content (1450ms), /api/get-recommendations (1150ms)...
# - Top 5 Highest Error Rate: /api/get-history (8.0%), /api/search-content (6.7%)...

# Step 4: Check breaking point (ENHANCED)
# 🔴 Response time: 1250ms (>1000ms) - FAIL
# ✅ MAX CPU: 82% (>80%) - MARGINAL (close to limit)  ← Check MAX, not AVG
# 🔴 MAX Memory: 84% (>80%) - FAIL  ← Check MAX, not AVG
# ✅ Error rate: 1.67% (<5%) - PASS
# ✅ No pod restarts - PASS
# Decision: BREAKING POINT REACHED - STOP

# Step 5: Upload final breaking point report (using auto-extracted enhanced data)
node upload-with-Locust_Template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 10000 --rampup "60 seconds" --targettps 167 --comment "🔴 BREAKING POINT TEST - Final Iteration 3`n`nService: subscriber-event-service`nLoad: 10,000 users`n`nBreaking Point Summary:`n- Maximum Stable Load: 5,000 users`n- Breaking Point Load: 10,000 users`n- Criteria Met:`n  * Response Time: 1250ms (Threshold: 1000ms) 🔴`n  * MAX Memory: 84% (Threshold: 80%) 🔴`n`nInfrastructure at Breaking Point:`n- Pods: 20`n- CPU: 75% avg, 82% max  ← ENHANCED: Both values (approaching limit)`n- Memory: 76% avg, 84% max  ← ENHANCED: Both values (exceeds threshold)`n`nTop 5 Slowest Endpoints:`n1. GET /api/get-history: 1850ms avg (8.0% error, 1200 failures)`n2. GET /api/search-content: 1450ms avg (6.7% error, 800 failures)`n3. GET /api/get-recommendations: 1150ms avg (5.0% error, 500 failures)`n4. GET /api/user-profile: 950ms avg (0.5% error, 50 failures)`n5. POST /api/post-event: 850ms avg (0.2% error, 20 failures)`n`nTop 5 Highest Error Rate:`n1. GET /api/get-history: 8.0% error (1850ms avg, 15,000 requests)`n2. GET /api/search-content: 6.7% error (1450ms avg, 12,000 requests)`n3. GET /api/get-recommendations: 5.0% error (1150ms avg, 10,000 requests)`n4. GET /api/user-profile: 0.5% error (950ms avg, 18,000 requests)`n5. POST /api/post-event: 0.2% error (850ms avg, 20,000 requests)`n`nFailure Status Codes:`n- 504 Gateway Timeout: 1800 (72%)  ← Backend database saturation`n- 503 Service Unavailable: 500 (20%)  ← Service overload`n- 500 Internal Server Error: 200 (8%)`n`nTest Progression:`n- Iteration 1: 1,000 users - ✅ PASS (250ms, 0% error, CPU 15%/18% avg/max, Mem 45%/48% avg/max)`n- Iteration 2: 5,000 users - ✅ PASS (450ms, 0.16% error, CPU 35%/42% avg/max, Mem 60%/68% avg/max)`n- Iteration 3: 10,000 users - 🔴 FAIL (1250ms, 1.67% error, CPU 75%/82% avg/max, Mem 76%/84% avg/max)`n`nRoot Cause Analysis:`n- Primary Bottleneck: Database I/O (backend timeout)`n- Evidence:`n  * CPU/Memory healthy on avg (75%/76%) but MAX hits limit (82%/84%)`n  * 504 timeouts (72%) indicate backend database saturation`n  * Slowest endpoints all DB-heavy operations (get-history: 1850ms)`n  * Response times degrade exponentially (not linearly)`n`nRecommendations:`n- Maximum safe load: 8,000 users (80% of breaking point)`n- Bottleneck Endpoint: /api/get-history (1850ms avg, 8% error) - optimize first`n- High Error Endpoint: /api/get-history (8.0% error) - fix database queries`n- Failure Root Cause: 504 Gateway Timeout (72%) indicates backend database I/O bottleneck`n- Infrastructure: MAX Memory 84% suggests increase to 6GB per pod OR scale to 30 pods`n- Application: Add database indexes on history table, implement query caching, add connection pooling"

# Test complete - breaking point identified at 10,000 users
```

### Automation Tips (Enhanced Scripts)

**Calculate RampUp for each iteration**:
- Use system-specific formula: RampUp = Users / Ramp-up duration (seconds)
- For 60-second ramp-up: RampUp = Users / 60

**Use enhanced scripts for accurate data collection**:
- **inspect-data-enhanced.js**: Extracts exact timestamps, failure codes, top 5 sorting
- **get-pod-metrics-enhanced.js**: Shows AVG/MAX CPU/Memory (solves 76% vs 99% discrepancy)
- **get-apm-metrics-enhanced.js**: Transaction sorting by duration and error rate

**Exact timestamp workflow**:
1. Run test via Jenkins
2. Extract startEpoch, endEpoch, bufferEndEpoch from inspect-data-enhanced.js
3. Use exact epochs for get-pod-metrics-enhanced.js and get-apm-metrics-enhanced.js
4. All metrics aligned to same time range (no "last N minutes" drift)

**Consistent test duration**:
- Recommended: 3-5 minutes per iteration
- Allows system to stabilize under load

**Metrics collection timing**:
- Always wait 1 minute after test completion before collecting metrics
- Use exact epochs from inspect-data-enhanced.js (includes 60s buffer automatically)
- This ensures metrics accurately reflect test period + stabilization

**Wait time between iterations**:
- Allow 2-3 minutes between tests for system cooldown
- Ensures metrics reset to baseline

**Document all iterations**:
- Upload results after EACH iteration to track progression
- Use 6 blank lines separation between results in Google Sheet
- Include AVG/MAX for CPU and Memory in every comment

### Notes
- Breaking point tests consume significant resources - coordinate with infrastructure team
- Best performed during off-peak hours or in isolated test environments
- Document baseline metrics before starting iteration sequence
- Consider horizontal pod autoscaling (HPA) behavior during test

---

## 6. Metrics Analysis & Issue Identification Guide

### Overview
Comprehensive guide for analyzing Grafana (Kubernetes) and New Relic (APM) metrics to identify performance bottlenecks and root causes.

### Data Collection Commands

```bash
# Step 1: Analyze HTML Report to get test duration
node inspect-data.js "D:\PerformanceAI\Reports\result.html"
# Output: duration="3 minutes" (note this value)

# Step 2: Wait 1 minute after test completion for metrics to stabilize
Start-Sleep -Seconds 60

# Step 3: Fetch Kubernetes Infrastructure Metrics (Grafana/Prometheus)
# Use actual test duration (e.g., 3 for "3 minutes")
node get-pod-metrics.js <service-name> <DURATION_IN_MINUTES>

# Step 4: Fetch Application Performance Metrics (New Relic)
# Use actual test duration (e.g., 3 for "3 minutes")
node get-apm-metrics.js <application-name> <DURATION_IN_MINUTES>
```

### Metrics to Collect

#### From Grafana/Prometheus (get-pod-metrics.js)
**Pod Information:**
- Pod count and distribution across nodes
- Pod status (Running/Pending/Failed/CrashLoopBackOff)
- ReplicaSet information

**Resource Utilization:**
- CPU: Current usage (millicores) and % of limit
- Memory: Current usage (MB) and % of limit
- Network I/O: RX/TX rates (KB/s)

**Health Indicators:**
- Container restart counts (last 5 minutes)
- Pod lifecycle events
- Resource requests vs limits

#### From New Relic (get-apm-metrics.js)
**Application Health:**
- Overall health status (green/gray/red)
- Apdex score (0-1 scale)
- Application reporting status

**Performance Metrics:**
- Average response time (ms)
- P95/P99 response times
- Throughput (requests per minute)
- Error rate (%) and total error count

**Transaction Analysis:**
- Top transactions by request count
- Slowest transactions by avg duration
- Error breakdown by transaction

**Host/Instance Metrics:**
- Per-pod response times
- Per-pod throughput
- Per-pod error rates

#### From Test Report (result.html)
**Request Statistics:**
- Total requests per endpoint
- Total failures per endpoint
- Min/Max/Median/P90/P95/P99 response times

**Aggregated Metrics:**
- Overall error rate
- Average response time across all endpoints
- Total RPS (requests per second)

### Issue Identification Framework

#### 1. High Response Time (>1000ms avg)

**Possible Causes:**
- **Database bottleneck**: Check if endpoints with DB queries are slowest
- **Memory pressure**: GC thrashing causing pauses
- **Network latency**: External API calls timing out
- **Thread exhaustion**: Application unable to process requests

**Analysis Steps:**
```
1. Check New Relic slowest transactions
2. Identify common pattern (DB queries, external calls, computation)
3. Check Memory utilization from Grafana
   - IF Memory >80%: Memory-bound issue (GC overhead)
   - IF Memory <80% AND CPU <80%: I/O bound (database/network)
4. Review New Relic transaction traces for bottleneck location
```

**Comment Format:**
```
Issue: High Response Time (5,522ms avg)
Root Cause: Database connection pool exhaustion
Evidence:
- New Relic: Slowest endpoints all query-heavy
- Grafana: Memory at 75%, CPU at 45% (not resource constrained)
- Pattern: Response time degrades linearly with user count
Action: Increase database connection pool from 20 to 100
```

#### 2. High Error Rate (>5%)

**Possible Causes:**
- **Application errors**: Bugs, unhandled exceptions
- **Resource exhaustion**: OOM, thread pool full
- **Timeouts**: Database or external API timeouts
- **Cascading failures**: Circuit breaker triggered

**Analysis Steps:**
```
1. Check New Relic error breakdown by type
2. Identify most common error class
3. Check if errors correlate with specific endpoints
4. Check Grafana for:
   - Pod restarts (indicates crashes)
   - Memory exceeding limits (OOM kills)
   - CPU throttling
5. Determine if errors are:
   - Client errors (4xx): Application logic issues
   - Server errors (5xx): Infrastructure or dependency issues
```

**Comment Format:**
```
Issue: High Error Rate (69.1%)
Root Cause: Application-level cascading failures from memory exhaustion
Evidence:
- Grafana: One pod at 131% memory (5,231MB/4,000MB limit)
- New Relic: Error rate spikes correlate with memory pressure
- Pattern: All user-interaction endpoints failing similarly
Action: Increase pod memory from 4GB to 8GB, review memory leaks
```

#### 3. High CPU Utilization (>80%)

**Possible Causes:**
- **Compute-intensive operations**: Heavy calculations, encryption
- **Inefficient algorithms**: O(n²) complexity in hot path
- **Insufficient horizontal scaling**: Too few pods for load
- **Thread contention**: Lock contention causing spin-wait

**Analysis Steps:**
```
1. Check Grafana CPU % per pod
2. Identify if all pods are evenly loaded (load balancing working)
3. Check New Relic transaction durations:
   - IF durations proportional to CPU: Compute-bound
   - IF durations erratic: Thread contention
4. Compare throughput vs CPU usage:
   - Linear relationship: Normal compute load
   - Non-linear: Inefficiency or contention
```

**Comment Format:**
```
Issue: High CPU Utilization (85% avg across pods)
Root Cause: Compute-bound encryption operations under load
Evidence:
- Grafana: All 20 pods at 80-90% CPU
- New Relic: Encryption endpoint takes 800ms avg (highest)
- Pattern: CPU scales linearly with user count
Action: 1) Optimize encryption algorithm, 2) Scale to 40 pods
```

#### 4. High Memory Utilization (>80%)

**Possible Causes:**
- **Memory leaks**: Objects not garbage collected
- **Large object allocation**: Holding too much data in memory
- **Insufficient heap size**: JVM heap too small
- **Caching issues**: Unbounded cache growth

**Analysis Steps:**
```
1. Check Grafana memory % per pod
2. Identify if specific pods exceed limits (trigger OOM kills)
3. Check for pod restarts (indicates OOM crashes)
4. Review New Relic for:
   - Memory-intensive endpoints
   - Gradual memory growth over test duration
5. Calculate memory per request:
   - Memory_Used / Total_Requests ratio
```

**Comment Format:**
```
Issue: High Memory Utilization (123% peak, exceeds 4GB limit)
Root Cause: Memory leak in user session management
Evidence:
- Grafana: Memory grows from 1.8GB to 4.9GB during test
- Pod restarts: 3 pods killed by OOM during test
- Pattern: Memory never releases, grows with user count
Action: 1) Increase to 8GB heap, 2) Profile for memory leaks, 3) Review session cleanup
```

#### 5. Pod Restarts/Instability

**Possible Causes:**
- **OOM kills**: Memory exceeds limit
- **Liveness probe failures**: App unresponsive
- **Crashes**: Unhandled exceptions, segfaults
- **Resource contention**: Node resource exhaustion

**Analysis Steps:**
```
1. Check Grafana restart counts
2. Correlate restart times with:
   - Memory spikes
   - CPU spikes
   - Error rate increases
3. Check New Relic for errors before restart
4. Identify restart pattern:
   - All pods: Infrastructure or deployment issue
   - Specific pods: Application or node issue
```

**Comment Format:**
```
Issue: Pod Restarts (5 restarts during test)
Root Cause: OOM kills due to memory limit breach
Evidence:
- Grafana: Restarts correlate with memory hitting 100%
- Pods terminated with exit code 137 (OOM kill)
- Pattern: High-traffic pods restart more frequently
Action: Increase memory limit from 4GB to 8GB per pod
```

### Bottleneck Decision Tree

```
START: Analyze test results

                      Response Time >1000ms OR Error Rate >5%?
                                    |
                          YES ------+------ NO → System Healthy
                          |
                   Check Infrastructure
                          |
        +-----------------+-----------------+
        |                                   |
   CPU >80%?                           Memory >80%?
        |                                   |
    YES | NO                            YES | NO
        |                                   |
   CPU-Bound                           Memory-Bound
        |                                   |
        v                                   v
   - Scale pods                        - Increase limits
   - Optimize                          - Fix memory leaks
     algorithms                        - Profile heap usage
        
                    BOTH <80%?
                        |
                      YES
                        |
            Check New Relic APM Data
                        |
        +---------------+---------------+
        |                               |
   Response time                  Error patterns
   per endpoint?                  by type?
        |                               |
        v                               v
   Slow queries?                  Timeouts?
        |                               |
   Database-Bound               Network/I/O-Bound
        |                               |
        v                               v
   - Optimize queries            - Increase timeouts
   - Add indexes                 - Add connection pools
   - Scale DB                    - Add circuit breakers
   - Cache results               - Retry logic
```

### Sample Analysis Report

**Scenario**: 5,000 users, 69.1% error rate, 7,196ms avg response

```markdown
## Performance Test Analysis

### Test Summary
- Load: 5,000 concurrent users
- Duration: 2 minutes
- Error Rate: 69.1% (CRITICAL)
- Avg Response Time: 7,196ms (7.2x threshold)

### Metrics Collected
**Grafana (Kubernetes):**
- Pods: 21 running (2 killed by OOM)
- CPU: 40-50% utilization (HEALTHY)
- Memory: 65-131% utilization (CRITICAL - exceeds limit)
- Network: 8MB/s RX, 4MB/s TX (NORMAL)

**New Relic (APM):**
- Apdex: 0.12 (CRITICAL)
- Throughput: 406 rpm
- Error Rate: 69.1% (matches test report)
- Slowest Endpoints:
  1. Get_Watch_Again_NEW: 12,500ms avg
  2. Get_Favourite_List: 9,800ms avg
  3. Post_Progress: 8,200ms avg

### Root Cause Analysis

**Primary Bottleneck**: Memory Exhaustion (OOM)

**Evidence**:
1. Grafana shows memory growing from 65% to 131% during test
2. 2 pods killed by OOM (exit code 137)
3. CPU healthy at 40-50% - not CPU-bound
4. New Relic error rate spikes when memory hits 100%
5. All failing endpoints are user-data operations (session-heavy)

**Secondary Issues**:
1. Application memory leak in session management
2. Database connection pool insufficient for load
3. No graceful degradation when memory constrained

### Recommendations

**Immediate (Critical)**:
1. Increase pod memory from 4GB to 8GB minimum
2. Add JVM heap dump on OOM for analysis
3. Review application logs for memory-related errors

**Short-term**:
1. Profile application for memory leaks
2. Increase database connection pool from 20 to 100
3. Implement circuit breakers for user-data endpoints
4. Add memory-based graceful degradation

**Long-term**:
1. Refactor session management (consider Redis)
2. Implement pagination for large result sets
3. Add caching layer for frequently accessed data
4. Scale to 40-50 pods for production readiness

### Safe Operating Capacity
- Current: <500 users (with issues)
- Target (after fixes): 10,000+ users
```

### Best Practices

1. **Always collect both Grafana and New Relic data** - Infrastructure metrics alone don't show application bottlenecks
2. **Cross-reference timestamps** - Correlate spikes across metrics
3. **Look for patterns** - Does issue affect all endpoints or specific ones?
4. **Calculate ratios** - Memory per request, CPU per transaction
5. **Compare iterations** - How do metrics change with load increase?
6. **Document clearly** - Future tests will reference this analysis

---

