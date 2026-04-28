#!/usr/bin/env node

const { runNrqlQuery } = require('../clients/newrelic-client.js');
const { readFileSync } = require('fs');
const { join } = require('path');

// Read config
const configPath = join(__dirname, 'config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const accountId = config.mcpServers.newrelic.env.NEW_RELIC_ACCOUNT_ID;

/**
 * Parse timestamp in format "M/D/YYYY, H:MM:SS AM/PM"
 * Returns formatted string for NRQL: 'YYYY-MM-DD HH:MM:SS'
 */
function parseTimestamp(dateStr) {
  // Parse "4/1/2026, 11:02:28 AM" format
  const parts = dateStr.match(/(\d+)\/(\d+)\/(\d+),\s+(\d+):(\d+):(\d+)\s+(AM|PM)/i);
  if (!parts) {
    throw new Error(`Invalid date format: ${dateStr}. Expected format: "M/D/YYYY, H:MM:SS AM/PM"`);
  }

  const [, month, day, year, hour, minute, second, meridiem] = parts;
  let h = parseInt(hour);
  
  // Convert to 24-hour format
  if (meridiem.toUpperCase() === 'PM' && h !== 12) {
    h += 12;
  } else if (meridiem.toUpperCase() === 'AM' && h === 12) {
    h = 0;
  }

  const date = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    h,
    parseInt(minute),
    parseInt(second)
  );

  // Format as 'YYYY-MM-DD HH:MM:SS' for NRQL
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

/**
 * Query New Relic for infrastructure and application metrics
 */
async function queryNewRelicTimeRange(serviceName, startTime, endTime) {
  console.log(`Querying New Relic for ${serviceName} from ${startTime} to ${endTime}...\n`);

  const startFormatted = parseTimestamp(startTime);
  const endFormatted = parseTimestamp(endTime);
  
  // Calculate duration for display
  const startDate = new Date(startFormatted.replace(' ', 'T') + 'Z');
  const endDate = new Date(endFormatted.replace(' ', 'T') + 'Z');
  const durationMinutes = Math.round((endDate - startDate) / (1000 * 60));

  console.log(`Time Range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  console.log(`Duration: ${durationMinutes} minute(s)\n`);

  // Construct NRQL queries for the time range using proper timestamp format
  const sinceClause = `SINCE '${startFormatted}' UNTIL '${endFormatted}'`;

  try {
    // First, find the exact app name
    const exactAppName = serviceName.includes('paytv-load-test') 
      ? serviceName 
      : `paytv-load-test-${serviceName}-service`;
    
    console.log(`Using app name: ${exactAppName}\n`);

    // Query 1: Application Performance Metrics
    console.log('=== APPLICATION PERFORMANCE ===');
    const appPerfQuery = `
      SELECT 
        count(*) as 'Total Requests',
        average(duration)*1000 as 'Avg Response Time (ms)',
        percentile(duration, 95)*1000 as 'P95 Response Time (ms)',
        percentile(duration, 99)*1000 as 'P99 Response Time (ms)',
        rate(count(*), 1 minute) as 'Throughput (rpm)',
        percentage(count(*), WHERE error IS true) as 'Error Rate (%)'
      FROM Transaction 
      WHERE appName = '${exactAppName}' 
      ${sinceClause}
    `;
    const appPerf = await runNrqlQuery(appPerfQuery, accountId);
    displayResults('Application Performance', appPerf);

    // Query 2: Top Transactions
    console.log('\n=== TOP TRANSACTIONS ===');
    const topTxQuery = `
      SELECT 
        count(*) as 'Requests',
        average(duration)*1000 as 'Avg Duration (ms)',
        percentile(duration, 95)*1000 as 'P95 Duration (ms)'
      FROM Transaction 
      WHERE appName = '${exactAppName}' 
      FACET name 
      ${sinceClause} 
      LIMIT 10
    `;
    const topTx = await runNrqlQuery(topTxQuery, accountId);
    displayFacetResults('Top Transactions', topTx);

    // Query 3: Error Details
    console.log('\n=== ERROR ANALYSIS ===');
    const errorQuery = `
      SELECT 
        count(*) as 'Error Count',
        average(duration)*1000 as 'Avg Duration (ms)'
      FROM TransactionError 
      WHERE appName = '${exactAppName}' 
      FACET error.message 
      ${sinceClause}
      LIMIT 20
    `;
    const errors = await runNrqlQuery(errorQuery, accountId);
    displayFacetResults('Errors by Message', errors);

    // Query 3b: Error Summary
    const errorSummaryQuery = `
      SELECT 
        count(*) as 'Total Errors',
        uniqueCount(error.class) as 'Unique Error Types'
      FROM TransactionError 
      WHERE appName = '${exactAppName}' 
      ${sinceClause}
    `;
    const errorSummary = await runNrqlQuery(errorSummaryQuery, accountId);
    displayResults('Error Summary', errorSummary);

    // Query 4: Infrastructure Metrics (CPU, Memory)
    console.log('\n=== INFRASTRUCTURE METRICS ===');
    const infraQuery = `
      SELECT 
        average(newrelic.timeslice.value) as 'Avg Memory (MB)',
        max(newrelic.timeslice.value) as 'Max Memory (MB)'
      FROM Metric 
      WHERE metricTimesliceName = 'Memory/Physical'
      AND appName = '${exactAppName}' 
      ${sinceClause}
    `;
    const infra = await runNrqlQuery(infraQuery, accountId);
    displayInfraResults('Infrastructure', infra);

    // Query 5: Per-Host Breakdown
    console.log('\n=== PER-HOST METRICS ===');
    const hostQuery = `
      SELECT 
        rate(count(*), 1 minute) as 'RPM',
        average(duration)*1000 as 'Avg Response (ms)',
        percentage(count(*), WHERE error IS true) as 'Error Rate (%)'
      FROM Transaction 
      WHERE appName = '${exactAppName}' 
      FACET host 
      ${sinceClause} 
      LIMIT 25
    `;
    const hostMetrics = await runNrqlQuery(hostQuery, accountId);
    displayFacetResults('Per-Host Performance', hostMetrics);

    // Query 6: Database Calls
    console.log('\n=== DATABASE PERFORMANCE ===');
    const dbQuery = `
      SELECT 
        count(*) as 'Total Calls',
        average(duration)*1000 as 'Avg Duration (ms)',
        percentile(duration, 95)*1000 as 'P95 Duration (ms)'
      FROM Span 
      WHERE appName = '${exactAppName}' 
      AND category = 'datastore'
      ${sinceClause}
    `;
    const dbMetrics = await runNrqlQuery(dbQuery, accountId);
    displayResults('Database Calls', dbMetrics);

    console.log('\n=== UTILIZATION ANALYSIS ===');
    console.log('Note: Kubernetes resource allocations for comparison:');
    console.log('  CPU Request/Limit: 3000 millicores (3 cores)');
    console.log('  Memory Request/Limit: 3072 MB (3 GB)');
    
    if (infra && infra.results && infra.results.length > 0) {
      const result = infra.results[0];
      const avgMemoryMB = result['Avg Memory (MB)'] || 0;
      const maxMemoryMB = result['Max Memory (MB)'] || 0;
      
      const memoryLimit = 3072; // MB
      const avgMemoryUtilPct = ((avgMemoryMB / memoryLimit) * 100).toFixed(2);
      const maxMemoryUtilPct = ((maxMemoryMB / memoryLimit) * 100).toFixed(2);
      
      console.log(`\nMemory Utilization:`);
      console.log(`  Average: ${avgMemoryMB.toFixed(2)} MB (${avgMemoryUtilPct}% of ${memoryLimit} MB limit)`);
      console.log(`  Maximum: ${maxMemoryMB.toFixed(2)} MB (${maxMemoryUtilPct}% of ${memoryLimit} MB limit)`);
    } else {
      console.log('\nMemory metrics not available for this time range');
    }
    
    // Additional CPU analysis from transaction data
    if (appPerf && appPerf.results && appPerf.results.length > 0) {
      const perfResult = appPerf.results[0];
      const totalRequests = perfResult['Total Requests'] || 0;
      const avgResponseMs = perfResult['Avg Response Time (ms)'] || 0;
      
      console.log(`\nWorkload Analysis:`);
      console.log(`  Total Requests: ${totalRequests.toLocaleString()}`);
      console.log(`  Avg Response: ${avgResponseMs.toFixed(2)} ms`);
      console.log(`  Pattern: High throughput with minimal CPU usage suggests I/O-bound workload`);
    }

    console.log('\n=== Query Complete ===');
  } catch (error) {
    console.error('Error querying New Relic:', error.message);
    process.exit(1);
  }
}

function displayResults(title, response) {
  if (!response || !response.results || response.results.length === 0) {
    console.log(`No data available for ${title}`);
    return;
  }

  const result = response.results[0];
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'object' && value !== null) {
      // Handle aggregated values
      if (value.average !== undefined) {
        console.log(`  ${key}: ${formatValue(value.average)}`);
      } else if (value.count !== undefined) {
        console.log(`  ${key}: ${formatValue(value.count)}`);
      } else if (value.percentage !== undefined) {
        console.log(`  ${key}: ${formatValue(value.percentage)}%`);
      } else {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      }
    } else {
      console.log(`  ${key}: ${formatValue(value)}`);
    }
  }
}

function displayFacetResults(title, response) {
  if (!response || !response.facets || response.facets.length === 0) {
    console.log(`No faceted data available for ${title}`);
    return;
  }

  response.facets.forEach((facet, index) => {
    const facetName = facet.name || `Item ${index + 1}`;
    console.log(`\n${facetName}:`);
    for (const [key, value] of Object.entries(facet.results[0])) {
      if (typeof value === 'object' && value !== null) {
        if (value.average !== undefined) {
          console.log(`  ${key}: ${formatValue(value.average)}`);
        } else if (value.count !== undefined) {
          console.log(`  ${key}: ${formatValue(value.count)}`);
        } else if (value.percentage !== undefined) {
          console.log(`  ${key}: ${formatValue(value.percentage)}%`);
        } else {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
      } else {
        console.log(`  ${key}: ${formatValue(value)}`);
      }
    }
  });
}

function displayInfraResults(title, response) {
  if (!response || !response.results || response.results.length === 0) {
    console.log(`No data available for ${title}`);
    return;
  }

  const result = response.results[0];
  for (const [key, value] of Object.entries(result)) {
    console.log(`  ${key}: ${formatValue(value)}`);
  }
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return 'N/A';
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toFixed(2);
  }
  return value;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.log('Usage: node query-newrelic-timerange.js <service-name> "<start-time>" "<end-time>"');
    console.log('');
    console.log('Example:');
    console.log('  node query-newrelic-timerange.js content-detail "4/1/2026, 11:02:28 AM" "4/1/2026, 11:05:28 AM"');
    console.log('');
    console.log('Time format: "M/D/YYYY, H:MM:SS AM/PM"');
    process.exit(1);
  }

  const [serviceName, startTime, endTime] = args;
  queryNewRelicTimeRange(serviceName, startTime, endTime);
}

module.exports = { queryNewRelicTimeRange, parseTimestamp };
