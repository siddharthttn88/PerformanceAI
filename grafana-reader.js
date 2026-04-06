/**
 * Grafana Read-Only Operations Script
 * Provides tools to fetch dashboards and monitoring details from Grafana
 * 
 * ⚠️ READ-ONLY MODE ENFORCED ⚠️
 * This client only supports read operations (GET)
 * All write operations (POST, PUT, DELETE, PATCH) are blocked
 * 
 * Blocked operations:
 * - Creating dashboards
 * - Updating dashboards
 * - Deleting dashboards
 * - Creating alerts
 * - Updating data sources
 * - Any other modification operations
 */

const https = require('https');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Load configuration from config.json
let GRAFANA_URL, GRAFANA_TOKEN;

try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Get values from config.json, fallback to environment variables
    GRAFANA_URL = process.env.GRAFANA_URL || config.mcpServers?.grafana?.env?.GRAFANA_URL || 'http://localhost:3000/';
    GRAFANA_TOKEN = process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN || config.mcpServers?.grafana?.env?.GRAFANA_SERVICE_ACCOUNT_TOKEN || '';
} catch (error) {
    console.error('Error loading config.json:', error.message);
    console.error('Falling back to environment variables only');
    GRAFANA_URL = process.env.GRAFANA_URL || 'http://localhost:3000/';
    GRAFANA_TOKEN = process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN || '';
}

/**
 * Make HTTP request to Grafana API (read-only operations only)
 */
function makeGrafanaRequest(endpoint, method = 'GET') {
    // Read-only enforcement: only allow GET requests
    if (method !== 'GET') {
        return Promise.reject(new Error('READ-ONLY MODE: Only GET requests are allowed. Write operations (POST, PUT, DELETE, PATCH) are disabled.'));
    }
    
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(endpoint, GRAFANA_URL);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
                'Authorization': `Bearer ${GRAFANA_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        const req = client.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = data ? JSON.parse(data) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsedData)}`));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse response: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.end();
    });
}

/**
 * READ-ONLY TOOLS
 */

// 1. Search/List all dashboards
async function searchDashboards(query = '', tags = [], limit = 5000) {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (tags && tags.length > 0) {
        tags.forEach(tag => params.append('tag', tag));
    }
    params.append('limit', limit);
    
    const endpoint = `/api/search?${params.toString()}`;
    const results = await makeGrafanaRequest(endpoint);
    return results;
}

// 2. Get dashboard by UID
async function getDashboardByUID(uid) {
    const endpoint = `/api/dashboards/uid/${uid}`;
    const dashboard = await makeGrafanaRequest(endpoint);
    return dashboard;
}

// 3. Get dashboard by slug (deprecated but still useful)
async function getDashboardBySlug(slug) {
    const endpoint = `/api/dashboards/db/${slug}`;
    const dashboard = await makeGrafanaRequest(endpoint);
    return dashboard;
}

// 4. Get all folders
async function getFolders() {
    const endpoint = '/api/folders';
    const folders = await makeGrafanaRequest(endpoint);
    return folders;
}

// 5. Get folder by UID
async function getFolderByUID(uid) {
    const endpoint = `/api/folders/${uid}`;
    const folder = await makeGrafanaRequest(endpoint);
    return folder;
}

// 6. Get all data sources
async function getDataSources() {
    const endpoint = '/api/datasources';
    const dataSources = await makeGrafanaRequest(endpoint);
    return dataSources;
}

// 7. Get data source by ID
async function getDataSourceByID(id) {
    const endpoint = `/api/datasources/${id}`;
    const dataSource = await makeGrafanaRequest(endpoint);
    return dataSource;
}

// 8. Get data source by UID
async function getDataSourceByUID(uid) {
    const endpoint = `/api/datasources/uid/${uid}`;
    const dataSource = await makeGrafanaRequest(endpoint);
    return dataSource;
}

// 9. Get data source by name
async function getDataSourceByName(name) {
    const endpoint = `/api/datasources/name/${encodeURIComponent(name)}`;
    const dataSource = await makeGrafanaRequest(endpoint);
    return dataSource;
}

// 10. Get all alerts (legacy alerting)
async function getAlerts(dashboardId = null, panelId = null, query = '', state = 'all', limit = 5000) {
    const params = new URLSearchParams();
    if (dashboardId) params.append('dashboardId', dashboardId);
    if (panelId) params.append('panelId', panelId);
    if (query) params.append('query', query);
    if (state && state !== 'all') params.append('state', state);
    params.append('limit', limit);
    
    const endpoint = `/api/alerts?${params.toString()}`;
    const alerts = await makeGrafanaRequest(endpoint);
    return alerts;
}

// 11. Get alert by ID
async function getAlertByID(id) {
    const endpoint = `/api/alerts/${id}`;
    const alert = await makeGrafanaRequest(endpoint);
    return alert;
}

// 12. Get Grafana health status
async function getHealthStatus() {
    const endpoint = '/api/health';
    const health = await makeGrafanaRequest(endpoint);
    return health;
}

// 13. Get organization details
async function getOrganization() {
    const endpoint = '/api/org';
    const org = await makeGrafanaRequest(endpoint);
    return org;
}

// 14. Get all organizations
async function getOrganizations() {
    const endpoint = '/api/orgs';
    const orgs = await makeGrafanaRequest(endpoint);
    return orgs;
}

// 15. Get current user
async function getCurrentUser() {
    const endpoint = '/api/user';
    const user = await makeGrafanaRequest(endpoint);
    return user;
}

// 16. Get teams
async function getTeams() {
    const endpoint = '/api/teams/search';
    const teams = await makeGrafanaRequest(endpoint);
    return teams;
}

// 17. Get alert notification channels
async function getAlertNotificationChannels() {
    const endpoint = '/api/alert-notifications';
    const channels = await makeGrafanaRequest(endpoint);
    return channels;
}

// 18. Get annotations
async function getAnnotations(from, to, limit = 100, tags = [], type = null) {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    params.append('limit', limit);
    if (tags && tags.length > 0) {
        tags.forEach(tag => params.append('tags', tag));
    }
    if (type) params.append('type', type);
    
    const endpoint = `/api/annotations?${params.toString()}`;
    const annotations = await makeGrafanaRequest(endpoint);
    return annotations;
}

// 19. Get dashboard tags
async function getDashboardTags() {
    const endpoint = '/api/dashboards/tags';
    const tags = await makeGrafanaRequest(endpoint);
    return tags;
}

// 20. Get dashboard versions/history by UID
async function getDashboardVersions(uid) {
    const endpoint = `/api/dashboards/uid/${uid}/versions`;
    const versions = await makeGrafanaRequest(endpoint);
    return versions;
}

// 21. Get specific dashboard version
async function getDashboardVersion(uid, version) {
    const endpoint = `/api/dashboards/uid/${uid}/versions/${version}`;
    const versionData = await makeGrafanaRequest(endpoint);
    return versionData;
}

// 22. Get all library panels
async function getLibraryPanels() {
    const endpoint = '/api/library-elements?kind=1';
    const panels = await makeGrafanaRequest(endpoint);
    return panels;
}

// 23. Get snapshots
async function getSnapshots() {
    const endpoint = '/api/dashboard/snapshots';
    const snapshots = await makeGrafanaRequest(endpoint);
    return snapshots;
}

// 24. Get plugins
async function getPlugins() {
    const endpoint = '/api/plugins';
    const plugins = await makeGrafanaRequest(endpoint);
    return plugins;
}

// 25. Get plugin details
async function getPluginByID(pluginId) {
    const endpoint = `/api/plugins/${pluginId}/settings`;
    const plugin = await makeGrafanaRequest(endpoint);
    return plugin;
}

/**
 * PROMETHEUS QUERY FUNCTIONS
 * Query Prometheus through Grafana's data source proxy
 */

// 26. Query Prometheus (instant query)
async function prometheusQuery(query, datasourceUid = 'bezqgzwpyn8cgc', time = null) {
    const params = new URLSearchParams();
    params.append('query', query);
    if (time) params.append('time', time);
    
    const endpoint = `/api/datasources/proxy/uid/${datasourceUid}/api/v1/query?${params.toString()}`;
    const result = await makeGrafanaRequest(endpoint);
    return result;
}

// 27. Query Prometheus (range query)
async function prometheusQueryRange(query, start, end, step = '15s', datasourceUid = 'bezqgzwpyn8cgc') {
    const params = new URLSearchParams();
    params.append('query', query);
    params.append('start', start);
    params.append('end', end);
    params.append('step', step);
    
    const endpoint = `/api/datasources/proxy/uid/${datasourceUid}/api/v1/query_range?${params.toString()}`;
    const result = await makeGrafanaRequest(endpoint);
    return result;
}

// 28. Get Prometheus labels
async function prometheusLabels(datasourceUid = 'bezqgzwpyn8cgc') {
    const endpoint = `/api/datasources/proxy/uid/${datasourceUid}/api/v1/labels`;
    const result = await makeGrafanaRequest(endpoint);
    return result;
}

// 29. Get Prometheus label values
async function prometheusLabelValues(label, datasourceUid = 'bezqgzwpyn8cgc') {
    const endpoint = `/api/datasources/proxy/uid/${datasourceUid}/api/v1/label/${label}/values`;
    const result = await makeGrafanaRequest(endpoint);
    return result;
}

// 30. Get Prometheus series
async function prometheusSeries(match, start = null, end = null, datasourceUid = 'bezqgzwpyn8cgc') {
    const params = new URLSearchParams();
    if (Array.isArray(match)) {
        match.forEach(m => params.append('match[]', m));
    } else {
        params.append('match[]', match);
    }
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    
    const endpoint = `/api/datasources/proxy/uid/${datasourceUid}/api/v1/series?${params.toString()}`;
    const result = await makeGrafanaRequest(endpoint);
    return result;
}

// 31. Get Prometheus targets
async function prometheusTargets(datasourceUid = 'bezqgzwpyn8cgc') {
    const endpoint = `/api/datasources/proxy/uid/${datasourceUid}/api/v1/targets`;
    const result = await makeGrafanaRequest(endpoint);
    return result;
}

// 32. Get Prometheus metrics metadata
async function prometheusMetadata(datasourceUid = 'bezqgzwpyn8cgc', metric = null) {
    const params = new URLSearchParams();
    if (metric) params.append('metric', metric);
    
    const endpoint = `/api/datasources/proxy/uid/${datasourceUid}/api/v1/metadata?${params.toString()}`;
    const result = await makeGrafanaRequest(endpoint);
    return result;
}

// Export all tools
module.exports = {
    // Dashboard operations
    searchDashboards,
    getDashboardByUID,
    getDashboardBySlug,
    getDashboardVersions,
    getDashboardVersion,
    getDashboardTags,
    
    // Folder operations
    getFolders,
    getFolderByUID,
    
    // Data source operations
    getDataSources,
    getDataSourceByID,
    getDataSourceByUID,
    getDataSourceByName,
    
    // Alert operations
    getAlerts,
    getAlertByID,
    getAlertNotificationChannels,
    
    // Organization and user operations
    getOrganization,
    getOrganizations,
    getCurrentUser,
    getTeams,
    
    // Other operations
    getHealthStatus,
    getAnnotations,
    getLibraryPanels,
    getSnapshots,
    getPlugins,
    getPluginByID,
    
    // Prometheus operations
    prometheusQuery,
    prometheusQueryRange,
    prometheusLabels,
    prometheusLabelValues,
    prometheusSeries,
    prometheusTargets,
    prometheusMetadata,
};

/**
 * CLI interface for testing
 */
if (require.main === module) {
    const command = process.argv[2];
    
    (async () => {
        try {
            switch (command) {
                case 'health':
                    console.log('Checking Grafana health...');
                    const health = await getHealthStatus();
                    console.log(JSON.stringify(health, null, 2));
                    break;
                    
                case 'dashboards':
                    console.log('Fetching all dashboards...');
                    const dashboards = await searchDashboards();
                    console.log(JSON.stringify(dashboards, null, 2));
                    break;
                    
                case 'dashboard':
                    const uid = process.argv[3];
                    if (!uid) {
                        console.error('Please provide dashboard UID');
                        process.exit(1);
                    }
                    console.log(`Fetching dashboard with UID: ${uid}...`);
                    const dashboard = await getDashboardByUID(uid);
                    console.log(JSON.stringify(dashboard, null, 2));
                    break;
                    
                case 'datasources':
                    console.log('Fetching all data sources...');
                    const dataSources = await getDataSources();
                    console.log(JSON.stringify(dataSources, null, 2));
                    break;
                    
                case 'alerts':
                    console.log('Fetching all alerts...');
                    const alerts = await getAlerts();
                    console.log(JSON.stringify(alerts, null, 2));
                    break;
                    
                case 'folders':
                    console.log('Fetching all folders...');
                    const folders = await getFolders();
                    console.log(JSON.stringify(folders, null, 2));
                    break;
                    
                case 'tags':
                    console.log('Fetching dashboard tags...');
                    const tags = await getDashboardTags();
                    console.log(JSON.stringify(tags, null, 2));
                    break;
                    
                case 'user':
                    console.log('Fetching current user...');
                    const user = await getCurrentUser();
                    console.log(JSON.stringify(user, null, 2));
                    break;
                    
                case 'snapshots':
                    console.log('Fetching all snapshots...');
                    const snapshots = await getSnapshots();
                    console.log(JSON.stringify(snapshots, null, 2));
                    break;
                    
                case 'plugins':
                    console.log('Fetching all plugins...');
                    const plugins = await getPlugins();
                    console.log(JSON.stringify(plugins, null, 2));
                    break;
                    
                case 'export':
                    const exportUid = process.argv[3];
                    const outputFile = process.argv[4] || `dashboard-${exportUid}.json`;
                    if (!exportUid) {
                        console.error('Please provide dashboard UID to export');
                        console.log('Usage: node grafana-reader.js export <UID> [output-file.json]');
                        process.exit(1);
                    }
                    console.log(`Exporting dashboard with UID: ${exportUid}...`);
                    const exportDashboard = await getDashboardByUID(exportUid);
                    require('fs').writeFileSync(outputFile, JSON.stringify(exportDashboard, null, 2));
                    console.log(`Dashboard exported to: ${outputFile}`);
                    break;
                    
                case 'prom-query':
                case 'query':
                    const queryExpr = process.argv[3];
                    if (!queryExpr) {
                        console.error('Please provide a PromQL query');
                        console.log('Usage: node grafana-reader.js query "<promql-query>"');
                        console.log('Example: node grafana-reader.js query "up"');
                        process.exit(1);
                    }
                    console.log(`Executing query: ${queryExpr}`);
                    const queryResult = await prometheusQuery(queryExpr);
                    console.log(JSON.stringify(queryResult, null, 2));
                    break;
                    
                case 'prom-range':
                case 'range':
                    const rangeQuery = process.argv[3];
                    const rangeStart = process.argv[4];
                    const rangeEnd = process.argv[5];
                    const rangeStep = process.argv[6] || '15s';
                    if (!rangeQuery || !rangeStart || !rangeEnd) {
                        console.error('Please provide query, start time, and end time');
                        console.log('Usage: node grafana-reader.js range "<promql-query>" <start-timestamp> <end-timestamp> [step]');
                        console.log('Example: node grafana-reader.js range "up" 1648728000 1648731600 15s');
                        process.exit(1);
                    }
                    console.log(`Executing range query: ${rangeQuery}`);
                    const rangeResult = await prometheusQueryRange(rangeQuery, rangeStart, rangeEnd, rangeStep);
                    console.log(JSON.stringify(rangeResult, null, 2));
                    break;
                    
                case 'prom-labels':
                case 'labels':
                    console.log('Fetching Prometheus labels...');
                    const labelsResult = await prometheusLabels();
                    console.log(JSON.stringify(labelsResult, null, 2));
                    break;
                    
                case 'prom-label-values':
                case 'label-values':
                    const labelName = process.argv[3];
                    if (!labelName) {
                        console.error('Please provide label name');
                        console.log('Usage: node grafana-reader.js label-values <label-name>');
                        console.log('Example: node grafana-reader.js label-values namespace');
                        process.exit(1);
                    }
                    console.log(`Fetching values for label: ${labelName}`);
                    const labelValuesResult = await prometheusLabelValues(labelName);
                    console.log(JSON.stringify(labelValuesResult, null, 2));
                    break;
                    
                case 'prom-targets':
                case 'targets':
                    console.log('Fetching Prometheus targets...');
                    const targetsResult = await prometheusTargets();
                    console.log(JSON.stringify(targetsResult, null, 2));
                    break;
                    
                default:
                    console.log('Available commands:');
                    console.log('\nGrafana Operations:');
                    console.log('  node grafana-reader.js health           - Check Grafana health');
                    console.log('  node grafana-reader.js dashboards       - List all dashboards');
                    console.log('  node grafana-reader.js dashboard <UID>  - Get specific dashboard');
                    console.log('  node grafana-reader.js datasources      - List all data sources');
                    console.log('  node grafana-reader.js alerts           - List all alerts');
                    console.log('  node grafana-reader.js folders          - List all folders');
                    console.log('  node grafana-reader.js tags             - List all dashboard tags');
                    console.log('  node grafana-reader.js user             - Get current user');
                    console.log('  node grafana-reader.js snapshots        - List all snapshots');
                    console.log('  node grafana-reader.js plugins          - List all plugins');
                    console.log('  node grafana-reader.js export <UID> [output.json] - Export dashboard to file');
                    console.log('\nPrometheus Query Operations:');
                    console.log('  node grafana-reader.js query "<promql>"           - Execute instant query');
                    console.log('  node grafana-reader.js range "<promql>" <start> <end> [step] - Execute range query');
                    console.log('  node grafana-reader.js labels                     - Get all Prometheus labels');
                    console.log('  node grafana-reader.js label-values <label>       - Get values for a label');
                    console.log('  node grafana-reader.js targets                    - Get Prometheus scrape targets');
                    console.log('\nExamples:');
                    console.log('  node grafana-reader.js query "up"');
                    console.log('  node grafana-reader.js query "kube_pod_info{namespace=\\"default\\"}"');
                    console.log('  node grafana-reader.js label-values namespace');
                    console.log('  node grafana-reader.js range "up" 1648728000 1648731600 30s');
                    break;
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}
