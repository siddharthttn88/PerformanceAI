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
- Format includes:
  - Summary table (Load, Test Time, Test Status, Comment)
  - Data table with 11 columns (API Name, Method, Total Requests, Total Failures, Avg, Min, Max, Median, 90%, 95%, 99%)

### Example
```bash
node upload-with-template.js "D:\AstroPayTV\PayTV\reports\result.html" "1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw" --users 80000 --rampup "1 minute" --comment "PayTV API Load Test - 10 endpoints tested\nTotal failures: 250 (0.05%)\nMax response time: 10,282ms"
```

### Parameters
- `<HTML_REPORT_PATH>`: Path to Locust HTML report file (e.g., `D:\AstroPayTV\PayTV\reports\result.html`)
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

