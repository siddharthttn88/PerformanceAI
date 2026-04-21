/**
 * Enhanced APM Metrics Collection from New Relic
 * 
 * Features:
 * - Accepts exact timestamps from test
 * - Retrieves top N slowest transactions
 * - Retrieves top N highest error rate transactions
 * - Gets error breakdown by type/status
 * 
 * Usage:
 *   node get-apm-metrics-enhanced.js <app-name> <start-epoch> <end-epoch> [top-n]
 *   OR
 *   node get-apm-metrics-enhanced.js <app-name> <minutes> (uses current time)
 */

const newrelic = require('./newrelic-client.js');

async function getApmMetricsEnhanced(applicationName, startEpoch, endEpoch, topN = 10) {
    try {
        const duration = endEpoch - startEpoch;
        const durationMinutes = Math.ceil(duration / 60);
        const startTime = new Date(startEpoch * 1000).toISOString();
        const endTime = new Date(endEpoch * 1000).toISOString();
        
        console.log(`Fetching APM metrics for ${applicationName}`);
        console.log(`Time Range: ${startTime} to ${endTime}`);
        console.log(`Duration: ${durationMinutes} minutes\n`);
        
        // 1. Find the application
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
            return null;
        }
        
        console.log(`Found: ${app.name} (ID: ${app.id})`);
        
        // 2. Get application summary metrics
        console.log('\n=== Application Summary ===');
        const details = await newrelic.getApplicationDetails(app.id);
        const appDetails = details.application;
        
        const summary = {
            name: appDetails.name,
            health: appDetails.health_status,
            apdex: appDetails.application_summary?.apdex_score || 'N/A',
            responseTime: appDetails.application_summary?.response_time || 'N/A',
            throughput: appDetails.application_summary?.throughput || 'N/A',
            errorRate: appDetails.application_summary?.error_rate || 'N/A',
            hostCount: appDetails.application_summary?.host_count || 'N/A'
        };
        
        console.log(`Health: ${summary.health}`);
        console.log(`Apdex: ${summary.apdex}`);
        console.log(`Response Time: ${summary.responseTime} ms`);
        console.log(`Throughput: ${summary.throughput} rpm`);
        console.log(`Error Rate: ${summary.errorRate}%`);
        console.log(`Hosts: ${summary.hostCount}`);
        
        // 3. Get transaction metrics during the test
        console.log('\n=== Transaction Metrics (During Test) ===');
        
        const transactionQuery = `
            SELECT 
                count(*) as 'requests',
                average(duration) as 'avg_duration',
                percentile(duration, 50) as 'median_duration',
                percentile(duration, 95) as 'p95_duration',
                percentile(duration, 99) as 'p99_duration'
            FROM Transaction 
            WHERE appName = '${app.name}'
            SINCE '${startTime}' UNTIL '${endTime}'
        `;
        
        const transactionResults = await newrelic.runNrqlQuery(transactionQuery);
        
        if (transactionResults && transactionResults.length > 0) {
            const metrics = transactionResults[0];
            console.log(`Total Requests: ${metrics.requests?.toLocaleString() || 0}`);
            console.log(`Avg Duration: ${((metrics.avg_duration || 0) * 1000).toFixed(2)} ms`);
            console.log(`Median Duration: ${((metrics.median_duration || 0) * 1000).toFixed(2)} ms`);
            console.log(`P95 Duration: ${((metrics.p95_duration || 0) * 1000).toFixed(2)} ms`);
            console.log(`P99 Duration: ${((metrics.p99_duration || 0) * 1000).toFixed(2)} ms`);
        }
        
        // 4. Get error metrics
        console.log('\n=== Error Metrics ===');
        
        const errorQuery = `
            SELECT 
                count(*) as 'total_errors',
                uniqueCount(\`error.class\`) as 'unique_error_types'
            FROM TransactionError 
            WHERE appName = '${app.name}'
            SINCE '${startTime}' UNTIL '${endTime}'
        `;
        
        const errorResults = await newrelic.runNrqlQuery(errorQuery);
        
        let totalErrors = 0;
        let uniqueErrorTypes = 0;
        if (errorResults && errorResults.length > 0) {
            const errors = errorResults[0];
            totalErrors = errors.total_errors || 0;
            uniqueErrorTypes = errors.unique_error_types || 0;
            console.log(`Total Errors: ${totalErrors.toLocaleString()}`);
            console.log(`Unique Error Types: ${uniqueErrorTypes}`);
        } else {
            console.log('No errors recorded in APM');
        }
        
        // 5. Get error breakdown by status code (if available)
        console.log('\n=== Error Breakdown by HTTP Status ===');
        
        const statusErrorQuery = `
            SELECT count(*) as 'count'
            FROM TransactionError 
            WHERE appName = '${app.name}'
            FACET \`http.statusCode\`
            SINCE '${startTime}' UNTIL '${endTime}'
            LIMIT 20
        `;
        
        const statusErrors = await newrelic.runNrqlQuery(statusErrorQuery);
        
        if (statusErrors && statusErrors.length > 0) {
            statusErrors.forEach(err => {
                const statusCode = err['http.statusCode'] || 'Unknown';
                const count = err.count || 0;
                console.log(`  ${statusCode}: ${count.toLocaleString()} errors`);
            });
        } else {
            console.log('  No status code breakdown available');
        }
        
        // 6. Get TOP N slowest transactions
        console.log(`\n=== Top ${topN} Slowest Transactions ===`);
        
        const slowestTransactionsQuery = `
            SELECT 
                count(*) as 'count',
                average(duration) as 'avg_duration',
                percentile(duration, 95) as 'p95_duration'
            FROM Transaction 
            WHERE appName = '${app.name}'
            FACET name 
            SINCE '${startTime}' UNTIL '${endTime}'
            LIMIT ${topN}
        `;
        
        const slowestTransactions = await newrelic.runNrqlQuery(slowestTransactionsQuery);
        
        const sortedByDuration = [];
        if (slowestTransactions && slowestTransactions.length > 0) {
            slowestTransactions.forEach((txn, idx) => {
                const avgMs = (txn.avg_duration || 0) * 1000;
                const p95Ms = (txn.p95_duration || 0) * 1000;
                sortedByDuration.push({
                    name: txn.name,
                    count: txn.count,
                    avgDuration: avgMs,
                    p95Duration: p95Ms
                });
            });
            
            // Sort by average duration descending
            sortedByDuration.sort((a, b) => b.avgDuration - a.avgDuration);
            
            sortedByDuration.slice(0, topN).forEach((txn, idx) => {
                console.log(`\n${idx + 1}. ${txn.name}`);
                console.log(`   Requests: ${txn.count.toLocaleString()}`);
                console.log(`   Avg Duration: ${txn.avgDuration.toFixed(2)} ms`);
                console.log(`   P95 Duration: ${txn.p95Duration.toFixed(2)} ms`);
            });
        } else {
            console.log('  No transaction data available');
        }
        
        // 7. Get TOP N highest error rate transactions
        console.log(`\n=== Top ${topN} Highest Error Rate Transactions ===`);
        
        const errorRateQuery = `
            SELECT 
                count(*) as 'total',
                filter(count(*), WHERE error IS true) as 'errors'
            FROM Transaction 
            WHERE appName = '${app.name}'
            FACET name 
            SINCE '${startTime}' UNTIL '${endTime}'
            LIMIT 100
        `;
        
        const errorRateResults = await newrelic.runNrqlQuery(errorRateQuery);
        
        const sortedByErrorRate = [];
        if (errorRateResults && errorRateResults.length > 0) {
            errorRateResults.forEach(txn => {
                const total = txn.total || 0;
                const errors = txn.errors || 0;
                const errorRate = total > 0 ? (errors / total * 100) : 0;
                
                if (errors > 0) { // Only include transactions with errors
                    sortedByErrorRate.push({
                        name: txn.name,
                        total,
                        errors,
                        errorRate
                    });
                }
            });
            
            // Sort by error rate descending
            sortedByErrorRate.sort((a, b) => b.errorRate - a.errorRate);
            
            sortedByErrorRate.slice(0, topN).forEach((txn, idx) => {
                console.log(`\n${idx + 1}. ${txn.name}`);
                console.log(`   Total Requests: ${txn.total.toLocaleString()}`);
                console.log(`   Errors: ${txn.errors.toLocaleString()}`);
                console.log(`   Error Rate: ${txn.errorRate.toFixed(2)}%`);
            });
        } else {
            console.log('  No error data available');
        }
        
        // 8. Get host-level metrics
        console.log('\n=== Host-Level Metrics ===');
        const hosts = await newrelic.getApplicationHosts(app.id);
        
        if (hosts.application_hosts && hosts.application_hosts.length > 0) {
            console.log(`Found ${hosts.application_hosts.length} host(s):`);
            
            hosts.application_hosts.forEach((host, index) => {
                console.log(`\n  Host ${index + 1}: ${host.host}`);
                console.log(`    Response Time: ${host.application_summary?.response_time || 'N/A'} ms`);
                console.log(`    Throughput: ${host.application_summary?.throughput || 'N/A'} rpm`);
                console.log(`    CPU: ${host.application_summary?.cpu_usage || 'N/A'}%`);
                console.log(`    Memory: ${host.application_summary?.memory_usage || 'N/A'} MB`);
            });
        }
        
        console.log('\n=== SUMMARY ===');
        const result = {
            application: {
                name: app.name,
                id: app.id,
                health: summary.health,
                apdex: summary.apdex,
                responseTime: summary.responseTime,
                throughput: summary.throughput,
                errorRate: summary.errorRate,
                hostCount: summary.hostCount
            },
            topSlowTransactions: sortedByDuration.slice(0, topN),
            topErrorTransactions: sortedByErrorRate.slice(0, topN),
            errorSummary: {
                total: totalErrors,
                uniqueTypes: uniqueErrorTypes
            }
        };
        
        console.log(`Application: ${result.application.name}`);
        console.log(`Health: ${result.application.health} | Apdex: ${result.application.apdex}`);
        console.log(`Response Time: ${result.application.responseTime} ms | Throughput: ${result.application.throughput} rpm`);
        console.log(`Top Slowest Transaction: ${result.topSlowTransactions[0]?.name || 'N/A'} (${(result.topSlowTransactions[0]?.avgDuration || 0).toFixed(2)} ms)`);
        console.log(`Top Error Transaction: ${result.topErrorTransactions[0]?.name || 'N/A'} (${(result.topErrorTransactions[0]?.errorRate || 0).toFixed(2)}%)`);
        
        return result;
        
    } catch (error) {
        console.error('Error fetching APM metrics:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const applicationName = process.argv[2];
    const arg2 = parseInt(process.argv[3]);
    const arg3 = parseInt(process.argv[4]);
    const topN = parseInt(process.argv[5]) || 10;
    
    if (!applicationName) {
        console.log('Usage:');
        console.log('  node get-apm-metrics-enhanced.js <app-name> <start-epoch> <end-epoch> [top-n]');
        console.log('  OR');
        console.log('  node get-apm-metrics-enhanced.js <app-name> <minutes> [top-n]');
        console.log('');
        console.log('Examples:');
        console.log('  node get-apm-metrics-enhanced.js subscriber-event 1776753979 1776754339 10');
        console.log('  node get-apm-metrics-enhanced.js subscriber-event 5 10');
        console.log('');
        console.log('To list all applications:');
        console.log('  node newrelic-client.js apps');
        process.exit(1);
    }
    
    let startEpoch, endEpoch;
    
    if (arg3) {
        // Two timestamps provided
        startEpoch = arg2;
        endEpoch = arg3;
    } else {
        // Minutes provided, use current time
        const minutes = arg2 || 5;
        endEpoch = Math.floor(Date.now() / 1000);
        startEpoch = endEpoch - (minutes * 60);
    }
    
    getApmMetricsEnhanced(applicationName, startEpoch, endEpoch, topN);
}

module.exports = { getApmMetricsEnhanced };
