# Grafana, Prometheus, New Relic & Jenkins Toolkit

**🔒 READ-ONLY MODE ENFORCED (Grafana/New Relic)** | **✅ Safe for Production** | **⚠️ Jenkins: Build Execution Enabled**

This project provides JavaScript libraries to:
- **Grafana/Prometheus**: Fetch dashboard, monitoring details, and metrics (read-only)
- **New Relic**: Query APM data and observability metrics (read-only)
- **Jenkins**: Execute and monitor CI/CD jobs (read + execute)

Grafana and New Relic scripts have write operations blocked at the client level for safety.

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

**Features:**
- ✅ Auto SLA check (1-second threshold)
- ✅ Auto PASS/FAIL detection based on response times and failures
- ✅ Formatted Google Sheets output (borders, colors, bold headers)
- ✅ P90/P95 percentile tracking
- ✅ IST timezone conversion
- ✅ Comprehensive test metadata

```bash
# Install required package first
npm install googleapis

# Basic usage (auto-detect PASS/FAIL based on 1sec SLA)
node locust-to-gsheet.js result.html <spreadsheet-id> \
  --users 50000 \
  --tps 833 \
  --rampup "1 minute"

# With manual status and comment
node locust-to-gsheet.js result.html <spreadsheet-id> \
  --users 150000 \
  --tps 2500 \
  --status PASS \
  --comment "Load test on production environment" \
  --rampup "2 minutes"

# Minimal usage (auto-calculates everything from HTML)
node locust-to-gsheet.js result.html <spreadsheet-id>

# With custom credentials file
node locust-to-gsheet.js result.html <spreadsheet-id> \
  --creds my-service-account.json \
  --users 100000 \
  --tps 1500
```

**Setup (One-time):**
1. Go to https://console.cloud.google.com
2. Create a project → Enable "Google Sheets API"
3. Create a Service Account → download JSON key → save as `credentials.json`
4. Share your Google Sheet with the service-account email (Editor role)

**Command Line Options:**
- `--users <number>` - Total users in test (e.g., 50000)
- `--tps <number>` - Target TPS (e.g., 833)
- `--rampup <time>` - Ramp-up time (e.g., "1 minute", "30 seconds")
- `--status <PASS|FAIL>` - Manual override (auto-detected if not provided)
- `--comment <text>` - Test comments/notes
- `--creds <file>` - Custom credentials file (default: credentials.json)

**Auto SLA Detection:**
- **SLA Threshold**: 1 second (1000ms)
- **FAIL** if any API average > 1000ms OR has failures
- **PASS** if all APIs within SLA and no failures
- Shows which APIs exceeded SLA in console

**Output Format in Google Sheets:**
- **Load**: User count + target TPS | **Total TPS**: Actual measured TPS (highlighted)
- **Test Time**: Start - End (duration) | **Ramp-up**: Time
- **Test Status**: PASS/FAIL (color-coded: green=PASS, red=FAIL)
- **Comment**: Custom test notes
- **API Metrics Table**: Type, Name, Requests, Fails, Avg(ms), Min(ms), Max(ms), RPS, Failures/s, P90(ms), P95(ms)

**Formatting Applied:**
- Borders around all cells
- Green background for PASS, red for FAIL
- Orange highlight for Total TPS value
- Bold gray header row for metrics table
- Auto-resized columns

**Example Output:**
```
Load: 50,000 Users (833 TPS)    |  Total TPS on Service = 1826 (orange, bold)
Test Time: 4/1/2026, 12:42 PM - 12:45 PM (3 minutes)  |  Ramp-up: 1 minute
Test Status: FAIL (red, bold)
Comment: Manual test comment

Type | API Name              | Requests | Fails | Avg(ms) | Min(ms) | Max(ms) | RPS   | Failures/s | P90(ms) | P95(ms)
POST | LA-start_watching     | 137856   | 53205 | 1583    | 128     | 2713    | 765   | 3.2        | 1700    | 1800
POST | LA-stop_watching      | 109697   | 27780 | 1575    | 128     | 2518    | 609   | 2.8        | 1600    | 1700
...
```

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

### 6. config.json
Configuration file for Grafana and New Relic connection details (see Configuration section above).

### 7. .gitignore
Pre-configured to exclude sensitive files:
- config.json (credentials)
- Exported dashboard JSON files
- Log files
- IDE and OS files

## License

MIT
