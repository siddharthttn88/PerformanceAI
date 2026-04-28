# Project Structure Reference

## 📊 Quick Overview

```
PerformanceAI/
├── 📂 src/           (21 files) - Source code modules
├── 📂 config/        (9 files)  - Configuration & credentials  
├── 📂 templates/     (8 files)  - Locust & email templates
├── 📂 docs/          (5 files)  - Documentation & guides
├── 📂 data/          (2 files)  - Extracted data & images
├── 📂 Reports/       (1 file)   - Test result reports
└── 📄 README.md                 - Main documentation
```

## 🗂️ Detailed Breakdown

### src/ - Source Code (21 files)

#### src/clients/ (3 files)
- `jenkins-client.js` - Jenkins API integration
- `newrelic-client.js` - New Relic APM client
- `grafana-reader.js` - Grafana dashboard reader

#### src/metrics/ (7 files)
- `get-apm-metrics-enhanced.js` - Enhanced APM metrics with error handling
- `get-apm-metrics.js` - Basic APM metrics
- `get-pod-metrics-enhanced.js` - Enhanced pod/infra metrics
- `get-pod-metrics.js` - Basic pod metrics
- `query-newrelic-timerange.js` - Time-range based New Relic queries
- `query-timerange.js` - Generic time-range queries
- `list-services.js` - List available services

#### src/reporting/ (6 files)
- `send-email-report.js` - **⭐ Email report with P90/P95 fix**
- `locust-to-gsheet.js` - Upload Locust results to Google Sheets
- `read-gsheet.js` - Read data from Google Sheets
- `upload-results-clean.js` - Clean upload of results
- `upload-with-Locust_Template.js` - Upload using Locust template
- `upload-with-template.js` - Generic template upload

#### src/utils/ (5 files)
- `debug-html.js` - Debug HTML report structure
- `debug-locust.js` - Debug Locust output
- `inspect-data-enhanced.js` - Enhanced data inspection
- `inspect-data.js` - Basic data inspection
- `test-percentiles-fix.js` - Validate percentile extraction

---

### config/ - Configuration (9 files)

**Main Config:**
- `config.json` - Main configuration (gitignored)
- `config.example.json` - Configuration template
- `credentials.json` - API credentials (gitignored)
- `credentials.example.json` - Credentials template

**Test Setup:**
- `test-keywords.json` - **⭐ Test scenario keywords**
- `masterIP.txt` - Master node IP for distributed testing
- `slavesIPs.txt` - Slave nodes IPs (comma-separated)

**Email Setup:**
- `stakeholder-email.csv` - Email distribution list
- `stakeholder-email.md` - Email configuration guide

---

### templates/ - Templates (8 files)

**Locust Templates:**
- `Locust_Template.csv` - Main CSV template
- `Locust_Template.md` - Template documentation
- `Locust_Template.txt` - Text format template
- `Locust_Template_Example.csv` - Example usage

**XML Configs:**
- `locust-config.xml` - Original Locust config
- `locust-config-fixed.xml` - Fixed version
- `locust-new-config.xml` - New config format

**Other:**
- `template.txt` - Generic template

---

### docs/ - Documentation (5 files)

- `README.md` - Duplicate of root README (from old structure)
- `SETUP.md` - Complete setup guide
- `KNOWLEDGE-BASE.md` - Technical knowledge base
- `ENHANCEMENTS-SUMMARY.md` - Enhancement history
- `EMAIL-REPORT-ENHANCEMENTS.md` - Email report improvements

---

### data/ - Data Files (2 files)

- `extracted-data.json` - Extracted test data
- `testResultTemplate.png` - Email report template image

---

### Reports/ - Test Reports (1 file)

- `result.html` - Latest Locust test report

---

## 🎯 Key Files by Function

### Running Tests
1. Check [config/test-keywords.json](../config/test-keywords.json) for keywords
2. Provide test parameters
3. Let AI generate and execute test

### Collecting Metrics
1. Run [src/metrics/get-apm-metrics-enhanced.js](../src/metrics/get-apm-metrics-enhanced.js)
2. Run [src/metrics/get-pod-metrics-enhanced.js](../src/metrics/get-pod-metrics-enhanced.js)
3. Data saved to [data/extracted-data.json](../data/extracted-data.json)

### Generating Reports
1. Test results in [Reports/result.html](../Reports/result.html)
2. Run [src/reporting/send-email-report.js](../src/reporting/send-email-report.js)
3. Email sent to addresses in [config/stakeholder-email.csv](../config/stakeholder-email.csv)

### Uploading Results
1. Run [src/reporting/locust-to-gsheet.js](../src/reporting/locust-to-gsheet.js)
2. Uses config from [config/config.json](../config/config.json)
3. Uploads to Google Sheets

---

## 🔐 Security Notes

**Gitignored Files:**
- `config/config.json` - Contains Google Sheets IDs, Jenkins URLs
- `config/credentials.json` - Contains API keys, tokens, passwords
- `Reports/` - May contain sensitive test data

**Committed Files:**
- `*.example.json` - Safe templates without credentials
- `test-keywords.json` - Safe test configurations
- All source code in `src/`

---

## 📝 Path Updates Required

If you have scripts that reference old paths, update them:

| Old Path | New Path |
|----------|----------|
| `./send-email-report.js` | `./src/reporting/send-email-report.js` |
| `./get-apm-metrics-enhanced.js` | `./src/metrics/get-apm-metrics-enhanced.js` |
| `./config.json` | `./config/config.json` |
| `./test-keywords.json` | `./config/test-keywords.json` |
| `./Locust_Template.csv` | `./templates/Locust_Template.csv` |

---

**Last Updated:** April 28, 2026  
**Structure Version:** 2.0
