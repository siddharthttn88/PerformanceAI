/**
 * New Relic Client for querying observability data
 * Supports both NerdGraph (GraphQL) and REST v2 APIs
 * 
 * ⚠️ READ-ONLY MODE ENFORCED ⚠️
 * This client only supports read operations (GET, query)
 * All write operations (POST, PUT, DELETE, mutations) are blocked
 * 
 * Blocked operations:
 * - GraphQL mutations
 * - REST POST/PUT/DELETE methods
 * - Creating deployment markers
 * - Updating configurations
 * - Deleting resources
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load configuration from config.json
let NEW_RELIC_API_KEY, NEW_RELIC_ACCOUNT_ID, NEW_RELIC_REGION;

try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Get values from config.json, fallback to environment variables
    NEW_RELIC_API_KEY = process.env.NEW_RELIC_API_KEY || config.mcpServers?.newrelic?.env?.NEW_RELIC_API_KEY || '';
    NEW_RELIC_ACCOUNT_ID = process.env.NEW_RELIC_ACCOUNT_ID || config.mcpServers?.newrelic?.env?.NEW_RELIC_ACCOUNT_ID || '';
    NEW_RELIC_REGION = process.env.NEW_RELIC_REGION || config.mcpServers?.newrelic?.env?.NEW_RELIC_REGION || 'US';
} catch (error) {
    console.error('Error loading config.json:', error.message);
    console.error('Falling back to environment variables only');
    NEW_RELIC_API_KEY = process.env.NEW_RELIC_API_KEY || '';
    NEW_RELIC_ACCOUNT_ID = process.env.NEW_RELIC_ACCOUNT_ID || '';
    NEW_RELIC_REGION = process.env.NEW_RELIC_REGION || 'US';
}

// API Endpoints
const NERDGRAPH_URL = NEW_RELIC_REGION === 'EU' 
    ? 'https://api.eu.newrelic.com/graphql'
    : 'https://api.newrelic.com/graphql';

const REST_API_URL = NEW_RELIC_REGION === 'EU'
    ? 'https://api.eu.newrelic.com/v2'
    : 'https://api.newrelic.com/v2';

/**
 * Make HTTP request to New Relic API
 */
function makeRequest(url, options) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const requestOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = client.request(requestOptions, (res) => {
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

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

/**
 * Make NerdGraph (GraphQL) query (read-only validation)
 */
async function nerdGraphQuery(query, variables = {}) {
    // Read-only enforcement: prevent mutation operations
    const queryLower = query.toLowerCase().trim();
    if (queryLower.startsWith('mutation')) {
        throw new Error('READ-ONLY MODE: GraphQL mutations are not allowed. Only queries are permitted.');
    }
    
    // Check for potentially dangerous operations in query text
    const dangerousKeywords = ['create', 'update', 'delete', 'set', 'modify', 'acknowledge'];
    const hasDangerousKeyword = dangerousKeywords.some(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(queryLower);
    });
    
    if (hasDangerousKeyword) {
        console.warn('WARNING: Query contains keywords that might indicate write operations. Proceeding with caution...');
    }
    
    const response = await makeRequest(NERDGRAPH_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'API-Key': NEW_RELIC_API_KEY
        },
        body: JSON.stringify({ query, variables })
    });

    if (response.errors) {
        throw new Error(`NerdGraph Error: ${JSON.stringify(response.errors)}`);
    }

    return response.data;
}

/**
 * Make REST API request (read-only operations)
 */
async function restApiRequest(endpoint, method = 'GET', body = null) {
    // Read-only enforcement: only allow GET requests
    if (method !== 'GET') {
        throw new Error('READ-ONLY MODE: Only GET requests are allowed. Write operations are disabled.');
    }
    
    const url = `${REST_API_URL}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': NEW_RELIC_API_KEY
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    return await makeRequest(url, options);
}

/**
 * NRQL QUERIES
 */

// Run NRQL query
async function runNrqlQuery(nrql, accountId = NEW_RELIC_ACCOUNT_ID) {
    const query = `
        query($accountId: Int!, $nrql: Nrql!) {
            actor {
                account(id: $accountId) {
                    nrql(query: $nrql) {
                        results
                    }
                }
            }
        }
    `;

    const variables = {
        accountId: parseInt(accountId),
        nrql: nrql
    };

    const data = await nerdGraphQuery(query, variables);
    return data.actor.account.nrql.results;
}

/**
 * APM OPERATIONS
 */

// List APM applications (NerdGraph)
async function listApmApplications(accountId = NEW_RELIC_ACCOUNT_ID) {
    const query = `
        query($accountId: Int!) {
            actor {
                account(id: $accountId) {
                    nrql(query: "SELECT uniques(appName) FROM Transaction SINCE 1 day ago") {
                        results
                    }
                }
            }
        }
    `;

    const data = await nerdGraphQuery(query, { accountId: parseInt(accountId) });
    return data.actor.account.nrql.results;
}

// List APM applications (REST API)
async function listApmApplicationsRest() {
    return await restApiRequest('/applications.json');
}

// Get application details
async function getApplicationDetails(applicationId) {
    return await restApiRequest(`/applications/${applicationId}.json`);
}

// Get application hosts
async function getApplicationHosts(applicationId) {
    return await restApiRequest(`/applications/${applicationId}/hosts.json`);
}

/**
 * ENTITY OPERATIONS
 */

// Search entities
async function searchEntities(query, entityTypes = null, accountId = NEW_RELIC_ACCOUNT_ID) {
    const gqlQuery = `
        query($query: String!) {
            actor {
                entitySearch(query: $query) {
                    results {
                        entities {
                            guid
                            name
                            entityType
                            domain
                            type
                            reporting
                            ... on ApmApplicationEntityOutline {
                                applicationId
                                language
                            }
                        }
                    }
                }
            }
        }
    `;

    const searchQuery = entityTypes 
        ? `${query} AND type IN (${entityTypes.map(t => `'${t}'`).join(',')})`
        : query;

    const data = await nerdGraphQuery(gqlQuery, { query: searchQuery });
    return data.actor.entitySearch.results.entities;
}

// Get entity details
async function getEntityDetails(entityGuid) {
    const query = `
        query($guid: EntityGuid!) {
            actor {
                entity(guid: $guid) {
                    guid
                    name
                    entityType
                    domain
                    type
                    reporting
                    ... on ApmApplicationEntity {
                        applicationId
                        language
                        settings {
                            apdexTarget
                        }
                        recentAlertViolations {
                            agentUrl
                            alertSeverity
                            closedAt
                            label
                            openedAt
                            violationId
                            violationUrl
                        }
                    }
                }
            }
        }
    `;

    const data = await nerdGraphQuery(query, { guid: entityGuid });
    return data.actor.entity;
}

/**
 * ALERT OPERATIONS
 */

// List alert policies
async function listAlertPolicies(accountId = NEW_RELIC_ACCOUNT_ID) {
    const query = `
        query($accountId: Int!) {
            actor {
                account(id: $accountId) {
                    alerts {
                        policiesSearch {
                            policies {
                                id
                                name
                                incidentPreference
                            }
                        }
                    }
                }
            }
        }
    `;

    const data = await nerdGraphQuery(query, { accountId: parseInt(accountId) });
    return data.actor.account.alerts.policiesSearch.policies;
}

// List open incidents
async function listOpenIncidents(accountId = NEW_RELIC_ACCOUNT_ID) {
    const nrql = `SELECT * FROM NrAiIncident WHERE state = 'open' SINCE 7 days ago`;
    return await runNrqlQuery(nrql, accountId);
}

/**
 * METRICS OPERATIONS
 */

// List metric names for a host
async function listMetricNames(hostId) {
    return await restApiRequest(`/hosts/${hostId}/metrics.json`);
}

// Get metric data
async function getMetricData(hostId, names, from, to, summarize = false) {
    const params = new URLSearchParams();
    names.forEach(name => params.append('names[]', name));
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (summarize) params.append('summarize', 'true');

    return await restApiRequest(`/hosts/${hostId}/metrics/data.json?${params.toString()}`);
}

/**
 * DEPLOYMENT OPERATIONS (READ-ONLY)
 */

// Note: createDeployment is NOT included - read-only operations only
// If you need to create deployment markers, use the New Relic UI or dedicated deployment tools

// List deployments (read-only)
async function listDeployments(applicationId) {
    return await restApiRequest(`/applications/${applicationId}/deployments.json`);
}

/**
 * SYNTHETICS OPERATIONS
 */

// List synthetics monitors
async function listSyntheticsMonitors(accountId = NEW_RELIC_ACCOUNT_ID) {
    const query = `
        query($accountId: Int!) {
            actor {
                account(id: $accountId) {
                    synthetics {
                        monitors {
                            id
                            name
                            type
                            status
                            locations {
                                name
                            }
                        }
                    }
                }
            }
        }
    `;

    const data = await nerdGraphQuery(query, { accountId: parseInt(accountId) });
    return data.actor.account.synthetics.monitors;
}

/**
 * ACCOUNT OPERATIONS
 */

// Get account details
async function getAccountDetails(accountId = NEW_RELIC_ACCOUNT_ID) {
    const query = `
        query($accountId: Int!) {
            actor {
                account(id: $accountId) {
                    id
                    name
                }
            }
        }
    `;

    const data = await nerdGraphQuery(query, { accountId: parseInt(accountId) });
    return data.actor.account;
}

// Export all functions
module.exports = {
    // Core functions
    nerdGraphQuery,
    restApiRequest,
    
    // NRQL
    runNrqlQuery,
    
    // APM
    listApmApplications,
    listApmApplicationsRest,
    getApplicationDetails,
    getApplicationHosts,
    
    // Entities
    searchEntities,
    getEntityDetails,
    
    // Alerts
    listAlertPolicies,
    listOpenIncidents,
    
    // Metrics
    listMetricNames,
    getMetricData,
    
    // Deployments (READ-ONLY)
    // createDeployment - REMOVED: Write operation not allowed
    listDeployments,
    
    // Synthetics
    listSyntheticsMonitors,
    
    // Account
    getAccountDetails,
};

/**
 * CLI interface for testing
 */
if (require.main === module) {
    const command = process.argv[2];
    
    (async () => {
        try {
            switch (command) {
                case 'account':
                    console.log('Fetching account details...');
                    const account = await getAccountDetails();
                    console.log(JSON.stringify(account, null, 2));
                    break;
                    
                case 'apps':
                    console.log('Fetching APM applications...');
                    const apps = await listApmApplicationsRest();
                    console.log(JSON.stringify(apps, null, 2));
                    break;
                    
                case 'alerts':
                    console.log('Fetching alert policies...');
                    const alerts = await listAlertPolicies();
                    console.log(JSON.stringify(alerts, null, 2));
                    break;
                    
                case 'incidents':
                    console.log('Fetching open incidents...');
                    const incidents = await listOpenIncidents();
                    console.log(JSON.stringify(incidents, null, 2));
                    break;
                    
                case 'nrql':
                    const nrql = process.argv[3];
                    if (!nrql) {
                        console.error('Please provide NRQL query');
                        console.log('Usage: node newrelic-client.js nrql "SELECT * FROM Transaction LIMIT 10"');
                        process.exit(1);
                    }
                    console.log(`Executing NRQL: ${nrql}`);
                    const results = await runNrqlQuery(nrql);
                    console.log(JSON.stringify(results, null, 2));
                    break;
                    
                case 'search':
                    const searchQuery = process.argv[3];
                    if (!searchQuery) {
                        console.error('Please provide search query');
                        console.log('Usage: node newrelic-client.js search "name LIKE \'%api%\'"');
                        process.exit(1);
                    }
                    console.log(`Searching entities: ${searchQuery}`);
                    const entities = await searchEntities(searchQuery);
                    console.log(JSON.stringify(entities, null, 2));
                    break;
                    
                default:
                    console.log('Available commands:');
                    console.log('  node newrelic-client.js account               - Get account details');
                    console.log('  node newrelic-client.js apps                  - List APM applications');
                    console.log('  node newrelic-client.js alerts                - List alert policies');
                    console.log('  node newrelic-client.js incidents             - List open incidents');
                    console.log('  node newrelic-client.js nrql "<query>"        - Run NRQL query');
                    console.log('  node newrelic-client.js search "<query>"      - Search entities');
                    console.log('');
                    console.log('Examples:');
                    console.log('  node newrelic-client.js nrql "SELECT count(*) FROM Transaction SINCE 1 hour ago"');
                    console.log('  node newrelic-client.js search "name LIKE \'%prod%\'"');
                    break;
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}
