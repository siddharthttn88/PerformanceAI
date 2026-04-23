# Grafana, Prometheus, New Relic & Jenkins Toolkit

**🔒 READ-ONLY MODE ENFORCED (Grafana/New Relic)** | **✅ Safe for Production** | **⚠️ Jenkins: Build Execution Enabled**

This project provides JavaScript libraries to:
- **Grafana/Prometheus**: Fetch dashboard, monitoring details, and metrics (read-only)
- **New Relic**: Query APM data and observability metrics (read-only)
- **Jenkins**: Execute and monitor CI/CD jobs (read + execute)
- **Email Reports**: Send load test reports with professional HTML formatting
- **Google Sheets**: Export Locust results with auto SLA detection

Grafana and New Relic scripts have write operations blocked at the client level for safety.

## 🚀 Quick Start

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd PerformanceAI
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure credentials**
```bash
# Copy template files
cp config.example.json config.json
cp credentials.example.json credentials.json

# Edit with your credentials
code config.json
code credentials.json
```

4. **Verify setup**
```bash
# Test connections
node grafana-reader.js health
node newrelic-client.js account
```

📚 **For detailed setup instructions, see [SETUP.md](SETUP.md)**

## Features

All operations are **read-only** and safe to use without modifying your monitoring instances:

### Dashboard Operations
- `searchDashboards(query, tags, limit)` - Search/list all dashboards
- `getDashboardByUID(uid)` - Get dashboard by UID
- `getDashboardBySlug(slug)` - Get dashboard by slug
- `getDashboardVersions(uid)` - Get dashboard version history
- `getDashboardVersion(uid, version)` - Get specific dashboard version
- `getDashboardTags()` - Get all dashboard tags

### Folder Operations
- `getFolders()` - Get all folders
- `getFolderByUID(uid)` - Get folder by UID

### Data Source Operations
- `getDataSources()` - Get all data sources
- `getDataSourceByID(id)` - Get data source by ID
- `getDataSourceByUID(uid)` - Get data source by UID
- `getDataSourceByName(name)` - Get data source by name

### Alert & Monitoring Operations
- `getAlerts(dashboardId, panelId, query, state, limit)` - Get all alerts
- `getAlertByID(id)` - Get alert by ID
- `getAlertNotificationChannels()` - Get notification channels
- `getAnnotations(from, to, limit, tags, type)` - Get annotations

### Organization & User Operations
- `getOrganization()` - Get current organization
- `getOrganizations()` - Get all organizations
- `getCurrentUser()` - Get current user
- `getTeams()` - Get teams

### Miscellaneous Operations
- `getHealthStatus()` - Get Grafana health status
- `getLibraryPanels()` - Get library panels
- `getSnapshots()` - Get dashboard snapshots
- `getPlugins()` - Get installed plugins
- `getPluginByID(pluginId)` - Get plugin details

### Prometheus Query Operations
- `prometheusQuery(query, datasourceUid, time)` - Execute instant Prometheus query
- `prometheusQueryRange(query, start, end, step, datasourceUid)` - Execute range query
- `prometheusLabels(datasourceUid)` - Get all available labels
- `prometheusLabelValues(label, datasourceUid)` - Get values for a specific label
- `prometheusSeries(match, start, end, datasourceUid)` - Get time series metadata
- `prometheusTargets(datasourceUid)` - Get Prometheus scrape targets
- `prometheusMetadata(datasourceUid, metric)` - Get metrics metadata

### New Relic Operations
- `runNrqlQuery(nrql, accountId)` - Execute NRQL queries
- `listApmApplications(accountId)` - List APM applications
- `getApplicationDetails(applicationId)` - Get application details
- `getApplicationHosts(applicationId)` - Get application host metrics
- `searchEntities(query, entityTypes, accountId)` - Search for entities
- `getEntityDetails(entityGuid)` - Get entity details
- `listAlertPolicies(accountId)` - List alert policies
- `listOpenIncidents(accountId)` - List open incidents
- `listSyntheticsMonitors(accountId)` - List synthetic monitors
- `getAccountDetails(accountId)` - Get account information
- `listDeployments(applicationId)` - List deployment history (read-only)

### Jenkins Operations
- `listJobs()` - List all Jenkins jobs
- `getJobInfo(jobName)` - Get detailed job information
- `getJobConfig(jobName)` - Get job configuration XML
- `updateJobConfig(jobName, configXml)` - Update job configuration (⚠️ WRITE)
- `triggerBuild(jobName)` - Trigger a build (no parameters)
- `triggerParameterizedBuild(jobName, parameters)` - Trigger a parameterized build
- `getBuildInfo(jobName, buildNumber)` - Get build details
- `getBuildStatus(jobName, buildNumber)` - Get build status (result, duration, etc.)
- `getConsoleOutput(jobName, buildNumber)` - Get build console output
- `waitForBuildStart(jobName, queueId)` - Wait for queued build to start
- `waitForBuildComplete(jobName, buildNumber)` - Wait for build to finish

### Locust Report Integration
- Parse Locust HTML reports and export to Google Sheets
- **Auto SLA detection** (1-second threshold for PASS/FAIL)
- Automatic metric extraction (TPS, response times, P90/P95 percentiles)
- Formatted data append with borders, colors, and bold headers
- IST timezone conversion for test timestamps
- Support for test metadata (users, TPS, ramp-up, status, comments)

## Configuration

**📝 First-time setup:** Copy `config.example.json` to `config.json` and `credentials.example.json` to `credentials.json`, then edit with your credentials. See [SETUP.md](SETUP.md) for detailed instructions.

The script reads configuration from `config.json`:

```json
{
  "mcpServers": {
    "grafana": {
      "command": "mcp-grafana",
      "args": [],
      "env": {
        "GRAFANA_URL": "http://your-grafana-server:3000/",
        "GRAFANA_SERVICE_ACCOUNT_TOKEN": "glsa_YourServiceAccountTokenHere"
      }
    },
    "newrelic": {
      "command": "npx",
      "args": ["-y", "newrelic-mcp"],
      "env": {
        "NEW_RELIC_API_KEY": "NRAK-YourApiKeyHere",
        "NEW_RELIC_ACCOUNT_ID": "1234567",
        "NEW_RELIC_REGION": "US"
      }
    },
    "jenkins": {
      "baseUrl": "http://your-jenkins-server:8080",
      "username": "your-username",
      "apiToken": "your-api-token"
    },
    "email": {
      "service": "gmail",
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "your-email@gmail.com",
        "pass": "your-app-password"
      },
      "from": "Load Test Reports <your-email@gmail.com>"
    }
  }
}
```

**Replace with your actual values:**
- `GRAFANA_URL`: Your Grafana instance URL
- `GRAFANA_SERVICE_ACCOUNT_TOKEN`: Your Grafana service account token with read permissions
- `NEW_RELIC_API_KEY`: Your New Relic User API key (starts with NRAK-)
- `NEW_RELIC_ACCOUNT_ID`: Your New Relic account ID
- `NEW_RELIC_REGION`: Either "US" or "EU" based on your region
- `JENKINS_BASE_URL`: Your Jenkins instance URL
- `JENKINS_USERNAME`: Your Jenkins username
- `JENKINS_API_TOKEN`: Your Jenkins API token (generate from User > Configure > API Token)
- **Email Settings:**
  - `service`: Email service provider (gmail, outlook, etc.)
  - `host`: SMTP server hostname
  - `port`: SMTP port (587 for TLS, 465 for SSL)
  - `secure`: Use SSL (true) or TLS (false)
  - `auth.user`: Your email address
  - `auth.pass`: Your email password or app-specific password
  - `from`: Sender name and email address
  - For Gmail: Use App Password from https://myaccount.google.com/apppasswords

## Usage

### Command Line Interface

#### Grafana Operations
```bash
# Check Grafana health
node grafana-reader.js health

# List all dashboards
node grafana-reader.js dashboards

# Get specific dashboard by UID
node grafana-reader.js dashboard <UID>

# Export dashboard to JSON file
node grafana-reader.js export <UID> [output.json]

# List all data sources
node grafana-reader.js datasources

# List all alerts
node grafana-reader.js alerts

# List all folders
node grafana-reader.js folders

# List dashboard tags
node grafana-reader.js tags

# Get current user
node grafana-reader.js user

# List snapshots
node grafana-reader.js snapshots

# List plugins
node grafana-reader.js plugins
```

#### Prometheus Query Operations
```bash
# Execute instant Prometheus query
node grafana-reader.js query "up"
node grafana-reader.js query "kube_pod_info{namespace=\"default\"}"

# Execute range query (start/end as Unix timestamps)
node grafana-reader.js range "up" 1648728000 1648731600 30s

# Get all available labels
node grafana-reader.js labels

# Get values for a specific label
node grafana-reader.js label-values namespace
node grafana-reader.js label-values pod

# Get Prometheus scrape targets
node grafana-reader.js targets
```

#### Get Pod Infrastructure Metrics
```bash
# Get comprehensive pod metrics (CPU, memory, network, restarts)
node get-pod-metrics.js <service-name> [minutes]

# Examples:
node get-pod-metrics.js subscriber-event-service 5
node get-pod-metrics.js api-gateway 10
```

#### New Relic Operations
```bash
# Get account details
node newrelic-client.js account

# List APM applications
node newrelic-client.js apps

# List alert policies
node newrelic-client.js alerts

# List open incidents
node newrelic-client.js incidents

# Run NRQL query
node newrelic-client.js nrql "SELECT count(*) FROM Transaction SINCE 1 hour ago"

# Search entities
node newrelic-client.js search "name LIKE '%prod%'"

# Get APM application metrics
node get-apm-metrics.js <application-name> [minutes]

# Examples:
node get-apm-metrics.js subscriber-event 5
node get-apm-metrics.js learn-action 10
```

#### Jenkins Operations
```bash
# List all jobs
node jenkins-client.js list

# Get job details
node jenkins-client.js info <job-name>

# Trigger a build (no parameters)
node jenkins-client.js build <job-name>

# Trigger a parameterized build
node jenkins-client.js build <job-name> PARAM1=value1 PARAM2=value2

# Get build status
node jenkins-client.js status <job-name> [build-number]

# Get console output
node jenkins-client.js console <job-name> [build-number]

# Wait for build to complete
node jenkins-client.js wait <job-name> <build-number>

# Trigger build and wait for completion (useful for CI/CD)
node jenkins-client.js build-wait <job-name> [PARAM=value ...]

# Examples:
node jenkins-client.js list
node jenkins-client.js build my-deployment-job
node jenkins-client.js build my-job BRANCH=main ENV=production
node jenkins-client.js status my-job 42
node jenkins-client.js build-wait deployment BRANCH=develop REGION=us-east-1
```

#### Locust Report to Google Sheets

Parse Locust HTML reports and automatically export to Google Sheets with formatting and SLA analysis.

##### **Option 1: Enhanced Locust Template (Recommended)**

Use `upload-with-Locust_Template.js` for the best experience with advanced features.

**Features:**
- ✅ **Merged Comment Cell** - Comment spans columns B-K for detailed analysis
- ✅ **Fixed Name Column Width** - 400px for consistent layout
- ✅ **Right-Aligned Numbers** - Average (ms), RPS, Failures/s columns
- ✅ **Duration Parsing** - Handles both string and numeric formats
- ✅ **Timezone Support** - Choose between IST or local timezone
- ✅ **Auto Sheet Creation** - Creates sheet if it doesn't exist
- ✅ **Auto Column Resize** - All columns automatically sized
- ✅ **Bold Summary Labels** - Better visual hierarchy
- ✅ **Auto SLA check** - 1-second threshold with detailed violation reports
- ✅ **Auto PASS/FAIL detection** - Based on response times and error rates
- ✅ **Enhanced Logging** - Detailed metrics summary display
- ✅ **P90/P95 percentile tracking** - Complete performance metrics

```bash
# Install required package first (one-time)
npm install googleapis

# Basic usage (recommended)
node upload-with-Locust_Template.js result.html <spreadsheet-id> \
  --users 40000 \
  --rampup "4 minutes" \
  --targettps 667 \
  --sheet "Load Test Results"

# With detailed comment and IST timezone
node upload-with-Locust_Template.js result.html <spreadsheet-id> \
  --users 50000 \
  --rampup "1 minute" \
  --targettps 833 \
  --timezone "IST" \
  --comment "Breaking Point Test - Production Environment

Test Configuration:
- User Load: 50,000 concurrent users
- Target TPS: 833 | Actual TPS: 1,826
- Duration: 5 minutes

Infrastructure:
- Service: subscriber-event-service
- Pods: 20 (8 cores, 8GB RAM each)
- CPU: 65% avg utilization
- Memory: 72% avg utilization

Analysis:
All endpoints within SLA (<1000ms)
No breaking point reached
Ready for production scale"

# Minimal usage (auto-calculates TPS from users/60)
node upload-with-Locust_Template.js result.html <spreadsheet-id> \
  --users 100000 \
  --rampup "2 minutes"

# With custom credentials file
node upload-with-Locust_Template.js result.html <spreadsheet-id> \
  --users 100000 \
  --rampup "2 minutes" \
  --creds my-service-account.json
```

**Command Line Options:**
- `--users <number>` - Total users in test (required)
- `--rampup <time>` - Ramp-up time (e.g., "1 minute", "4 minutes")
- `--targettps <number>` - Target TPS (optional, defaults to users/60)
- `--sheet <name>` - Sheet name (optional, uses first sheet if not specified)
- `--comment <text>` - Multi-line test details (supports `\n` line breaks)
- `--timezone <IST|local>` - Timezone for timestamps (default: local)
- `--creds <file>` - Custom credentials file (default: credentials.json)

##### **Option 2: Legacy Template**

Use `upload-with-template.js` if you prefer the original 3-column format without merged cells.

**Features:**
- ✅ Auto SLA check (1-second threshold)
- ✅ Auto PASS/FAIL detection based on response times and failures
- ✅ Formatted Google Sheets output (borders, colors, bold headers)
- ✅ P90/P95 percentile tracking
- ✅ IST timezone conversion
- ✅ Comprehensive test metadata

```bash
# Basic usage
node upload-with-template.js result.html <spreadsheet-id> \
  --users 50000 \
  --rampup "1 minute" \
  --comment "Load test on production environment"

# With manual status
node upload-with-template.js result.html <spreadsheet-id> \
  --users 150000 \
  --rampup "2 minutes" \
  --comment "Multi-line comment\nWith detailed notes"
```

**Command Line Options:**
- `--users <number>` - Total users in test (required)
- `--rampup <time>` - Ramp-up time (e.g., "1 minute", "30 seconds")
- `--comment <text>` - Test comments/notes (supports `\n`)
- `--sheet <name>` - Sheet name (optional)
- `--creds <file>` - Custom credentials file (default: credentials.json)

##### **Option 3: Original Locust Script (locust-to-gsheet.js)**

The original `locust-to-gsheet.js` script is also available for compatibility.

```bash
# Basic usage (auto-detect PASS/FAIL based on 1sec SLA)
node locust-to-gsheet.js result.html <spreadsheet-id> \
  --users 50000 \
  --tps 833 \
  --rampup "1 minute"

# Minimal usage (auto-calculates everything from HTML)
node locust-to-gsheet.js result.html <spreadsheet-id>

# With custom credentials file
node locust-to-gsheet.js result.html <spreadsheet-id> \
  --creds my-service-account.json \
  --users 100000 \
  --tps 1500
```

**Setup (One-time for all upload scripts):**
1. Install googleapis: `npm install googleapis`
2. Go to https://console.cloud.google.com
3. Create a project → Enable "Google Sheets API"
4. Create a Service Account → download JSON key → save as `credentials.json`
5. Share your Google Sheet with the service-account email (Editor role)

**Comparison of Upload Options:**

| Feature | Locust Template (Recommended) | Legacy Template | Original (locust-to-gsheet) |
|---------|-------------------------------|-----------------|----------------------------|
| Merged Comment Cell | ✅ Yes (B-K columns) | ❌ No | ❌ No |
| Fixed Column Width | ✅ 400px for Name | ❌ Auto | ❌ Auto |
| Right-Aligned Numbers | ✅ Yes | ⚠️ Partial | ⚠️ Partial |
| Timezone Options | ✅ IST/Local | ✅ IST only | ✅ IST only |
| Auto Sheet Creation | ✅ Yes | ✅ Yes | ❌ No |
| Duration Parsing | ✅ Advanced | ✅ Advanced | ⚠️ Basic |
| Bold Summary Labels | ✅ Yes | ⚠️ Partial | ❌ No |
| Enhanced Logging | ✅ Detailed | ✅ Standard | ⚠️ Basic |
| Auto TPS Calculation | ✅ Yes (users/60) | ✅ Yes (users/60) | ❌ Manual |
| Target TPS Display | ✅ Yes (--targettps) | ❌ No | ✅ Yes (--tps) |
| Error Stack Traces | ✅ Yes | ❌ No | ❌ No |

**Auto SLA Detection (All Options):**
- **SLA Threshold**: 1 second (1000ms)
- **FAIL** if any API average > 1000ms OR error rate >5%
- **PASS** if all APIs within SLA and error rate <5%
- Shows which APIs exceeded SLA in console

**Output Format in Google Sheets (Locust Template):**
- **Load**: User count + target TPS | **Total TPS**: Actual measured TPS (yellow highlight, bold)
- **Test Time**: Start - End (duration) | **Ramp-up**: Time
- **Test Status**: PASS/FAIL (color-coded: green=PASS, red=FAIL, bold)
- **Comment**: Multi-line detailed analysis (merged cell spanning columns B-K)
- **API Metrics Table**: Type, Name, # Requests, # Fails, Average (ms), Min (ms), Max (ms), RPS, Failures/s, 90%ile (ms), 95%ile (ms)

**Enhanced Formatting (Locust Template):**
- **Merged comment cell** across 10 columns for detailed multi-line analysis
- **Fixed Name column width** at 400px for consistent layout
- **Right-aligned numbers** in Average (ms), RPS, and Failures/s columns
- **Bold summary labels** in column A
- Borders around all cells
- Green background for PASS, red for FAIL
- Yellow highlight for Total TPS value
- Bold gray header row for metrics table
- Auto-resized columns (except Name column)

**Example Output (Locust Template):**
```
Load: 40,000 Users (667 TPS)  |  Total TPS on Service = 3607 (yellow, bold)
Test Time: 4/17/2026, 12:18 PM - 12:25 PM (7 min 1 sec)  |  RampUp - 4 minutes
Test Status: FAIL (red, bold)
Comment: (Merged cell B-K with plenty of horizontal space)
  Load Test Analysis - 40K Users Breaking Point Test
  
  Test Configuration:
  - User Load: 40,000 concurrent users
  - Target TPS: 667 | Actual TPS: 3,607
  - Duration: 7 minutes 1 second
  
  Breaking Point Analysis:
  ✗ Error Rate: 11.38% (Threshold: 5%)
  ✗ Avg Response Time: 2,733ms (Threshold: 1,000ms)
  
  Infrastructure:
  - Service: subscriber-event-service
  - Pods: 10 (8 cores CPU, 8GB RAM each)
  
  Conclusion:
  40K users represents the breaking point.
  Recommended maximum: 30K users.

Type | Name                          | # Requests | # Fails | Average (ms) | Min (ms) | Max (ms) | RPS    | Failures/s | 90%ile (ms) | 95%ile (ms)
POST | Add_To_ContinueWatch          | 216115     | 32      | 45.50        | 20       | 412      | 514.32 | 0.08       | 41          | 96
POST | Add_to_Favourite              | 19057      | 2354    | 2839.64      | 22       | 10143    | 45.35  | 5.60       | 190         | 10000
...
```

#### Send Load Test Reports via Email

Send load test reports and analysis via email with professional HTML formatting and automatic test summary extraction.

```bash
# Install nodemailer package first (one-time)
npm install nodemailer

# Basic usage
node send-email-report.js \
  --to "team@example.com" \
  --subject "Load Test Results - 5000 Users" \
  --report "D:\PerformanceAI\Reports\result.html"

# With CC and detailed analysis
node send-email-report.js \
  --to "manager@example.com" \
  --cc "dev@example.com,qa@example.com" \
  --subject "Breaking Point Test - subscriber-event-service" \
  --report "D:\PerformanceAI\Reports\result.html" \
  --body "Breaking Point Analysis - 40K Users

Test Results: FAIL
Breaking Point Reached: 40,000 users

Key Findings:
- Error Rate: 11.38% (Threshold: 5%) 🔴
- Avg Response Time: 2,733ms (Threshold: 1,000ms) 🔴
- CPU Utilization: 100% max (pods maxed out)

Primary Bottleneck: CPU Bound
Recommendations:
- Maximum safe load: 30,000 users
- Increase pod count from 10 to 15
- Optimize database queries"

# With multiple attachments
node send-email-report.js \
  --to "team@example.com" \
  --subject "Load Test - Complete Results Package" \
  --report "D:\PerformanceAI\Reports\result.html" \
  --attach "metrics.json,grafana-dashboard.png"

# Using basic template (minimal)
node send-email-report.js \
  --to "stakeholder@example.com" \
  --subject "Quick Test Results" \
  --report "result.html" \
  --template basic
```

**Command Line Options:**
- `--to <email>` - Recipient email (required, comma-separated for multiple)
- `--cc <email>` - CC recipients (optional, comma-separated)
- `--subject <text>` - Email subject line (required)
- `--report <path>` - Path to HTML report file (required)
- `--body <text>` - Additional body text/analysis (optional)
- `--attach <paths>` - Additional attachments (optional, comma-separated)
- `--config <path>` - Config file path (default: config.json)
- `--template <style>` - Email template: basic|detailed (default: detailed)

**Email Templates:**

**Detailed Template (Default):**
- Professional gradient header design
- Auto-extracted metrics summary with visual cards
  - Total Requests
  - Total Failures & Failure Rate
  - Average Response Time
- Color-coded status badges (✅ PASS / 🔴 FAIL)
- Formatted analysis section with proper spacing
- Multiple attachments support
- Professional footer with branding

**Basic Template:**
- Simple clean layout
- Status badge
- Custom analysis section
- Minimal styling for quick updates

**Auto-Extracted Metrics:**
- Total Requests
- Total Failures
- Failure Rate (%)
- Average Response Time
- Test Status (PASS/FAIL based on SLA criteria)

**Email Configuration (One-time Setup):**

Add email configuration to `config.json`:

```json
{
  "email": {
    "service": "gmail",
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
    "auth": {
      "user": "your-email@gmail.com",
      "pass": "your-app-password"
    },
    "from": "Load Test Reports <your-email@gmail.com>"
  }
}
```

**For Gmail - Generate App Password:**
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and device "Other"
3. Copy the 16-character password
4. Use this in config.json (not your regular Gmail password)

**For Other Email Services:**

Outlook/Office365:
```json
"email": {
  "service": "outlook",
  "host": "smtp-mail.outlook.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "your-email@outlook.com",
    "pass": "your-password"
  }
}
```

Custom SMTP:
```json
"email": {
  "host": "smtp.yourcompany.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "smtp-username",
    "pass": "smtp-password"
  }
}
```

**Features:**
- ✅ **Professional HTML Templates** - Responsive design with visual hierarchy
- ✅ **Automatic Test Summary** - Extracts key metrics from HTML report
- ✅ **Multiple Recipients** - Send to team members with CC support
- ✅ **Flexible Attachments** - HTML reports, screenshots, JSON files
- ✅ **Custom Analysis** - Add detailed findings and recommendations
- ✅ **SLA-Based Status** - Auto-determines PASS/FAIL based on thresholds
- ✅ **Gmail/Outlook/Custom SMTP** - Support for major email providers

**SLA Criteria (Auto-determined):**
- FAIL if average response time > 1000ms
- FAIL if failure rate > 5%
- PASS if both criteria met

### As a Module

#### Grafana & Prometheus
```javascript
const grafana = require('./grafana-reader');

(async () => {
    try {
        // Get all dashboards
        const dashboards = await grafana.searchDashboards();
        console.log('Dashboards:', dashboards);

        // Get specific dashboard
        const dashboard = await grafana.getDashboardByUID('abc123');
        console.log('Dashboard:', dashboard);

        // Prometheus queries
        const upQuery = await grafana.prometheusQuery('up');
        console.log('Up metrics:', upQuery);
        
        // Get pod information
        const pods = await grafana.prometheusQuery('kube_pod_info{namespace="default"}');
        console.log('Pods:', pods);
        
        // Get all namespaces
        const namespaces = await grafana.prometheusLabelValues('namespace');
        console.log('Namespaces:', namespaces);

    } catch (error) {
        console.error('Error:', error.message);
    }
})();
```

#### New Relic
```javascript
const newrelic = require('./newrelic-client');

(async () => {
    try {
        // Run NRQL query
        const results = await newrelic.runNrqlQuery(
            "SELECT count(*) FROM Transaction WHERE appName = 'MyApp' SINCE 1 hour ago"
        );
        console.log('Query results:', results);
        
        // List APM applications
        const apps = await newrelic.listApmApplicationsRest();
        console.log('Applications:', apps);
        
        // Get application details
        const appDetails = await newrelic.getApplicationDetails(12345);
        console.log('App details:', appDetails);
        
        // Search for entities
        const entities = await newrelic.searchEntities("name LIKE '%api%'");
        console.log('Entities:', entities);
        
        // List open incidents
        const incidents = await newrelic.listOpenIncidents();
        console.log('Open incidents:', incidents);
        
        // Get account details
        const account = await newrelic.getAccountDetails();
        console.log('Account:', account);

    } catch (error) {
        console.error('Error:', error.message);
    }
})();
```

#### Jenkins
```javascript
const jenkins = require('./jenkins-client');

(async () => {
    try {
        // List all jobs
        const jobs = await jenkins.listJobs();
        console.log('Jobs:', jobs);
        
        // Get job details
        const jobInfo = await jenkins.getJobInfo('my-deployment-job');
        console.log('Job info:', jobInfo);
        
        // Trigger a simple build
        const buildResponse = await jenkins.triggerBuild('my-job');
        console.log('Build triggered:', buildResponse);
        
        // Trigger a parameterized build
        const params = {
            BRANCH: 'main',
            ENVIRONMENT: 'production',
            VERSION: '1.2.3'
        };
        const paramBuild = await jenkins.triggerParameterizedBuild('deploy-job', params);
        console.log('Parameterized build triggered:', paramBuild);
        
        // Get build status
        const status = await jenkins.getBuildStatus('my-job', 42);
        console.log('Build status:', status);
        
        // Wait for build to complete
        const completedStatus = await jenkins.waitForBuildComplete('my-job', 42);
        console.log('Build completed:', completedStatus.result);
        
        // Get console output
        const console = await jenkins.getConsoleOutput('my-job', 42);
        console.log('Console output:', console);

    } catch (error) {
        console.error('Error:', error.message);
    }
})();
```

## Environment Variables

You can override the default configuration using environment variables:

```bash
# Windows PowerShell
$env:GRAFANA_URL="http://your-grafana-instance:3000/"
$env:GRAFANA_SERVICE_ACCOUNT_TOKEN="glsa_YourTokenHere"
node grafana-reader.js health

# Linux/Mac
export GRAFANA_URL="http://your-grafana-instance:3000/"
export GRAFANA_SERVICE_ACCOUNT_TOKEN="glsa_YourTokenHere"
node grafana-reader.js health
```

## Security Notes

**🔒 READ-ONLY MODE ENFORCED**

Both Grafana and New Relic scripts have built-in protections to prevent write operations:

### Grafana Scripts
- ✅ Only GET requests allowed
- ❌ Blocks POST, PUT, DELETE, PATCH operations
- ❌ Cannot create/update/delete dashboards
- ❌ Cannot modify data sources
- ❌ Cannot create/update alerts
- ✅ Safe to use in production environments

### New Relic Scripts
- ✅ Only GET requests allowed for REST API
- ✅ Only GraphQL queries allowed (mutations blocked)
- ❌ Blocks all mutation operations
- ❌ Cannot create deployment markers
- ❌ Cannot acknowledge incidents
- ❌ Cannot create/update alerts or monitors
- ⚠️ Warns if query contains potentially dangerous keywords
- ✅ Safe to use in production environments

### General Security
- Service account tokens and API keys are used for authentication
- Ensure your tokens have only the necessary read permissions
- **Never commit config.json with real credentials to version control**
- Use `.gitignore` to exclude config.json from version control (included)
- All validation happens at the client level before API calls
- Failed write attempts will throw errors immediately

### Testing Read-Only Protection

You can verify the protections are working:

```bash
# Test New Relic POST blocking
node -e "const nr = require('./newrelic-client.js'); nr.restApiRequest('/test', 'POST').catch(e => console.log(e.message))"
# Output: READ-ONLY MODE: Only GET requests are allowed

# Test GraphQL mutation blocking
node -e "const nr = require('./newrelic-client.js'); nr.nerdGraphQuery('mutation { test }').catch(e => console.log(e.message))"
# Output: READ-ONLY MODE: GraphQL mutations are not allowed
```

## Requirements

- Node.js (built-in modules only, no external dependencies required)
- **For Grafana:**
  - Grafana instance with API access
  - Valid service account token with read permissions
  - Prometheus data source configured (for Prometheus queries)
- **For New Relic:**
  - New Relic account
  - User API key (starts with NRAK-)
  - Account ID

## API Reference

All functions return Promises that resolve to the API response data or reject with an error.

### Error Handling

```javascript
try {
    const dashboard = await grafana.getDashboardByUID('invalid-uid');
} catch (error) {
    console.error('Failed to fetch dashboard:', error.message);
}
```

## Examples

### Get All Dashboards and Their Details

```javascript
const grafana = require('./grafana-reader');

async function getAllDashboardDetails() {
    const dashboards = await grafana.searchDashboards();
    
    for (const dashboard of dashboards) {
        if (dashboard.type === 'dash-db') {
            const details = await grafana.getDashboardByUID(dashboard.uid);
            console.log(`Dashboard: ${details.dashboard.title}`);
            console.log(`  Panels: ${details.dashboard.panels?.length || 0}`);
            console.log(`  Tags: ${details.dashboard.tags?.join(', ') || 'none'}`);
        }
    }
}

getAllDashboardDetails().catch(console.error);
```

### Monitor Alert Status

```javascript
const grafana = require('./grafana-reader');

async function checkAlertStatus() {
    const alerts = await grafana.getAlerts();
    
    const alertsByState = {
        ok: [],
        paused: [],
        alerting: [],
        pending: [],
        no_data: []
    };
    
    alerts.forEach(alert => {
        if (alertsByState[alert.state]) {
            alertsByState[alert.state].push(alert);
        }
    });
    
    console.log('Alert Summary:');
    console.log(`  OK: ${alertsByState.ok.length}`);
    console.log(`  Alerting: ${alertsByState.alerting.length}`);
    console.log(`  Pending: ${alertsByState.pending.length}`);
    console.log(`  No Data: ${alertsByState.no_data.length}`);
    console.log(`  Paused: ${alertsByState.paused.length}`);
}

checkAlertStatus().catch(console.error);
```

### List All Data Sources

```javascript
const grafana = require('./grafana-reader');

async function listDataSources() {
    const dataSources = await grafana.getDataSources();
    
    dataSources.forEach(ds => {
        console.log(`${ds.name} (${ds.type})`);
        console.log(`  ID: ${ds.id}`);
        console.log(`  UID: ${ds.uid}`);
        console.log(`  Default: ${ds.isDefault}`);
    });
}

listDataSources().catch(console.error);
```

### Prometheus Query Examples

```javascript
const grafana = require('./grafana-reader');

async function prometheusExamples() {
    // Check service availability
    const up = await grafana.prometheusQuery('up');
    console.log('Services up:', up);
    
    // Get CPU usage by pod
    const cpuQuery = await grafana.prometheusQuery(
        'sum(rate(container_cpu_usage_seconds_total{namespace="default"}[5m])) by (pod)'
    );
    console.log('CPU usage:', cpuQuery);
    
    // Get memory usage
    const memQuery = await grafana.prometheusQuery(
        'container_memory_working_set_bytes{namespace="default"}'
    );
    console.log('Memory usage:', memQuery);
    
    // Get pod restart counts
    const restarts = await grafana.prometheusQuery(
        'kube_pod_container_status_restarts_total{namespace="default"}'
    );
    console.log('Pod restarts:', restarts);
    
    // Discover available namespaces
    const namespaces = await grafana.prometheusLabelValues('namespace');
    console.log('Available namespaces:', namespaces);
}

prometheusExamples().catch(console.error);
```

### New Relic Query Examples

```javascript
const newrelic = require('./newrelic-client');

async function newRelicExamples() {
    // Get application performance metrics
    const perfQuery = await newrelic.runNrqlQuery(`
        SELECT 
            average(duration) as 'avg_response_time',
            percentile(duration, 95) as 'p95',
            count(*) as 'throughput'
        FROM Transaction 
        WHERE appName = 'MyApp'
        SINCE 1 hour ago
    `);
    console.log('Performance metrics:', perfQuery);
    
    // Find slow transactions
    const slowTransactions = await newrelic.runNrqlQuery(`
        SELECT average(duration) as 'avg_duration'
        FROM Transaction 
        WHERE appName = 'MyApp'
        FACET name 
        SINCE 1 hour ago 
        ORDER BY avg_duration DESC 
        LIMIT 10
    `);
    console.log('Slowest transactions:', slowTransactions);
    
    // Get error rate
    const errors = await newrelic.runNrqlQuery(`
        SELECT 
            count(*) as 'total_errors',
            uniqueCount(\`error.class\`) as 'unique_errors'
        FROM TransactionError 
        WHERE appName = 'MyApp'
        SINCE 1 hour ago
    `);
    console.log('Error metrics:', errors);
    
    // Infrastructure metrics
    const infraQuery = await newrelic.runNrqlQuery(`
        SELECT 
            average(cpuPercent) as 'avg_cpu',
            average(memoryUsedBytes/memoryTotalBytes*100) as 'avg_memory_pct'
        FROM SystemSample 
        SINCE 30 minutes ago
    `);
    console.log('Infrastructure metrics:', infraQuery);
    
    // Find applications with high error rates
    const highErrors = await newrelic.runNrqlQuery(`
        SELECT 
            filter(count(*), WHERE error IS true) / count(*) * 100 as 'error_rate'
        FROM Transaction 
        FACET appName 
        SINCE 1 hour ago 
        HAVING error_rate > 1
    `);
    console.log('Apps with high error rates:', highErrors);
}

newRelicExamples().catch(console.error);
```

### Get Pod Infrastructure Metrics

The `get-pod-metrics.js` tool provides comprehensive infrastructure details for any service's pods:

```bash
# Get metrics for last 5 minutes
node get-pod-metrics.js subscriber-event-service 5
```

**Output includes:**
- Pod information (names, IPs, nodes, creators)
- Current CPU usage per container
- Current memory usage per container
- Resource requests and limits
- Pod status and health
- Container restart counts
- Network I/O statistics

**Example output:**
```
=== POD INFORMATION ===
Found 22 pod(s):

Pod 1:
  Name: subscriber-event-service-6f659556b7-6cjg7
  Namespace: load-test
  Node: ip-10-16-2-149.ap-southeast-1.compute.internal
  Host IP: 10.16.2.149
  Pod IP: 10.16.2.214
  ...

=== CPU USAGE (Current) ===
  subscriber-event-service-6f659556b7-6cjg7 (container): 6.34 millicores
  ...

=== MEMORY USAGE (Current) ===
  subscriber-event-service-6f659556b7-6cjg7 (container): 1509.45 MB
  ...
```

## Tools Included

### 1. grafana-reader.js
Main library with all Grafana and Prometheus read operations. Can be used as:
- Command-line tool
- Node.js module

### 2. get-pod-metrics.js
Specialized tool for querying Kubernetes pod infrastructure metrics via Prometheus:
- CPU and memory usage
- Resource requests/limits
- Network I/O
- Pod health and restarts
- Node distribution

### 3. newrelic-client.js
Complete New Relic client supporting:
- NerdGraph (GraphQL) API
- REST v2 API
- NRQL queries
- APM metrics
- Entity search
- Alert policies
- Synthetics monitoring
- Deployment tracking

### 4. get-apm-metrics.js
Specialized tool for querying APM application metrics from New Relic:
- Application health and performance
- Transaction metrics
- Error rates
- Host information
- Deployment history
- Top transactions

### 5. query-timerange.js
Query historical metrics for specific time ranges:
- CPU usage over time
- Memory usage patterns
- Network I/O
- Restart detection

### 6. upload-with-Locust_Template.js **(Recommended)**
Enhanced Locust report uploader to Google Sheets:
- Merged comment cell (columns B-K) for detailed analysis
- Fixed Name column width (400px)
- Right-aligned numeric columns
- Timezone support (IST/Local)
- Auto sheet creation
- Bold summary labels
- Enhanced logging and error handling
- Auto TPS calculation
- Duration parsing (string/numeric formats)

### 7. upload-with-template.js (Legacy)
Original Locust report uploader to Google Sheets:
- Traditional 3-column summary format
- IST timezone conversion
- Auto SLA detection
- Formatted output with borders and colors
- Compatible with historical data

### 8. read-gsheet.js
Read data from Google Sheets:
- JSON or CSV output formats
- Range selection support
- Authentication with credentials.json
- Used for verification and data retrieval

### 9. send-email-report.js
Send load test reports via email:
- Professional HTML email templates (basic & detailed)
- Auto-extract metrics from HTML reports
- Multiple recipients and CC support
- Flexible attachment handling
- Gmail, Outlook, and custom SMTP support
- SLA-based PASS/FAIL status determination

### 10. jenkins-client.js
Jenkins CI/CD integration:
- List and trigger jobs
- Monitor build status
- Get console output
- Parameterized builds
- Wait for completion

### 11. config.json
Configuration file for Grafana, New Relic, Jenkins, and Email settings (see Configuration section above).

### 12. .gitignore
Pre-configured to exclude sensitive files:
- config.json (credentials)
- Exported dashboard JSON files
- Log files
- IDE and OS files

## License

MIT
