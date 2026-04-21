# Subscriber Template Format Documentation

Based on analysis of the Subscriber_21-04-26 sheet from Google Sheets.

## Created Template Files

1. **template-subscriber-21-04-26.txt** - Detailed documentation with explanations
2. **template-subscriber-format.csv** - Blank template with placeholders
3. **template-subscriber-example.csv** - Complete example with actual data

---

## Format Structure

### Row Layout

```
Row 1:  [BLANK]
Row 2:  [BLANK]
Row 3:  Load | {Users} Users ({Target_TPS}TPS) | Total TPS on service = {Actual_TPS}
Row 4:  Test Time | "{Date}, {Time} - {Date}, {Time} ({Duration})" | | RampUp - {Time}
Row 5:  Test Status | {PASS/FAIL}
Row 6:  Comment | "{Multi-line infrastructure and configuration details}"
Row 7:  [BLANK]
Row 8:  Type | Name | # Requests | # Fails | Average (ms) | Min (ms) | Max (ms) | RPS | Failures/s | 90%ile (ms) | 95%ile (ms)
Row 9+: {API Method} | {Endpoint Name} | {Request Count} | {Failure Count} | ... [API data]
```

### Column Details

**Column A:** Labels or HTTP Method (POST/GET/DELETE)
**Column B:** Values or Endpoint Names
**Column C:** Additional info or # Requests
**Column D:** (varies) or # Fails
**Column E-K:** Metrics data

---

## Key Differences from Original Template (template.txt)

### 1. **TPS Representation**
- **Original**: Single TPS value in Load cell
- **Subscriber**: Two TPS values
  - Target TPS in parentheses: `10000 Users (166TPS)`
  - Actual TPS measured: `Total TPS on service = 874`

### 2. **Layout Structure**
- **Original**: 3-column summary table
- **Subscriber**: 4-column summary table with extra column for RampUp

### 3. **Comment Section**
- **Original**: Brief summary with key infrastructure metrics
- **Subscriber**: Detailed multi-line configuration including:
  - Environment type (load env, prod, etc.)
  - Server count (31 servers)
  - Detailed pod configurations per service
  - Feature flags (New Relic enabled/disabled)
  - Recent changes (Redis implementation, Cassandra limits)
  - Configuration settings (operator labels)

### 4. **Test Status Row**
- **Original**: Combined with Load row
- **Subscriber**: Separate dedicated row

### 5. **Time Format**
- **Original**: Timezone specified as IST
- **Subscriber**: Date/time without explicit timezone in display

---

## Data Analysis from Subscriber_21-04-26

### Test Configuration
- **Target Users**: 10,000
- **Target TPS**: 166
- **Actual TPS**: 874 (5.3x higher than target - indicates very efficient test)
- **Ramp-up**: 1 minute
- **Duration**: 5 minutes
- **Status**: PASS

### Infrastructure
- **Execution Servers**: 31 Locust servers
- **Mock Server Pods**: 15
- **Subscriber Event/Producer**: 10 pods (4 core CPU, 4GB RAM)
- **Subscriber Activity Producer**: 1 pod
- **Config Service**: 8 pods
- **Total Pods**: Started with 20 pods
- **Scaling**: Min = Max (no autoscaling)

### Configuration Flags
- ✅ New Relic: ENABLED
- ✅ Operator labels: ENABLED
- ✅ REDIS: Implemented
- ✅ Cassandra limit: Set to 100 for continue watch
- ❌ Language filter: DISABLED

### Performance Results
- **Total Requests**: ~1.5 million
- **Total Failures**: ~210,000 (14% error rate) ⚠️
- **Average Response Time**: ~3,200ms (high)
- **P95 Response Times**: Most endpoints at 10,000ms (timeout threshold)

### Observations
Despite "PASS" status, this test shows concerning metrics:
- High error rates (14%)
- Very high P95 latencies (10 seconds)
- Multiple endpoints hitting timeout limits
- Significant failures on critical operations

This suggests the PASS/FAIL criteria may need revision.

---

## Usage Recommendations

### When to Use Subscriber Format
1. Tests requiring detailed infrastructure documentation
2. Multi-service configurations
3. Complex pod/scaling setups
4. Feature flag tracking
5. Environment-specific configurations

### When to Use Original Format
1. Simple single-service tests
2. Quick validation tests
3. Standard reporting
4. Consistent with KNOWLEDGE-BASE.md workflows

### Creating New Upload Script
Consider creating `upload-with-subscriber-template.js` that:
1. Handles the 4-column summary layout
2. Properly formats TPS (target vs actual)
3. Supports multi-line comment sections
4. Places RampUp in correct column
5. Maintains infrastructure detail structure

---

## Template Variables Reference

### Summary Section
- `{USERS}` - Total concurrent users (e.g., 10000)
- `{TARGET_TPS}` - Calculated or target TPS (e.g., 166)
- `{ACTUAL_TPS}` - Measured RPS from test (e.g., 874)
- `{START_DATE}` - Test start date (e.g., 4/16/2026)
- `{START_TIME}` - Test start time (e.g., 11:45:18 AM)
- `{END_DATE}` - Test end date
- `{END_TIME}` - Test end time
- `{DURATION}` - Test duration (e.g., 5 minutes)
- `{RAMPUP_TIME}` - Ramp-up period (e.g., 1 min)
- `{PASS/FAIL}` - Test status

### Comment Section Template
```
Run on {environment} env
Executed from {server_count} servers
Mock server pods = {count}, subscriber event and producer min pods = {count} ({cpu} core cpu, {memory} gb), subscriber-activity-producer pods = {count}, config service = {count}
Started with {total_pods} pods
Min = Max, NEWRELIC = {ENABLED/DISABLED}

{Feature flags or settings}
{Recent changes}
{Configuration notes}
```

### API Data Rows
- `{METHOD}` - HTTP method (POST, GET, DELETE, PUT, PATCH)
- `{ENDPOINT_NAME}` - API endpoint name
- `{TOTAL_REQUESTS}` - Total request count
- `{TOTAL_FAILURES}` - Failed requests count
- `{AVG_MS}` - Average response time in milliseconds
- `{MIN_MS}` - Minimum response time
- `{MAX_MS}` - Maximum response time
- `{RPS}` - Requests per second for this endpoint
- `{FAILURES_PER_SEC}` - Failures per second
- `{P90_MS}` - 90th percentile response time
- `{P95_MS}` - 95th percentile response time

---

## Integration with Existing Tools

### Compatible Tools
- ✅ `read-gsheet.js` - Can read this format
- ✅ `inspect-data.js` - Can parse result.html
- ✅ `get-pod-metrics.js` - Provides infrastructure data
- ✅ `get-apm-metrics.js` - Provides APM data

### Needs Adaptation
- ⚠️ `upload-with-template.js` - Uses different 3-column format
- ⚠️ Breaking point test workflows - Assume original format

### Recommended Next Steps
1. Create `upload-with-subscriber-template.js` variant
2. Add format selection flag to existing upload script
3. Update KNOWLEDGE-BASE.md with subscriber format section
4. Document format differences in README.md
