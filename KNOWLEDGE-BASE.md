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
- `RampUp` (default: "16") - Ramp-up time in seconds (Users/RampUp = users/sec)
- `Duration` (default: "3m") - Test duration (e.g., "3m", "30s", "1h")

**Usage**:
```bash
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.7.202 Users=80000 RampUp=1334 Duration=3m
# Note: Calculate RampUp = Users/60 before passing (80000/60 ≈ 1334)
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

