# PerformanceAI - Load Testing Automation Framework

Automated load testing framework with Locust, Jenkins integration, metrics collection, and email reporting.

## 📁 Project Structure

```
PerformanceAI/
├── src/                          # Source Code
│   ├── clients/                  # API Clients
│   │   ├── jenkins-client.js     # Jenkins API client
│   │   ├── newrelic-client.js    # New Relic API client
│   │   └── grafana-reader.js     # Grafana API client
│   │
│   ├── metrics/                  # Metrics Collection
│   │   ├── get-apm-metrics-enhanced.js    # Enhanced APM metrics
│   │   ├── get-pod-metrics-enhanced.js    # Enhanced pod metrics
│   │   ├── query-newrelic-timerange.js    # New Relic queries
│   │   └── list-services.js               # Service listing
│   │
│   ├── reporting/                # Reporting & Upload
│   │   ├── send-email-report.js           # Email report generator (P90/P95 fix)
│   │   ├── locust-to-gsheet.js            # Upload to Google Sheets
│   │   ├── upload-results-clean.js        # Clean results uploader
│   │   └── read-gsheet.js                 # Read from Google Sheets
│   │
│   └── utils/                    # Utilities & Debug
│       ├── debug-html.js         # HTML debugging
│       ├── inspect-data-enhanced.js       # Data inspection
│       └── test-percentiles-fix.js        # Percentile validation
│
├── config/                       # Configuration Files
│   ├── config.json               # Main configuration
│   ├── config.example.json       # Configuration template
│   ├── credentials.json          # API credentials (gitignored)
│   ├── credentials.example.json  # Credentials template
│   ├── test-keywords.json        # Test scenario keywords
│   ├── masterIP.txt              # Master node IP
│   ├── slavesIPs.txt             # Slave nodes IPs
│   └── stakeholder-email.csv     # Email distribution list
│
├── templates/                    # Templates
│   ├── Locust_Template.csv       # Locust CSV template
│   ├── Locust_Template.md        # Template documentation
│   ├── locust-config.xml         # Locust configuration
│   └── template.txt              # Generic template
│
├── docs/                         # Documentation
│   ├── SETUP.md                  # Setup instructions
│   ├── KNOWLEDGE-BASE.md         # Project knowledge base
│   └── ENHANCEMENTS-SUMMARY.md   # Enhancement history
│
├── data/                         # Data Files
│   ├── extracted-data.json       # Extracted test data
│   └── testResultTemplate.png    # Result template image
│
├── Reports/                      # Test Reports
│   └── result.html               # Latest test report
│
├── package.json                  # Node.js dependencies
└── .gitignore                    # Git ignore rules
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Settings
```bash
# Copy example configs
cp config/config.example.json config/config.json
cp config/credentials.example.json config/credentials.json

# Edit with your credentials
notepad config/config.json
notepad config/credentials.json
```

### 3. Run Tests Using Keywords

**First Time:**
```
breakpoint-test users: 1000, rampup: 1min, duration: 3min, progression: 5K, 
rampupProgression: 1min, durationProgression: 2min, 
service: paytv-load-test-search-proxy, sheet: Search_2026-04-28_N
```

**Next Times (Reuse Last Parameters):**
```
breakpoint-test                              # Use all last parameters
breakpoint-test service: subscriber-event    # Change only service
```

### 4. Send Email Report
```bash
node src/reporting/send-email-report.js
```

## 🔑 Key Features

✅ **Keyword-Based Testing** - Reuse test configurations with simple keywords  
✅ **Automated Reporting** - Email reports with P90/P95 percentiles  
✅ **Metrics Collection** - APM and infrastructure metrics from New Relic  
✅ **Google Sheets Integration** - Upload results automatically  
✅ **Jenkins Integration** - Trigger and monitor load tests  
✅ **Multi-Service Support** - Test multiple services with same framework  

## 📊 Workflow

1. **Configure Test** → Use keyword or provide parameters
2. **Run Load Test** → Jenkins executes Locust test
3. **Collect Metrics** → APM + Pod metrics extracted
4. **Generate Report** → HTML report from Locust results
5. **Upload to Sheets** → Test data uploaded to Google Sheets
6. **Send Email** → Stakeholders receive detailed report

## 🛠️ Available Scripts

### Metrics Collection
```bash
node src/metrics/get-apm-metrics-enhanced.js
node src/metrics/get-pod-metrics-enhanced.js
```

### Reporting
```bash
node src/reporting/send-email-report.js
node src/reporting/locust-to-gsheet.js
```

### Utilities
```bash
node src/utils/debug-html.js          # Debug HTML report
node src/utils/test-percentiles-fix.js # Validate percentiles
```

## 📝 Test Keywords

Defined in [config/test-keywords.json](config/test-keywords.json):

- **breakpoint-test** - Find system breaking point with incremental load
- **load-test** - Standard load test with fixed parameters
- **smoke-test** - Quick validation test with minimal load

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `config.json` | Main configuration (Google Sheets, Jenkins URLs) |
| `credentials.json` | API credentials (New Relic, Jenkins, Gmail) |
| `test-keywords.json` | Test scenario definitions |
| `stakeholder-email.csv` | Email distribution list |
| `masterIP.txt` | Master node IP for distributed testing |
| `slavesIPs.txt` | Slave nodes IPs for distributed testing |

## 📧 Email Report Features

- ✅ **Fixed P90/P95 Percentiles** - Accurate percentile data from Locust
- ✅ **Infrastructure Metrics** - CPU, Memory, Network usage
- ✅ **APM Metrics** - Response times, throughput, error rates
- ✅ **Endpoint Table** - Per-endpoint performance breakdown
- ✅ **Stakeholder Distribution** - Auto-send to configured recipients

## 📚 Documentation

- [SETUP.md](docs/SETUP.md) - Detailed setup instructions
- [KNOWLEDGE-BASE.md](docs/KNOWLEDGE-BASE.md) - Technical knowledge base
- [config/stakeholder-email.md](config/stakeholder-email.md) - Email configuration guide

## 🐛 Debugging

```bash
# Inspect HTML report structure
node src/utils/debug-html.js

# Validate percentile extraction
node src/utils/test-percentiles-fix.js

# Inspect extracted data
node src/utils/inspect-data-enhanced.js
```

## 🤝 Contributing

1. Keep configuration in `config/`
2. Keep source code in `src/` with appropriate subfolder
3. Update `test-keywords.json` for new test scenarios
4. Document changes in `docs/`

## 📄 License

Internal tool for performance testing automation.

---

**Current Date:** April 28, 2026  
**Maintainer:** siddharth.sarkhel@tothenew.com
