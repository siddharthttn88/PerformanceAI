/**
 * Query metrics for a specific time range
 */

const grafana = require('../clients/grafana-reader.js');

// Parse date string in format: "31/3/2026, 3:50:20 pm"
function parseTimestamp(dateStr) {
    // Handle formats like "31/3/2026, 3:50:20 pm"
    const match = dateStr.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)\s*(am|pm)?/i);
    if (!match) {
        throw new Error(`Invalid date format: ${dateStr}`);
    }
    
    const [, day, month, year, hour, minute, second, period] = match;
    let hours = parseInt(hour);
    
    if (period && period.toLowerCase() === 'pm' && hours !== 12) {
        hours += 12;
    } else if (period && period.toLowerCase() === 'am' && hours === 12) {
        hours = 0;
    }
    
    const date = new Date(year, month - 1, day, hours, minute, second);
    return Math.floor(date.getTime() / 1000);
}

async function queryTimeRange(serviceName, startStr, endStr) {
    try {
        const start = parseTimestamp(startStr);
        const end = parseTimestamp(endStr);
        const duration = end - start;
        
        console.log(`\n=== Querying metrics for ${serviceName} ===`);
        console.log(`Time Range: ${new Date(start * 1000).toLocaleString()} to ${new Date(end * 1000).toLocaleString()}`);
        console.log(`Duration: ${duration} seconds (${Math.floor(duration / 60)} minutes)\n`);
        
        // Query CPU usage during this time
        console.log('=== CPU Usage (Rate over time) ===');
        const cpuQuery = `sum(rate(container_cpu_usage_seconds_total{pod=~"${serviceName}.*", container!="", image!=""}[1m])) by (pod)`;
        const cpuResult = await grafana.prometheusQueryRange(cpuQuery, start, end, '15s');
        
        if (cpuResult.data.result && cpuResult.data.result.length > 0) {
            cpuResult.data.result.forEach(series => {
                const pod = series.metric.pod;
                console.log(`\n  Pod: ${pod}`);
                
                // Show first, middle, and last values
                const values = series.values;
                if (values.length > 0) {
                    const firstVal = parseFloat(values[0][1]) * 1000; // Convert to millicores
                    const midVal = values.length > 1 ? parseFloat(values[Math.floor(values.length/2)][1]) * 1000 : firstVal;
                    const lastVal = parseFloat(values[values.length-1][1]) * 1000;
                    
                    console.log(`    Start: ${firstVal.toFixed(2)} millicores at ${new Date(values[0][0] * 1000).toLocaleTimeString()}`);
                    if (values.length > 2) {
                        console.log(`    Mid:   ${midVal.toFixed(2)} millicores at ${new Date(values[Math.floor(values.length/2)][0] * 1000).toLocaleTimeString()}`);
                    }
                    console.log(`    End:   ${lastVal.toFixed(2)} millicores at ${new Date(values[values.length-1][0] * 1000).toLocaleTimeString()}`);
                    console.log(`    Avg:   ${(values.reduce((sum, v) => sum + parseFloat(v[1]), 0) / values.length * 1000).toFixed(2)} millicores`);
                }
            });
        } else {
            console.log('  No CPU data available for this time range');
        }
        
        // Query Memory usage during this time
        console.log('\n\n=== Memory Usage (Working Set) ===');
        const memQuery = `sum(container_memory_working_set_bytes{pod=~"${serviceName}.*", container!="", image!=""}) by (pod)`;
        const memResult = await grafana.prometheusQueryRange(memQuery, start, end, '15s');
        
        if (memResult.data.result && memResult.data.result.length > 0) {
            memResult.data.result.forEach(series => {
                const pod = series.metric.pod;
                console.log(`\n  Pod: ${pod}`);
                
                const values = series.values;
                if (values.length > 0) {
                    const firstVal = parseFloat(values[0][1]) / 1024 / 1024; // Convert to MB
                    const midVal = values.length > 1 ? parseFloat(values[Math.floor(values.length/2)][1]) / 1024 / 1024 : firstVal;
                    const lastVal = parseFloat(values[values.length-1][1]) / 1024 / 1024;
                    
                    console.log(`    Start: ${firstVal.toFixed(2)} MB at ${new Date(values[0][0] * 1000).toLocaleTimeString()}`);
                    if (values.length > 2) {
                        console.log(`    Mid:   ${midVal.toFixed(2)} MB at ${new Date(values[Math.floor(values.length/2)][0] * 1000).toLocaleTimeString()}`);
                    }
                    console.log(`    End:   ${lastVal.toFixed(2)} MB at ${new Date(values[values.length-1][0] * 1000).toLocaleTimeString()}`);
                    console.log(`    Avg:   ${(values.reduce((sum, v) => sum + parseFloat(v[1]), 0) / values.length / 1024 / 1024).toFixed(2)} MB`);
                }
            });
        } else {
            console.log('  No memory data available for this time range');
        }
        
        // Query pod restarts during this time
        console.log('\n\n=== Container Restarts (During time range) ===');
        const restartQuery = `increase(kube_pod_container_status_restarts_total{pod=~"${serviceName}.*"}[${duration}s])`;
        const restartResult = await grafana.prometheusQuery(restartQuery, end);
        
        if (restartResult.data.result && restartResult.data.result.length > 0) {
            let hasRestarts = false;
            restartResult.data.result.forEach(result => {
                const restarts = parseFloat(result.value[1]);
                if (restarts > 0) {
                    hasRestarts = true;
                    console.log(`  ${result.metric.pod} (${result.metric.container}): ${restarts} restart(s)`);
                }
            });
            if (!hasRestarts) {
                console.log('  No restarts during this time range');
            }
        } else {
            console.log('  No restart data available');
        }
        
        // Query network I/O during this time
        console.log('\n\n=== Network I/O (Average during time range) ===');
        const netRxQuery = `sum(rate(container_network_receive_bytes_total{pod=~"${serviceName}.*"}[1m])) by (pod)`;
        const netTxQuery = `sum(rate(container_network_transmit_bytes_total{pod=~"${serviceName}.*"}[1m])) by (pod)`;
        
        const netRxResult = await grafana.prometheusQueryRange(netRxQuery, start, end, '30s');
        const netTxResult = await grafana.prometheusQueryRange(netTxQuery, start, end, '30s');
        
        const networkData = {};
        
        if (netRxResult.data.result) {
            netRxResult.data.result.forEach(series => {
                const pod = series.metric.pod;
                const avgRx = series.values.reduce((sum, v) => sum + parseFloat(v[1]), 0) / series.values.length;
                networkData[pod] = { rx: avgRx };
            });
        }
        
        if (netTxResult.data.result) {
            netTxResult.data.result.forEach(series => {
                const pod = series.metric.pod;
                const avgTx = series.values.reduce((sum, v) => sum + parseFloat(v[1]), 0) / series.values.length;
                if (!networkData[pod]) networkData[pod] = {};
                networkData[pod].tx = avgTx;
            });
        }
        
        if (Object.keys(networkData).length > 0) {
            Object.keys(networkData).forEach(pod => {
                const rx = (networkData[pod].rx || 0) / 1024;
                const tx = (networkData[pod].tx || 0) / 1024;
                console.log(`  ${pod}:`);
                console.log(`    RX: ${rx.toFixed(2)} KB/s`);
                console.log(`    TX: ${tx.toFixed(2)} KB/s`);
            });
        } else {
            console.log('  No network data available for this time range');
        }
        
        console.log('\n=== Query Complete ===\n');
        
    } catch (error) {
        console.error('Error querying time range:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const serviceName = process.argv[2];
    const startTime = process.argv[3];
    const endTime = process.argv[4];
    
    if (!serviceName || !startTime || !endTime) {
        console.log('Usage: node query-timerange.js <service-name> "<start-time>" "<end-time>"');
        console.log('');
        console.log('Time format: "DD/M/YYYY, H:MM:SS am/pm" or "DD/M/YYYY, H:MM:SS"');
        console.log('');
        console.log('Example:');
        console.log('  node query-timerange.js subscriber-event-service "31/3/2026, 3:50:20 pm" "31/3/2026, 3:53:20 pm"');
        process.exit(1);
    }
    
    queryTimeRange(serviceName, startTime, endTime);
}

module.exports = { queryTimeRange, parseTimestamp };
