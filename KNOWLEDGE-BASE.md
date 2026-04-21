# Performance Testing Commands - Knowledge Base

This document contains predefined commands and their usage rules for performance testing automation tasks.

---

## 1. Append Load Test Results to Google Sheet

### Command
```bash
node upload-with-template.js "<HTML_REPORT_PATH>" "<SPREADSHEET_ID>" --users <USER_COUNT> --rampup "<RAMPUP_TIME>" --comment "<COMMENT_TEXT>"
```

### Rules
- **Leave 6 blank lines** beneath previous test results before appending new results
- **Always use result format** from `template.txt`
- **TPS Calculation**: TPS = Users / Ramp up (displays in Load cell)
- **Test Time**: Always extract start time, end time, and duration from `result.html` (auto-detected by script)
  - Script automatically parses test timestamps from HTML report
  - Timezone conversion: UTC → IST (GMT+5:30)
  - Format: "M/D/YYYY, H:MM:SS AM/PM - H:MM:SS AM/PM (X minutes Y seconds)"
- **Infrastructure Config (Add to Comments section)**: 
  - Ask user which service is being tested
  - Fetch correct service name from Grafana dashboard or New Relic
  - Collect: Number of pods, CPU allocated, Memory allocated & there utilization
  - Use test timestamp from HTML report to filter metrics from Grafana/New Relic
  - Include this info in the `--comment` parameter when running the command
- Format includes:
  - Summary table (Load, Test Time, Test Status, Comment)
  - Data table with 11 columns (API Name, Method, Total Requests, Total Failures, Avg, Min, Max, Median, 90%, 95%, 99%)

### Example
```bash
node upload-with-template.js "D:\AstroPayTV\PayTV\reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 80000 --rampup "1 minute" --comment "PayTV API Load Test - 10 endpoints tested\nTotal failures: 250 (0.05%)\nMax response time: 10,282ms"
```

### Parameters
- `<HTML_REPORT_PATH>`: Path to Locust HTML report file (e.g., `D:\AstroPayTV\PayTV\reports\result.html`) or fetch from Reports folder
- `<SPREADSHEET_ID>`: Google Sheet ID from the URL
- `--users`: Actual user count used in the test (required - used to calculate TPS as Users/60)
- `--rampup`: Ramp-up time (e.g., "1 minute", "30 seconds")
- `--comment`: Multi-line comment with test details (use `\n` for line breaks)

### Notes
- **Script automatically extracts all timing information from result.html** - no manual time input needed
- Test start time, end time, and duration are parsed directly from the HTML report
- Duration is parsed from HTML (format: "X minutes and Y seconds")
- Timezone conversion: UTC → IST (GMT+5:30) automatically applied
- Status auto-determined based on failures (Pass/Fail)
- Do not manually specify test times - always let the script read from result.html

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

**Extract Test Duration & Wait:**
```bash
# Extract test duration from result.html
node inspect-data.js "D:\PerformanceAI\Reports\result.html"
# Output shows: duration="3 minutes" or "5 minutes" etc.

# Wait 1 minute after test completion for metrics to stabilize
Start-Sleep -Seconds 60
```

**Fetch from Grafana (Kubernetes Metrics):**
```bash
# Use actual test duration (e.g., if test was 3 minutes, use 3)
node get-pod-metrics.js <service-name> <DURATION_IN_MINUTES>

# Example: For a 3-minute test
node get-pod-metrics.js subscriber-event-service 3
```
- Number of Pods (Running/Pending/Failed)
- CPU Allocated & Utilization per pod
- Memory Allocated & Utilization per pod
- Network I/O (RX/TX rates)
- Pod restarts count
- Pod status and health

**Fetch from New Relic (APM Metrics):**
```bash
# Use actual test duration (e.g., if test was 3 minutes, use 3)
node get-apm-metrics.js <application-name> <DURATION_IN_MINUTES>

# Example: For a 3-minute test
node get-apm-metrics.js subscriber-event 3
```
- Application health status and Apdex score
- Overall response time and throughput
- Error rate and error count
- Host-level metrics (response times per pod)
- Top transactions by count and duration
- Slowest endpoints identification

**Monitor for Issues:**
- High response times (>1000ms average)
- High CPU utilization (>80%)
- High memory utilization (>80%)
- Error rates and failure patterns
- Slow endpoints (P95/P99 > 1000ms)
- Memory pressure (pods exceeding limits)

#### Step 4: Prepare Comment Section
Include in `--comment` parameter:
```
Service: <SERVICE_NAME>

Infrastructure (Kubernetes):
- Pods: <COUNT> (<RUNNING> running, <PENDING> pending, <FAILED> failed)
- CPU: <ALLOCATED> cores (<AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% peak)
- Memory: <ALLOCATED> GB (<AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% peak)
- Network: RX <RX_RATE> KB/s, TX <TX_RATE> KB/s
- Pod Restarts: <COUNT> (if any)

APM Metrics (New Relic):
- Health: <STATUS> | Apdex: <SCORE>
- Response Time: <AVG>ms (P95: <P95>ms, P99: <P99>ms)
- Throughput: <VALUE> rpm
- Error Rate: <PERCENTAGE>%
- Total Errors: <COUNT>

Test Results:
- Total endpoints: <COUNT>
- Total failures: <COUNT> (<PERCENTAGE>%)
- Avg response time: <VALUE>ms
- Max response time: <VALUE>ms

Slowest Endpoints (Top 5):
1. <ENDPOINT_1>: <AVG_TIME>ms avg, <REQUESTS> requests, <FAILURES> failures
2. <ENDPOINT_2>: <AVG_TIME>ms avg, <REQUESTS> requests, <FAILURES> failures
3. <ENDPOINT_3>: <AVG_TIME>ms avg, <REQUESTS> requests, <FAILURES> failures
4. <ENDPOINT_4>: <AVG_TIME>ms avg, <REQUESTS> requests, <FAILURES> failures
5. <ENDPOINT_5>: <AVG_TIME>ms avg, <REQUESTS> requests, <FAILURES> failures

Issues Detected:
- [Analyze Grafana + New Relic data to identify bottlenecks]
- Bottleneck Type: <CPU/Memory/Database/Network/Application>
- Root Cause: <Brief analysis based on metrics>
- Recommended Action: <Specific suggestion based on data>
```

#### Step 5: Upload to Google Sheet
```bash
node upload-with-template.js "<HTML_REPORT_PATH>" "<SPREADSHEET_ID>" --users <USER_COUNT> --rampup "<RAMPUP_TIME>" --comment "<COMMENT_TEXT_WITH_INFRA_METRICS>"
```

### Example Complete Workflow
```bash
# 1. Run test
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.202 Users=5000 RampUp=84 Duration=5m

# 2. Wait for completion and fetch report
node jenkins-client.js wait "Locust - Test Runner" 427
# Report location: D:\PerformanceAI\Reports\result.html

# Extract test duration and wait 1 minute
node inspect-data.js "D:\PerformanceAI\Reports\result.html"
# Output: duration="5 minutes" (use 5 for metrics collection)
Start-Sleep -Seconds 60

# 3. Fetch infrastructure metrics (using actual test duration)
node get-pod-metrics.js subscriber-event 5
# Output: 20 pods, CPU: 35% avg, Memory: 60% avg, No restarts

node get-apm-metrics.js subscriber-event 5
# Output: Response time: 450ms avg, Throughput: 25000 rpm, Error rate: 0.16%, Top transactions

# 4. Analyze metrics and identify issues
# - Compare Grafana (infrastructure) vs New Relic (application) metrics
# - Identify slowest endpoints from New Relic Top Transactions
# - Check for resource bottlenecks (CPU/Memory >80%)
# - Correlate error patterns with infrastructure events

# 5. Upload results with comprehensive analysis
node upload-with-template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 5000 --rampup "1 minute" --comment "Subscriber Event Service Load Test

Infrastructure (Kubernetes):
- Pods: 20 (all running, no restarts)
- CPU: 4 cores allocated (35% avg, 42% peak)
- Memory: 4 GB allocated (60% avg, 68% peak)
- Network: RX 8,200 KB/s, TX 4,100 KB/s

APM Metrics (New Relic):
- Health: Green | Apdex: 0.94
- Response Time: 450ms avg (P95: 670ms, P99: 820ms)
- Throughput: 25,000 rpm
- Error Rate: 0.16%
- Total Errors: 120

Test Results:
- Total endpoints: 12
- Total requests: 75,000
- Total failures: 120 (0.16%)
- Avg response time: 450ms
- Max response time: 1,850ms

Slowest Endpoints (Top 5):
1. /api/get-history: 820ms avg, 15,000 requests, 80 failures
2. /api/search-content: 650ms avg, 12,000 requests, 25 failures
3. /api/get-recommendations: 580ms avg, 10,000 requests, 15 failures
4. /api/user-profile: 420ms avg, 18,000 requests, 0 failures
5. /api/get-favorites: 380ms avg, 8,000 requests, 0 failures

Analysis:
- Bottleneck: Database queries (get-history endpoint)
- Root Cause: Unoptimized queries without proper indexing
- Evidence: 
  * CPU/Memory healthy (<70%) but response times elevated
  * Slowest endpoints all DB-heavy operations
  * Linear degradation with request count
- Recommended Action: Add database indexes on history table, implement query caching

Status: PASS - All metrics within acceptable thresholds
Next Steps: Optimize database queries before scaling to 10K users"
```

### Notes
- **Always wait 1 minute** after test completion before collecting metrics to allow stabilization
- **Always use actual test duration** from result.html for metrics collection (not hardcoded values)
- **Always collect both Grafana and New Relic metrics** - Infrastructure alone doesn't reveal application bottlenecks
- Calculate RampUp as Users/60 for 1-minute ramp (or Users/RampupSeconds for custom durations)
- Fetch infrastructure metrics using test start/end timestamps for accuracy
- Monitor both application metrics (Grafana/Prometheus) and APM data (New Relic)
- **Cross-reference metrics**: High response time + low CPU/Memory = I/O bottleneck (database/network)
- **Identify slowest endpoints**: Use New Relic Top Transactions to prioritize optimization
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
# Extract test metadata and duration
node inspect-data.js "D:\PerformanceAI\Reports\result.html"
# Output: duration="3 minutes" (note the duration value for Step 2.3)

# Wait 1 minute after test completion for metrics to stabilize
Start-Sleep -Seconds 60
```

##### 2.3 Collect Infrastructure Metrics
```bash
# Fetch pod metrics from Grafana/Prometheus (Kubernetes infrastructure)
# Use actual test duration extracted from result.html (e.g., 3 for 3 minutes)
node get-pod-metrics.js <SERVICE_NAME> <DURATION_IN_MINUTES>
# Returns: Pod count, CPU/Memory utilization, Network I/O, Pod status, Restarts

# Fetch APM metrics from New Relic (Application performance)
# Use actual test duration extracted from result.html (e.g., 3 for 3 minutes)
node get-apm-metrics.js <APPLICATION_NAME> <DURATION_IN_MINUTES>
# Returns: Response times, Throughput, Error rates, Top transactions, Slowest endpoints
```

##### 2.4 Analyze Metrics & Check Breaking Point Criteria

**From Test Report** (result.html):
- Total requests
- Total failures → Calculate error rate
- Average response time per API
- P95/P99 response times
- Identify slowest endpoints (sort by avg_response_time)

**From Grafana/Prometheus** (get-pod-metrics.js):
- Pod count and status (Running/Pending/Failed)
- Current CPU utilization per pod (millicores)
- Current memory utilization per pod (MB)
- CPU/Memory as % of allocated limits
- Pod restarts count (last 5 minutes)
- Network I/O (RX/TX rates in KB/s)

**From New Relic** (get-apm-metrics.js):
- Application health status and Apdex score
- Application-level response times (avg, P95, P99)
- Host-level response times (per pod/instance)
- Throughput (requests per minute)
- Error rates and total error count
- Top transactions by request count
- Slowest transactions by avg duration
- Recent deployments (if any)

**Breaking Point Check**:
```
BREAKING_POINT = false
REASONS = []

# From Test Report (result.html)
IF any API avg_response_time > 1000ms:
  BREAKING_POINT = true
  REASONS.append("High API Response Time: <ENDPOINT> at <VALUE>ms")
  
IF error_rate > 5%:
  BREAKING_POINT = true
  REASONS.append("High Error Rate: <VALUE>%")

# From Grafana/Prometheus
IF any pod CPU utilization > 80%:
  BREAKING_POINT = true
  REASONS.append("High CPU Utilization: <POD_NAME> at <VALUE>%")
  
IF any pod Memory utilization > 80%:
  BREAKING_POINT = true
  REASONS.append("High Memory Utilization: <POD_NAME> at <VALUE>%")
  
IF any pod restarts detected:
  BREAKING_POINT = true
  REASONS.append("Pod Instability: <COUNT> restarts detected")

# From New Relic APM
IF APM response_time > 1000ms:
  BREAKING_POINT = true
  REASONS.append("High APM Response Time: <VALUE>ms")
  
IF APM error_rate > 5%:
  BREAKING_POINT = true
  REASONS.append("High APM Error Rate: <VALUE>%")

# Additional Analysis
IDENTIFY_BOTTLENECK():
  IF CPU > 80%: BOTTLENECK = "CPU Bound"
  ELSE IF Memory > 80%: BOTTLENECK = "Memory Bound"
  ELSE IF response_time high AND CPU/Memory low: BOTTLENECK = "I/O Bound (Database/Network)"
  ELSE IF error_rate high: BOTTLENECK = "Application-level errors"
```

##### 2.5 Prepare Comment Section with Breaking Point Status

```bash
# For iterations that PASS (no breaking point)
COMMENT="✅ Breaking Point Test - Iteration <N>

Service: <SERVICE_NAME>
Load: <USER_COUNT> users

Infrastructure (Kubernetes):
- Pods: <COUNT> (<RUNNING> running, <PENDING> pending)
- CPU: <ALLOCATED> cores (<AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% peak)
- Memory: <ALLOCATED> GB (<AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% peak)
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

Slowest Endpoints (Top 3):
1. <ENDPOINT_1>: <RESPONSE_TIME>ms avg
2. <ENDPOINT_2>: <RESPONSE_TIME>ms avg
3. <ENDPOINT_3>: <RESPONSE_TIME>ms avg

Analysis:
- Bottleneck: None identified
- CPU/Memory: Healthy (<80% utilization)
- Response Times: Within SLA (<1000ms)
- Error Rate: Acceptable (<5%)

Status: ✅ PASS - No breaking point criteria met
Next: Continue to iteration <N+1>"
```

```bash
# For iteration that FAILS (breaking point reached)
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
- CPU: <ALLOCATED> cores (<AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% peak)
- Memory: <ALLOCATED> GB (<AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% peak)
- Critical Pod: <POD_NAME> - Memory: <VALUE>% (exceeds limit)
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

Slowest Endpoints (Breaking Point):
1. <ENDPOINT_1>: <RESPONSE_TIME>ms avg (<FAILURES> failures)
2. <ENDPOINT_2>: <RESPONSE_TIME>ms avg (<FAILURES> failures)
3. <ENDPOINT_3>: <RESPONSE_TIME>ms avg (<FAILURES> failures)

Root Cause Analysis:
- Primary Bottleneck: <CPU/Memory/I/O/Application>
- Secondary Issues: <LIST>
- Evidence:
  * <METRIC_1>: <VALUE> indicates <ISSUE>
  * <METRIC_2>: <VALUE> indicates <ISSUE>

Test Progression:
- Iteration 1: <USERS> users - ✅ PASS (<RT>ms, <ERR>% error, CPU <CPU>%, Mem <MEM>%)
- Iteration 2: <USERS> users - ✅ PASS (<RT>ms, <ERR>% error, CPU <CPU>%, Mem <MEM>%)
- Iteration <N>: <USERS> users - 🔴 FAIL (<RT>ms, <ERR>% error, CPU <CPU>%, Mem <MEM>%)

Recommendations:
- Maximum safe load: <80% of breaking point> users
- Immediate Actions:
  1. <ACTION_1_BASED_ON_BOTTLENECK>
  2. <ACTION_2_BASED_ON_METRICS>
  3. <ACTION_3_FOR_OPTIMIZATION>
- Bottleneck Endpoint: <SLOWEST_ENDPOINT_NAME> (optimize this first)
- Infrastructure Action: <SCALING_OR_RESOURCE_INCREASE>
- Application Action: <CODE_OR_CONFIG_OPTIMIZATION>"
```

##### 2.6 Upload Results to Google Sheet
```bash
node upload-with-template.js "D:\PerformanceAI\Reports\result.html" "<SPREADSHEET_ID>" --users <USER_COUNT> --rampup "<RAMPUP_TIME>" --comment "<PREPARED_COMMENT>"
```

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

#### Iteration 1: 1,000 Users

```bash
# Step 1: Run test
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.34 Users=1000 RampUp=17 Duration=3m
node jenkins-client.js wait "Locust - Test Runner" 426

# Step 2: Fetch report (auto-saved)
node inspect-data.js "D:\PerformanceAI\Reports\result.html"
# Output: duration="3 minutes", requests=15000, failures=0, avg_response=250ms

# Wait 1 minute for metrics to stabilize
Start-Sleep -Seconds 60

# Step 3: Collect metrics (using test duration: 3 minutes)
node get-pod-metrics.js subscriber-event-service 3
# Output: 20 pods, CPU: 15% avg, Memory: 45% avg, No restarts

node get-apm-metrics.js subscriber-event 3
# Output: Response time: 250ms avg, Throughput: 5000 rpm, Error rate: 0%

# Step 4: Check breaking point
# ✅ Response time: 250ms (<1000ms) - PASS
# ✅ CPU: 15% (<80%) - PASS
# ✅ Memory: 45% (<80%) - PASS
# ✅ Error rate: 0% (<5%) - PASS
# ✅ No pod restarts - PASS
# Decision: CONTINUE

# Step 5: Upload results
node upload-with-template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 1000 --rampup "60 seconds" --comment "✅ Breaking Point Test - Iteration 1`nService: subscriber-event-service`nLoad: 1,000 users`n`nInfrastructure:`n- Pods: 20`n- CPU: 4 cores (15% avg)`n- Memory: 4 GB (45% avg)`n`nTest Results:`n- Total requests: 15,000`n- Total failures: 0 (0%)`n- Avg response time: 250ms`n- P95: 320ms`n- Slowest endpoint: /api/get-profile (280ms avg)`n`nStatus: ✅ PASS - All criteria met`nNext: Continue to iteration 2"

# Wait 3 minutes for cooldown
Start-Sleep -Seconds 180
```

#### Iteration 2: 5,000 Users

```bash
# Step 1: Run test
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.34 Users=5000 RampUp=84 Duration=3m
node jenkins-client.js wait "Locust - Test Runner" 427

# Step 2: Fetch report
node inspect-data.js "D:\PerformanceAI\Reports\result.html"
# Output: duration="3 minutes", requests=75000, failures=120, avg_response=450ms

# Wait 1 minute for metrics to stabilize
Start-Sleep -Seconds 60

# Step 3: Collect metrics (using test duration: 3 minutes)
node get-pod-metrics.js subscriber-event-service 3
# Output: 20 pods, CPU: 35% avg, Memory: 60% avg, No restarts

node get-apm-metrics.js subscriber-event 3
# Output: Response time: 450ms avg, Throughput: 25000 rpm, Error rate: 0.16%

# Step 4: Check breaking point
# ✅ Response time: 450ms (<1000ms) - PASS
# ✅ CPU: 35% (<80%) - PASS
# ✅ Memory: 60% (<80%) - PASS
# ✅ Error rate: 0.16% (<5%) - PASS
# ✅ No pod restarts - PASS
# Decision: CONTINUE

# Step 5: Upload results
node upload-with-template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 5000 --rampup "60 seconds" --comment "✅ Breaking Point Test - Iteration 2`nService: subscriber-event-service`nLoad: 5,000 users`n`nInfrastructure:`n- Pods: 20`n- CPU: 4 cores (35% avg)`n- Memory: 4 GB (60% avg)`n`nTest Results:`n- Total requests: 75,000`n- Total failures: 120 (0.16%)`n- Avg response time: 450ms`n- P95: 670ms`n- Slowest endpoint: /api/get-history (820ms avg)`n`nStatus: ✅ PASS - All criteria met`nNext: Continue to iteration 3"

# Wait 3 minutes for cooldown
Start-Sleep -Seconds 180
```

#### Iteration 3: 10,000 Users (Breaking Point Reached)

```bash
# Step 1: Run test
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.34 Users=10000 RampUp=167 Duration=3m
node jenkins-client.js wait "Locust - Test Runner" 428

# Step 2: Fetch report
node inspect-data.js "D:\PerformanceAI\Reports\result.html"
# Output: duration="3 minutes", requests=150000, failures=2500, avg_response=1250ms

# Wait 1 minute for metrics to stabilize
Start-Sleep -Seconds 60

# Step 3: Collect metrics (using test duration: 3 minutes)
node get-pod-metrics.js subscriber-event-service 3
# Output: 20 pods, CPU: 75% avg, Memory: 82% avg, No restarts

node get-apm-metrics.js subscriber-event 3
# Output: Response time: 1250ms avg, Throughput: 48000 rpm, Error rate: 1.67%

# Step 4: Check breaking point
# 🔴 Response time: 1250ms (>1000ms) - FAIL
# ✅ CPU: 75% (<80%) - PASS
# 🔴 Memory: 82% (>80%) - FAIL
# ✅ Error rate: 1.67% (<5%) - PASS
# ✅ No pod restarts - PASS
# Decision: BREAKING POINT REACHED - STOP

# Step 5: Upload final breaking point report
node upload-with-template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 10000 --rampup "60 seconds" --comment "🔴 BREAKING POINT TEST - Final Iteration 3`n`nService: subscriber-event-service`nLoad: 10,000 users`n`nBreaking Point Summary:`n- Maximum Stable Load: 5,000 users`n- Breaking Point Load: 10,000 users`n- Criteria Met:`n  * Response Time: 1250ms (Threshold: 1000ms) 🔴`n  * Memory: 82% (Threshold: 80%) 🔴`n`nInfrastructure at Breaking Point:`n- Pods: 20`n- CPU: 4 cores (75% utilized)`n- Memory: 4 GB (82% utilized)`n`nSlowest Endpoints:`n1. /api/get-history: 1850ms avg (1200 failures)`n2. /api/search-content: 1450ms avg (800 failures)`n3. /api/get-recommendations: 1150ms avg (500 failures)`n`nTest Progression:`n- Iteration 1: 1,000 users - ✅ PASS (250ms, CPU 15%, Mem 45%)`n- Iteration 2: 5,000 users - ✅ PASS (450ms, CPU 35%, Mem 60%)`n- Iteration 3: 10,000 users - 🔴 FAIL (1250ms, CPU 75%, Mem 82%)`n`nRecommendations:`n- Maximum safe load: 8,000 users (80% of breaking point)`n- Bottleneck endpoint: /api/get-history (optimize database query first)`n- Infrastructure bottleneck: Memory pressure causing GC overhead`n- Actions: 1) Optimize /api/get-history query, 2) Increase memory to 6GB per pod, or 3) Scale to 30 pods"

# Test complete - breaking point identified at 10,000 users
```

### Automation Tips

**Calculate RampUp for each iteration**:
- Use system-specific formula: RampUp = Users / Ramp-up duration (seconds)
- For 60-second ramp-up: RampUp = Users / 60

**Consistent test duration**:
- Recommended: 3-5 minutes per iteration
- Allows system to stabilize under load

**Metrics collection timing**:
- Always wait 1 minute after test completion before collecting metrics
- Use actual test duration from result.html (not hardcoded values)
- This ensures metrics accurately reflect test period

**Wait time between iterations**:
- Allow 2-3 minutes between tests for system cooldown
- Ensures metrics reset to baseline

**Document all iterations**:
- Upload results after EACH iteration to track progression
- Use 6 blank lines separation between results in Google Sheet

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

