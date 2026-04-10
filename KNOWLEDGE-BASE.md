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
- Script automatically detects test time from HTML report
- Duration is parsed from HTML (format: "X minutes and Y seconds")
- Timezone conversion: UTC → IST (GMT+5:30)
- Status auto-determined based on failures (Pass/Fail)

---

## 2. Jenkins Jobs - Locust Load Testing

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

## 3. Complete Load Testing Workflow

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

**Fetch from Grafana/New Relic:**
- Number of Pods
- CPU Allocated & Utilization
- Memory Allocated & Utilization
- Use test timestamp from HTML report to filter metrics

**Monitor for Issues:**
- High response times (>1000ms average)
- High CPU utilization (>80%)
- High memory utilization (>80%)
- Error rates and failure patterns

#### Step 4: Prepare Comment Section
Include in `--comment` parameter:
```
Service: <SERVICE_NAME>
Infrastructure:
- Pods: <COUNT>
- CPU: <ALLOCATED> (<UTILIZATION>% utilized)
- Memory: <ALLOCATED> (<UTILIZATION>% utilized)

Test Results:
- Total endpoints tested: <COUNT>
- Total failures: <COUNT> (<PERCENTAGE>%)
- Max response time: <VALUE>ms

Issues Detected:
- [List any high response times, resource utilization issues from monitoring]
- Slowest endpoints: [List top 5 endpoints with avg response times, if >1000ms]
- Bottleneck endpoint: [Identify endpoint with highest avg response time or failure rate]
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
# Report location: D:\AstroPayTV\PayTV\reports\result.html

# 3. Fetch infra metrics (automatic via Grafana/New Relic APIs using test timestamp)

# 4. Upload results with infrastructure context
node upload-with-template.js "D:\AstroPayTV\PayTV\reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 5000 --rampup "84 seconds" --comment "PayTV Service Load Test\nInfrastructure: 8 Pods | CPU: 4 cores (65% utilized) | Memory: 16GB (72% utilized)\nTotal failures: 125 (0.03%)\nMax response time: 8,234ms\n\nIssues: Response time spike at 11:45 PM, CPU peaked at 78%"
```

### Notes
- Always calculate RampUp as Users/60 for consistent load ramp
- Fetch infrastructure metrics using test start/end timestamps for accuracy
- Monitor both application metrics (Grafana) and APM data (New Relic)
- Document any anomalies or performance issues in the comment section

---

## 4. Breaking Point Load Test Mode

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

For each iteration, follow the **Complete Load Testing Workflow** (Section 3):

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
# Extract test metadata
node inspect-data.js "D:\PerformanceAI\Reports\result.html"
```

##### 2.3 Collect Infrastructure Metrics
```bash
# Fetch pod metrics from Grafana (use test duration + buffer)
node get-pod-metrics.js <SERVICE_NAME> 5

# Fetch APM metrics from New Relic  
node get-apm-metrics.js <SERVICE_NAME> 5
```

##### 2.4 Analyze Metrics & Check Breaking Point Criteria

**From Test Report** (result.html):
- Total requests
- Total failures → Calculate error rate
- Average response time per API
- P95/P99 response times
- Identify slowest endpoints (sort by avg_response_time)

**From Grafana** (get-pod-metrics.js):
- Current CPU utilization per pod
- Current memory utilization per pod
- Pod status (Running/Restarting)
- Container restarts count

**From New Relic** (get-apm-metrics.js):
- Application-level response times
- Host-level response times
- Throughput (requests per minute)
- Error rates

**Breaking Point Check**:
```
BREAKING_POINT = false

IF any API avg_response_time > 1000ms:
  BREAKING_POINT = true
  REASON = "High API Response Time"
  
IF any pod CPU utilization > 80%:
  BREAKING_POINT = true
  REASON = "High CPU Utilization"
  
IF any pod Memory utilization > 80%:
  BREAKING_POINT = true
  REASON = "High Memory Utilization"
  
IF error_rate > 5%:
  BREAKING_POINT = true
  REASON = "High Error Rate"
  
IF any pod restarts detected:
  BREAKING_POINT = true
  REASON = "Pod Instability"
```

##### 2.5 Prepare Comment Section with Breaking Point Status

```bash
# For iterations that PASS (no breaking point)
COMMENT="✅ Breaking Point Test - Iteration <N>

Service: <SERVICE_NAME>
Load: <USER_COUNT> users

Infrastructure:
- Pods: <COUNT>
- CPU: <ALLOCATED> cores (<AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% peak)
- Memory: <ALLOCATED> GB (<AVG_UTILIZATION>% avg, <MAX_UTILIZATION>% peak)

Test Results:
- Total requests: <COUNT>
- Total failures: <COUNT> (<ERROR_RATE>%)
- Avg response time: <VALUE>ms
- P95 response time: <VALUE>ms
- Max response time: <VALUE>ms
- Slowest endpoint: <ENDPOINT_NAME> (<RESPONSE_TIME>ms avg)

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
- Breaking Point Criteria Met:
  * <CRITERIA>: <VALUE> (Threshold: <THRESHOLD>)

Infrastructure at Breaking Point:
- Pods: <COUNT>
- CPU: <ALLOCATED> cores (<UTILIZATION>% utilized)
- Memory: <ALLOCATED> GB (<UTILIZATION>% utilized)

Test Results:
- Total requests: <COUNT>
- Total failures: <COUNT> (<ERROR_RATE>%)
- Avg response time: <VALUE>ms
- P95 response time: <VALUE>ms

Slowest Endpoints (Breaking Point):
1. <ENDPOINT_1>: <RESPONSE_TIME>ms avg (<FAILURES> failures)
2. <ENDPOINT_2>: <RESPONSE_TIME>ms avg (<FAILURES> failures)
3. <ENDPOINT_3>: <RESPONSE_TIME>ms avg (<FAILURES> failures)

Previous Iterations:
- Iteration 1: <USERS> users - ✅ PASS
- Iteration 2: <USERS> users - ✅ PASS
- Iteration <N>: <USERS> users - 🔴 FAIL

Recommendations:
- Maximum safe load: <80% of breaking point> users
- Bottleneck endpoint: <SLOWEST_ENDPOINT_NAME> (optimize this first)
- Infrastructure bottleneck: <IDENTIFIED_BOTTLENECK>
- Suggested action: <SCALING_OR_OPTIMIZATION_ADVICE>"
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
# Output: duration=3m, requests=15000, failures=0, avg_response=250ms

# Step 3: Collect metrics
node get-pod-metrics.js subscriber-event-service 5
# Output: 20 pods, CPU: 15% avg, Memory: 45% avg, No restarts

node get-apm-metrics.js subscriber-event 5
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
# Output: duration=3m, requests=75000, failures=120, avg_response=450ms

# Step 3: Collect metrics
node get-pod-metrics.js subscriber-event-service 5
# Output: 20 pods, CPU: 35% avg, Memory: 60% avg, No restarts

node get-apm-metrics.js subscriber-event 5
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
# Output: duration=3m, requests=150000, failures=2500, avg_response=1250ms

# Step 3: Collect metrics
node get-pod-metrics.js subscriber-event-service 5
# Output: 20 pods, CPU: 75% avg, Memory: 82% avg, No restarts

node get-apm-metrics.js subscriber-event 5
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

