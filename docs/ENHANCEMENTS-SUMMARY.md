# Load Testing Workflow Enhancements - Summary

## Overview
This document summarizes the improvements made to the load testing workflow based on the following requirements:
1. Use exact timestamps from result.html with 1-minute buffer for metrics collection  
2. Show MAX CPU/Memory utilization (not just average)
3. Include top 5 transactions sorted by response time and error rate
4. Extract and display failure status codes from test results
5. Provide deeper APM metrics analysis from New Relic

## New Enhanced Scripts

### 1. inspect-data-enhanced.js
**Purpose**: Extract comprehensive test metadata including timestamps, failure codes, and top endpoints

**Features**:
- ✅ Extracts exact start/end timestamps with 1-minute buffer calculated
- ✅ Parses duration to seconds (for metrics collection)
- ✅ Groups failure status codes by HTTP status (400, 401, 404, 502, 504, etc.)
- ✅ Sorts endpoints by slowest response time (Top 5)
- ✅ Sorts endpoints by highest failure rate (Top 5)
- ✅ Provides both text and JSON output formats

**Usage**:
```bash
# Text format (human-readable)
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" text

# JSON format (for script consumption)
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" json
```

**Key Output**:
- `timestamps.startEpoch` - Test start time (Unix epoch)
- `timestamps.endEpoch` - Test end time (Unix epoch)
- `timestamps.bufferEndEpoch` - End time + 60 seconds (for metrics stabilization)
- `duration.secondsWithBuffer` - Test duration + 60 seconds
- `failureStatusCodes[]` - Array of HTTP status codes with counts
- `top5SlowestEndpoints[]` - Sorted by avg_response_time descending
- `top5HighestFailureEndpoints[]` - Sorted by failure_rate descending

### 2. get-pod-metrics-enhanced.js
**Purpose**: Collect Kubernetes infrastructure metrics with exact time ranges and AVG/MAX statistics

**Features**:
- ✅ Accepts exact epoch timestamps (start/end) instead of just "minutes"
- ✅ Calculates **both AVG and MAX** CPU utilization over the test period
- ✅ Calculates **both AVG and MAX** Memory utilization over the test period
- ✅ Properly shows % of resource limits (fixed calculation)
- ✅ Detects pod restarts during test period
- ✅ Uses Prometheus range queries for accurate historical data

**Usage**:
```bash
# Using exact timestamps (recommended)
node get-pod-metrics-enhanced.js subscriber-event-service 1776753979 1776754339

# Using minutes (legacy mode)
node get-pod-metrics-enhanced.js subscriber-event-service 5
```

**Key Improvements**:
- **BEFORE**: Only showed current/average CPU (e.g., 56% avg)
- **AFTER**: Shows both AVG and MAX CPU (e.g., 29.7% avg, **100.1% max**)
- This explains the discrepancy: New Relic showed 99% peak, original script only showed average!

### 3. get-apm-metrics-enhanced.js
**Purpose**: Collect New Relic APM metrics with exact time ranges and detailed transaction analysis

**Features**:
- ✅ Accepts exact epoch timestamps for precise test period analysis
- ✅ Retrieves **Top N slowest transactions** sorted by average duration
- ✅ Retrieves **Top N highest error rate transactions** sorted by error percentage
- ✅ Provides error breakdown by HTTP status code (when available)
- ✅ Shows transaction-level metrics (count, avg, P95, P99)
- ✅ Includes host-level performance breakdown

**Usage**:
```bash
# Using exact timestamps with top 10 transactions
node get-apm-metrics-enhanced.js subscriber-event 1776753979 1776754339 10

# Using exact timestamps with top 5 transactions
node get-apm-metrics-enhanced.js subscriber-event 1776753979 1776754339 5

# Using minutes (legacy mode)
node get-apm-metrics-enhanced.js subscriber-event 5 10
```

**Key Output**:
- `topSlowTransactions[]` - Top N transactions by avg_duration
- `topErrorTransactions[]` - Top N transactions by error_rate
- HTTP status code error breakdown
- Host-level response time and throughput

## Updated Workflow

### Step-by-Step Enhanced Process

#### 1. Run Load Test
```bash
node jenkins-client.js build "Locust - Test Runner" Master_IP=10.16.6.30 Users=20000 RampUp=167 Duration=5m
node jenkins-client.js wait "Locust - Test Runner" 466
```

#### 2. Extract Test Metadata (NEW ENHANCED TOOL)
```bash
node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" text
```
**Extract from output**:
- Start Epoch: `1776753979`
- Buffer End Epoch: `1776754339` (includes 1-minute buffer)
- Duration with Buffer: `360s`
- Failure Status Codes
- Top 5 Slowest Endpoints
- Top 5 Highest Failure Endpoints

**Wait 1 minute for metrics to stabilize** (already included in timestamps):
```powershell
Start-Sleep -Seconds 60
```

#### 3. Collect Infrastructure Metrics (NEW ENHANCED TOOL)
```bash
# Use exact timestamps from Step 2
node get-pod-metrics-enhanced.js subscriber-event-service 1776753979 1776754339
```
**Extract from output**:
- Pod Count
- CPU: `29.7% avg, 100.1% max` ← **Shows both AVG and MAX!**
- Memory: `44.9% avg, 66.8% max`
- Pod Restarts (if any)
- Per-pod detailed statistics

#### 4. Collect APM Metrics (NEW ENHANCED TOOL)
```bash
# Use exact timestamps from Step 2
node get-apm-metrics-enhanced.js subscriber-event 1776753979 1776754339 5
```
**Extract from output**:
- Application health, Apdex, response time
- Top 5 Slowest Transactions (with avg duration and request count)
- Top 5 Highest Error Rate Transactions (with error % and counts)
- HTTP status error breakdown
- Host-level metrics

#### 5. Prepare Enhanced Comment Section
```
🔴 BREAKING POINT TEST - Iteration 2

Service: paytv-load-test-subscriber-event-service
Load: 20,000 users | Ramp-up: 2 minutes | Duration: 5 minutes

Test Timestamps:
- Start: 2026-04-21T06:46:19Z (Epoch: 1776753979)
- End: 2026-04-21T06:51:19Z (Epoch: 1776754279)
- Metrics Buffer: +60 seconds (Epoch: 1776754339)

Breaking Point Summary:
- Maximum Stable Load: 10,000 users
- Breaking Point Load: 20,000 users
- Criteria Met:
  * Response Time: 5,856ms (Threshold: 1000ms) 🔴
  * Error Rate: 51.7% (Threshold: 5%) 🔴
  * APM Response Time: 1,353ms (Threshold: 1000ms) 🔴

Infrastructure at Breaking Point (Kubernetes):
- Pods: 10 (all running, no restarts)
- CPU: 4 cores allocated per pod
  * AVG: 29.7% (HEALTHY)
  * MAX: 100.1% (PEAK REACHED) 🔴
- Memory: 4 GB allocated per pod
  * AVG: 44.9% (HEALTHY)
  * MAX: 66.8% (HEALTHY)
- Status: CPU peaked at 100%, Memory healthy - NOT the bottleneck

APM Metrics at Breaking Point (New Relic):
- Health: Gray | Apdex: 1.0
- Response Time: 1,353ms avg
- Throughput: 17,850 rpm (requests per minute)
- Total Errors: 0 (timeouts classified as failures in Locust, not APM errors)

Top 5 Slowest Endpoints (by Avg Response Time):
1. GET v3/favourites: 5,425ms avg (15,211 requests, 58.39% error rate) 🔴
2. GET v3/continue-watch/continue: 2,363ms avg (19,711 requests, 55.52% error rate) 🔴
3. POST cw/{version}/progress: 545ms avg (16,636 requests, 49.51% error rate)
4. GET v3/continue-watch/content/recent: 293ms avg (17,552 requests, 10.81% error rate)
5. GET v3/watch-again/new: 28ms avg (15,815 requests, 0.07% error rate) ✅

Top 5 Highest Failure Rate Endpoints:
1. GET v3/favourites: 58.39% error (15,211 requests, 8,882 failures) 🔴
2. GET v3/continue-watch/continue: 55.52% error (19,711 requests, 10,944 failures) 🔴
3. POST cw/{version}/progress: 49.51% error (16,636 requests, 8,236 failures) 🔴
4. GET v3/continue-watch/content/recent: 10.81% error (17,552 requests, 1,898 failures)
5. POST v3/favourites: 0.07% error (1,496 requests, 1 failure)

Failure Status Codes:
- 504 Gateway Timeout: 297,092 failures (99.87%)
  * Primary cause: Backend service saturation/timeouts
  * Affected endpoints: All high-traffic endpoints
- 401 Unauthorized: 183 failures (0.06%)
  * Authentication token expiry under load
- 404 Not Found: 175 failures (0.06%)
  * POST post_Last_Tuned_Channel endpoint
- 502 Bad Gateway: 11 failures (<0.01%)
  * DELETE Remove_Favourite endpoint
- 400 Bad Request: 2 failures (<0.01%)
  * POST Add_to_Favourite endpoint

Root Cause Analysis:
- Primary Bottleneck: I/O Bound (Database/External Service) NOT CPU/Memory
- Secondary Issues:
  1. Backend service connection pool exhaustion (504 timeouts dominate)
  2. CPU peaked at 100% on some pods (brief spikes, not sustained)
  3. Response time degraded 48x without infrastructure resource exhaustion
  4. Timeout cascades causing downstream failures

Evidence:
- Infrastructure CPU/Memory healthy on average (30%/45%) but peaked momentarily (100%/67%)
- 504 timeouts indicate backend services (DB/cache) cannot keep pace
- Slowest endpoints are all query-heavy (v3/favourites, continue-watch)
- APM shows high transaction duration but low APM error count (timeouts not logged as errors)

Test Progression:
- Iteration 1: 10,000 users - ✅ PASS (117ms avg, 0.13% error, CPU 30% avg/76% max, Mem 40% avg/57% max)
- Iteration 2: 20,000 users - 🔴 FAIL (5,856ms avg, 51.7% error, CPU 30% avg/100% max, Mem 45% avg/67% max)

Recommendations:
- Maximum safe load: 10,000 concurrent users (confirmed stable)
- Immediate Actions:
  1. **CRITICAL**: Optimize v3/favourites endpoint (5.4s avg → target <1s)
     - Review database query execution plan
     - Add missing indexes   
     - Implement query result caching (Redis/Memcached)
  2. **HIGH**: Increase database connection pool from default to 100+
  3. **HIGH**: Scale backend database (read replicas, query optimization)
  4. **MEDIUM**: Investigate brief CPU spikes (100% peak despite 30% avg)
     - Possible GC pauses or thread contention
     - Consider increasing CPU limit from 4 to 6 cores per pod
  5. **LOW**: Implement circuit breakers for failing endpoints to prevent cascade
  6. **LOW**: Add request timeout handling (currently waiting for 504 timeouts)

- Bottleneck Endpoints: v3/favourites (5.4s avg) and v3/continue-watch/continue (2.4s avg)
- Infrastructure Action: Scale backend services (database/cache) NOT application pods
- Application Action: Optimize slow queries, increase connection pools, add caching
```

#### 6. Upload Results
```bash
node upload-with-Locust_Template.js "D:\PerformanceAI\Reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 20000 --rampup "2 minutes" --targettps 167 --timezone "local" --sheet "Subscriber_17-04-26" --comment "<ENHANCED_COMMENT_FROM_STEP_5>"
```

## Key Improvements Summary

### ✅ Issue 1: Exact Timestamps with Buffer
- **BEFORE**: Used `node get-pod-metrics.js service 5` (last 5 minutes from NOW)
- **AFTER**: Uses `node get-pod-metrics-enhanced.js service 1776753979 1776754339` (exact test period + 60s buffer)
- **Result**: Metrics now accurately reflect the test period, not random 5-minute window

### ✅ Issue 2: MAX CPU Utilization
- **BEFORE**: Only showed "CPU: 56% avg" - missed the peak!
- **AFTER**: Shows "CPU: 29.7% avg, **100.1% max**" - reveals the truth!
- **Impact**: Explains New Relic's 99% reading - pods briefly hit 100% CPU during test

### ✅ Issue 3: Top 5 Transactions Sorting
- **BEFORE**: No sorting, transactions shown in arbitrary order
- **AFTER**: Two sorted lists:
  1. Top 5 by slowest avg response time
  2. Top 5 by highest error rate %
- **Result**: Immediate visibility into optimization priorities

### ✅ Issue 4: Failure Status Codes
- **BEFORE**: No breakdown of HTTP error codes in comment
- **AFTER**: Complete breakdown:
  - 504: 297,092 (99.87%) ← Primary issue
  - 401: 183 (0.06%)
  - 404: 175 (0.06%)
  - 502: 11 (<0.01%)
  - 400: 2 (<0.01%)
- **Result**: Clear identification of backend timeout issues (504 dominant)

### ✅ Issue 5: Deeper APM Analysis
- **BEFORE**: Basic APM summary (response time, throughput)
- **AFTER**: Comprehensive analysis:
  - Top slowest transactions with request counts
  - Top error-prone transactions with failure rates
  - Error breakdown (when available)
  - Host-level performance metrics
- **Result**: Pinpoint optimization targets (v3/favourites: 5.4s avg!)

## Migration Guide

### Old Workflow → New Workflow

```bash
# OLD WORKFLOW (Approximate timestamps, only AVG metrics)
node inspect-data.js
Start-Sleep -Seconds 60
node get-pod-metrics.js subscriber-event-service 5
node get-apm-metrics.js subscriber-event 5

# NEW WORKFLOW (Exact timestamps, AVG+MAX metrics, sorted transactions)
$metadata = node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" json | ConvertFrom-Json
Start-Sleep -Seconds 60
node get-pod-metrics-enhanced.js subscriber-event-service $metadata.timestamps.startEpoch $metadata.timestamps.bufferEndEpoch
node get-apm-metrics-enhanced.js subscriber-event $metadata.timestamps.startEpoch $metadata.timestamps.bufferEndEpoch 5
```

### PowerShell Integration Example

```powershell
# Extract metadata with enhanced script
$metadataJson = node inspect-data-enhanced.js "D:\PerformanceAI\Reports\result.html" json
$metadata = $metadataJson | ConvertFrom-Json

# Wait 1 minute (buffer)
Write-Host "Waiting 60 seconds for metrics stabilization..."
Start-Sleep -Seconds 60

# Collect infrastructure metrics with exact timestamps
Write-Host "`nCollecting Kubernetes metrics..."
node get-pod-metrics-enhanced.js subscriber-event-service $metadata.timestamps.startEpoch $metadata.timestamps.bufferEndEpoch

# Collect APM metrics with exact timestamps
Write-Host "`nCollecting New Relic APM metrics..."
node get-apm-metrics-enhanced.js subscriber-event $metadata.timestamps.startEpoch $metadata.timestamps.bufferEndEpoch 5

# Display top issues
Write-Host "`nTop 5 Slowest Endpoints:"
$metadata.top5SlowestEndpoints | ForEach-Object {
    Write-Host "  - $($_.method) $($_.name): $($_.avg_response_time)ms avg ($($_.failure_rate)% error)"
}

Write-Host "`nFailure Status Codes:"
$metadata.failureStatusCodes | ForEach-Object {
    Write-Host "  - Status $($_.code): $($_.count) failures"
}
```

## Files Created

1. **inspect-data-enhanced.js** - Enhanced test metadata extraction
2. **get-pod-metrics-enhanced.js** - Enhanced Kubernetes metrics with AVG/MAX
3. **get-apm-metrics-enhanced.js** - Enhanced APM metrics with transaction sorting
4. **ENHANCEMENTS-SUMMARY.md** - This document

## Original Files (Keep for Backward Compatibility)

- `inspect-data.js` - Basic metadata extraction (legacy)
- `get-pod-metrics.js` - Basic infrastructure metrics (legacy)
- `get-apm-metrics.js` - Basic APM metrics (legacy)

## Next Steps for Full Adoption

1. ✅ Test all enhanced scripts with production data
2. ✅ Validate metrics accuracy against actual test results
3. ⏳ Update all KNOWLEDGE-BASE.md examples with new workflows
4. ⏳ Create example PowerShell automation scripts
5. ⏳ Train team on new enhanced workflow
6. ⏳ Deprecate old scripts after 2-week transition period

## Support

For issues or questions about the enhanced workflow:
1. Review this ENHANCEMENTS-SUMMARY.md document
2. Check KNOWLEDGE-BASE.md for updated workflow examples
3. Test with the breaking point test data (Build #465, #466)
4. Compare old vs new script outputs to understand improvements
