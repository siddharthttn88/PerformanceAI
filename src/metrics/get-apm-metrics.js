/**
 * Get APM application metrics from New Relic
 */

const newrelic = require('../clients/newrelic-client.js');

async function getApmMetrics(applicationName, minutes = 5) {
    try {
        console.log(`Fetching APM metrics for ${applicationName} (last ${minutes} minutes)...\n`);
        
        const now = Math.floor(Date.now() / 1000);
        const start = now - (minutes * 60);
        
        // 1. Get application list to find the app
        console.log('=== Finding Application ===');
        const apps = await newrelic.listApmApplicationsRest();
        
        const app = apps.applications?.find(a => 
            a.name.toLowerCase().includes(applicationName.toLowerCase())
        );
        
        if (!app) {
            console.log(`No application found matching: ${applicationName}`);
            console.log('\nAvailable applications:');
            apps.applications?.forEach(a => {
                console.log(`  - ${a.name} (ID: ${a.id})`);
            });
            return;
        }
        
        console.log(`Found: ${app.name} (ID: ${app.id})`);
        console.log(`  Health Status: ${app.health_status}`);
        console.log(`  Reporting: ${app.reporting}`);
        console.log(`  Language: ${app.language}`);
        
        // 2. Get application details
        console.log('\n=== Application Details ===');
        const details = await newrelic.getApplicationDetails(app.id);
        const appDetails = details.application;
        
        console.log(`Application Summary:`);
        console.log(`  Name: ${appDetails.name}`);
        console.log(`  Health Status: ${appDetails.health_status}`);
        console.log(`  Response Time: ${appDetails.application_summary?.response_time || 'N/A'} ms`);
        console.log(`  Throughput: ${appDetails.application_summary?.throughput || 'N/A'} rpm`);
        console.log(`  Error Rate: ${appDetails.application_summary?.error_rate || 'N/A'}%`);
        console.log(`  Apdex Score: ${appDetails.application_summary?.apdex_score || 'N/A'}`);
        console.log(`  Host Count: ${appDetails.application_summary?.host_count || 'N/A'}`);
        console.log(`  Instance Count: ${appDetails.application_summary?.instance_count || 'N/A'}`);
        
        // 3. Get application hosts
        console.log('\n=== Application Hosts ===');
        const hosts = await newrelic.getApplicationHosts(app.id);
        
        if (hosts.application_hosts && hosts.application_hosts.length > 0) {
            console.log(`Found ${hosts.application_hosts.length} host(s):\n`);
            
            hosts.application_hosts.forEach((host, index) => {
                console.log(`Host ${index + 1}:`);
                console.log(`  Name: ${host.host}`);
                console.log(`  ID: ${host.id}`);
                console.log(`  Health Status: ${host.health_status}`);
                console.log(`  Response Time: ${host.application_summary?.response_time || 'N/A'} ms`);
                console.log(`  Throughput: ${host.application_summary?.throughput || 'N/A'} rpm`);
                console.log(`  Error Rate: ${host.application_summary?.error_rate || 'N/A'}%`);
                console.log('');
            });
        } else {
            console.log('  No host data available');
        }
        
        // 4. Get transaction metrics via NRQL
        console.log('\n=== Transaction Metrics (Last 5 Minutes) ===');
        
        const transactionQuery = `
            SELECT 
                count(*) as 'requests',
                average(duration) as 'avg_duration',
                percentile(duration, 95) as 'p95_duration',
                percentile(duration, 99) as 'p99_duration'
            FROM Transaction 
            WHERE appName = '${app.name}'
            SINCE ${minutes} minutes ago
        `;
        
        const transactionResults = await newrelic.runNrqlQuery(transactionQuery);
        
        if (transactionResults && transactionResults.length > 0) {
            const metrics = transactionResults[0];
            console.log(`Requests: ${metrics.requests || 0}`);
            console.log(`Avg Duration: ${(metrics.avg_duration * 1000).toFixed(2)} ms`);
            console.log(`P95 Duration: ${(metrics.p95_duration * 1000).toFixed(2)} ms`);
            console.log(`P99 Duration: ${(metrics.p99_duration * 1000).toFixed(2)} ms`);
        } else {
            console.log('  No transaction data available');
        }
        
        // 5. Get error metrics
        console.log('\n=== Error Metrics ===');
        
        const errorQuery = `
            SELECT 
                count(*) as 'total_errors',
                uniqueCount(\`error.class\`) as 'unique_error_types'
            FROM TransactionError 
            WHERE appName = '${app.name}'
            SINCE ${minutes} minutes ago
        `;
        
        const errorResults = await newrelic.runNrqlQuery(errorQuery);
        
        if (errorResults && errorResults.length > 0) {
            const errors = errorResults[0];
            console.log(`Total Errors: ${errors.total_errors || 0}`);
            console.log(`Unique Error Types: ${errors.unique_error_types || 0}`);
        } else {
            console.log('  No errors in this period');
        }
        
        // 6. Get top transactions
        console.log('\n=== Top Transactions (by count) ===');
        
        const topTransactionsQuery = `
            SELECT 
                count(*) as 'count',
                average(duration) as 'avg_duration'
            FROM Transaction 
            WHERE appName = '${app.name}'
            FACET name 
            SINCE ${minutes} minutes ago 
            LIMIT 10
        `;
        
        const topTransactions = await newrelic.runNrqlQuery(topTransactionsQuery);
        
        if (topTransactions && topTransactions.length > 0) {
            topTransactions.forEach((txn, index) => {
                console.log(`  ${index + 1}. ${txn.name}`);
                console.log(`     Requests: ${txn.count}, Avg Duration: ${(txn.avg_duration * 1000).toFixed(2)} ms`);
            });
        } else {
            console.log('  No transaction data available');
        }
        
        // 7. Check for recent deployments
        console.log('\n=== Recent Deployments ===');
        try {
            const deployments = await newrelic.listDeployments(app.id);
            
            if (deployments.deployments && deployments.deployments.length > 0) {
                const recentDeployments = deployments.deployments.slice(0, 5);
                recentDeployments.forEach((dep, index) => {
                    console.log(`  ${index + 1}. Revision: ${dep.revision || 'N/A'}`);
                    console.log(`     Timestamp: ${dep.timestamp}`);
                    console.log(`     User: ${dep.user || 'N/A'}`);
                    console.log(`     Description: ${dep.description || 'N/A'}`);
                    console.log('');
                });
            } else {
                console.log('  No recent deployments found');
            }
        } catch (error) {
            console.log(`  Unable to fetch deployments: ${error.message}`);
        }
        
        console.log('\n=== Summary Complete ===\n');
        
    } catch (error) {
        console.error('Error fetching APM metrics:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const applicationName = process.argv[2];
    const minutes = parseInt(process.argv[3]) || 5;
    
    if (!applicationName) {
        console.log('Usage: node get-apm-metrics.js <application-name> [minutes]');
        console.log('');
        console.log('Examples:');
        console.log('  node get-apm-metrics.js subscriber-event 5');
        console.log('  node get-apm-metrics.js learn-action 10');
        console.log('');
        console.log('To list all applications:');
        console.log('  node newrelic-client.js apps');
        process.exit(1);
    }
    
    getApmMetrics(applicationName, minutes);
}

module.exports = { getApmMetrics };
