/**
 * Enhanced Pod Metrics Collection with Exact Timestamps and Max Metrics
 * 
 * Usage:
 *   node get-pod-metrics-enhanced.js <service-name> <start-epoch> <end-epoch>
 *   OR
 *   node get-pod-metrics-enhanced.js <service-name> <minutes> (uses current time)
 */

const grafana = require('./grafana-reader.js');

async function getPodMetricsEnhanced(serviceName, startEpoch, endEpoch) {
    try {
        const duration = endEpoch - startEpoch;
        const durationMinutes = Math.ceil(duration / 60);
        
        console.log(`Fetching metrics for ${serviceName} pods`);
        console.log(`Time Range: ${new Date(startEpoch * 1000).toISOString()} to ${new Date(endEpoch * 1000).toISOString()}`);
        console.log(`Duration: ${durationMinutes} minutes\n`);
        
        // 1. Get pod information
        console.log('=== POD INFORMATION ===');
        const podInfo = await grafana.prometheusQuery(`kube_pod_info{pod=~"${serviceName}.*"}`);
        
        if (podInfo.data.result.length === 0) {
            console.log(`No pods found matching: ${serviceName}`);
            return null;
        }
        
        console.log(`Found ${podInfo.data.result.length} pod(s)\n`);
        
        const pods = podInfo.data.result.map(result => ({
            name: result.metric.pod,
            namespace: result.metric.namespace,
            node: result.metric.node
        }));
        
        // 2. Get CPU usage statistics (AVG and MAX over the test period)
        console.log('=== CPU USAGE STATISTICS ===');
        
        // Get resource limits first (fixed to use container!="" filter)
        const limCpuQuery = `max(kube_pod_container_resource_limits{pod=~"${serviceName}.*", resource="cpu", container!="POD", container!=""}) by (pod)`;
        const limCpu = await grafana.prometheusQuery(limCpuQuery);
        
        const cpuLimits = {};
        if (limCpu.data && limCpu.data.result) {
            limCpu.data.result.forEach(result => {
                const pod = result.metric.pod;
                const cpuCores = parseFloat(result.value[1]);
                cpuLimits[pod] = cpuCores;
            });
        }
        
        // Average CPU usage over the period
        const cpuAvgQuery = `avg_over_time(
            sum(rate(container_cpu_usage_seconds_total{pod=~"${serviceName}.*", container!="", image!=""}[1m])) by (pod)[${durationMinutes}m:30s]
        )`;
        const cpuAvg = await grafana.prometheusQueryRange(cpuAvgQuery, startEpoch, endEpoch, '30s');
        
        // Maximum CPU usage over the period  
        const cpuMaxQuery = `max_over_time(
            sum(rate(container_cpu_usage_seconds_total{pod=~"${serviceName}.*", container!="", image!=""}[1m])) by (pod)[${durationMinutes}m:30s]
        )`;
        const cpuMax = await grafana.prometheusQueryRange(cpuMaxQuery, startEpoch, endEpoch, '30s');
        
        const cpuStats = {};
        
        // Process AVG CPU
        if (cpuAvg.data.result) {
            cpuAvg.data.result.forEach(result => {
                const pod = result.metric.pod;
                const values = result.values || [];
                if (values.length > 0) {
                    const avgValue = values.reduce((sum, v) => sum + parseFloat(v[1]), 0) / values.length;
                    cpuStats[pod] = cpuStats[pod] || {};
                    cpuStats[pod].avg = avgValue;
                }
            });
        }
        
        // Process MAX CPU
        if (cpuMax.data.result) {
            cpuMax.data.result.forEach(result => {
                const pod = result.metric.pod;
                const values = result.values || [];
                if (values.length > 0) {
                    const maxValue = Math.max(...values.map(v => parseFloat(v[1])));
                    cpuStats[pod] = cpuStats[pod] || {};
                    cpuStats[pod].max = maxValue;
                }
            });
        }
        
        console.log('Per-Pod CPU Statistics:');
        let totalCpuAvg = 0, totalCpuMax = 0, podCount = 0;
        
        Object.keys(cpuStats).sort().forEach(pod => {
            const stats = cpuStats[pod];
            const limit = cpuLimits[pod] || 0;
            const avgMillicores = (stats.avg || 0) * 1000;
            const maxMillicores = (stats.max || 0) * 1000;
            const avgPct = limit > 0 ? ((stats.avg || 0) / limit * 100) : 0;
            const maxPct = limit > 0 ? ((stats.max || 0) / limit * 100) : 0;
            
            console.log(`\n  ${pod}:`);
            console.log(`    Limit:   ${(limit * 1000).toFixed(0)} millicores (${limit.toFixed(2)} cores)`);
            console.log(`    AVG CPU: ${avgMillicores.toFixed(2)} millicores (${avgPct.toFixed(1)}% of limit)`);
            console.log(`    MAX CPU: ${maxMillicores.toFixed(2)} millicores (${maxPct.toFixed(1)}% of limit)`);
            
            if (stats.avg) { totalCpuAvg += stats.avg; podCount++; }
            if (stats.max) totalCpuMax = Math.max(totalCpuMax, stats.max);
        });
        
        const avgCpuUtilization = podCount > 0 && Object.values(cpuLimits)[0] > 0 
            ? (totalCpuAvg / podCount) / Object.values(cpuLimits)[0] * 100 
            : 0;
        const maxCpuUtilization = Object.values(cpuLimits)[0] > 0 
            ? totalCpuMax / Object.values(cpuLimits)[0] * 100 
            : 0;
        
        console.log(`\nOverall CPU Summary:`);
        console.log(`  AVG Utilization: ${avgCpuUtilization.toFixed(1)}%`);
        console.log(`  MAX Utilization: ${maxCpuUtilization.toFixed(1)}%`);
        
        // 3. Get Memory usage statistics (AVG and MAX)
        console.log('\n=== MEMORY USAGE STATISTICS ===');
        
        // Get memory limits first (fixed to use container!="" filter)
        const limMemQuery = `max(kube_pod_container_resource_limits{pod=~"${serviceName}.*", resource="memory", container!="POD", container!=""}) by (pod)`;
        const limMem = await grafana.prometheusQuery(limMemQuery);
        
        const memLimits = {};
        if (limMem.data && limMem.data.result) {
            limMem.data.result.forEach(result => {
                const pod = result.metric.pod;
                const memBytes = parseFloat(result.value[1]);
                memLimits[pod] = memBytes;
            });
        }
        
        // Average memory usage
        const memAvgQuery = `avg_over_time(
            sum(container_memory_working_set_bytes{pod=~"${serviceName}.*", container!="", image!=""}) by (pod)[${durationMinutes}m:30s]
        )`;
        const memAvg = await grafana.prometheusQueryRange(memAvgQuery, startEpoch, endEpoch, '30s');
        
        // Maximum memory usage
        const memMaxQuery = `max_over_time(
            sum(container_memory_working_set_bytes{pod=~"${serviceName}.*", container!="", image!=""}) by (pod)[${durationMinutes}m:30s]
        )`;
        const memMax = await grafana.prometheusQueryRange(memMaxQuery, startEpoch, endEpoch, '30s');
        
        const memStats = {};
        
        // Process AVG Memory
        if (memAvg.data.result) {
            memAvg.data.result.forEach(result => {
                const pod = result.metric.pod;
                const values = result.values || [];
                if (values.length > 0) {
                    const avgValue = values.reduce((sum, v) => sum + parseFloat(v[1]), 0) / values.length;
                    memStats[pod] = memStats[pod] || {};
                    memStats[pod].avg = avgValue;
                }
            });
        }
        
        // Process MAX Memory
        if (memMax.data.result) {
            memMax.data.result.forEach(result => {
                const pod = result.metric.pod;
                const values = result.values || [];
                if (values.length > 0) {
                    const maxValue = Math.max(...values.map(v => parseFloat(v[1])));
                    memStats[pod] = memStats[pod] || {};
                    memStats[pod].max = maxValue;
                }
            });
        }
        
        console.log('Per-Pod Memory Statistics:');
        let totalMemAvg = 0, totalMemMax = 0;
        
        Object.keys(memStats).sort().forEach(pod => {
            const stats = memStats[pod];
            const limit = memLimits[pod] || 0;
            const avgMB = (stats.avg || 0) / 1024 / 1024;
            const maxMB = (stats.max || 0) / 1024 / 1024;
            const limitMB = limit / 1024 / 1024;
            const avgPct = limit > 0 ? ((stats.avg || 0) / limit * 100) : 0;
            const maxPct = limit > 0 ? ((stats.max || 0) / limit * 100) : 0;
            
            console.log(`\n  ${pod}:`);
            console.log(`    Limit:      ${limitMB.toFixed(0)} MB`);
            console.log(`    AVG Memory: ${avgMB.toFixed(2)} MB (${avgPct.toFixed(1)}% of limit)`);
            console.log(`    MAX Memory: ${maxMB.toFixed(2)} MB (${maxPct.toFixed(1)}% of limit)`);
            
            if (stats.avg) totalMemAvg += stats.avg;
            if (stats.max) totalMemMax = Math.max(totalMemMax, stats.max);
        });
        
        const avgMemUtilization = podCount > 0 && Object.values(memLimits)[0] > 0 
            ? (totalMemAvg / podCount) / Object.values(memLimits)[0] * 100 
            : 0;
        const maxMemUtilization = Object.values(memLimits)[0] > 0 
            ? totalMemMax / Object.values(memLimits)[0] * 100 
            : 0;
        
        console.log(`\nOverall Memory Summary:`);
        console.log(`  AVG Utilization: ${avgMemUtilization.toFixed(1)}%`);
        console.log(`  MAX Utilization: ${maxMemUtilization.toFixed(1)}%`);
        
        // 4. Check for pod restarts during the period
        console.log('\n=== POD RESTARTS ===');
        const restartsQuery = `sum(increase(kube_pod_container_status_restarts_total{pod=~"${serviceName}.*"}[${durationMinutes}m])) by (pod, container)`;
        const restarts = await grafana.prometheusQuery(restartsQuery);
        
        let hasRestarts = false;
        if (restarts.data.result && restarts.data.result.length > 0) {
            restarts.data.result.forEach(result => {
                const count = parseFloat(result.value[1]);
                if (count > 0) {
                    hasRestarts = true;
                    console.log(`  ${result.metric.pod} (${result.metric.container}): ${count} restart(s)`);
                }
            });
        }
        if (!hasRestarts) {
            console.log('  No restarts detected during test period');
        }
        
        console.log('\n=== SUMMARY ===');
        const result = {
            podCount: pods.length,
            cpu: {
                avgUtilization: avgCpuUtilization.toFixed(1),
                maxUtilization: maxCpuUtilization.toFixed(1),
                limit: Object.values(cpuLimits)[0]
            },
            memory: {
                avgUtilization: avgMemUtilization.toFixed(1),
                maxUtilization: maxMemUtilization.toFixed(1),
                limit: Object.values(memLimits)[0] / 1024 / 1024
            },
            podRestarts: hasRestarts
        };
        
        console.log(`Pods: ${result.podCount}`);
        console.log(`CPU: ${result.cpu.avgUtilization}% avg, ${result.cpu.maxUtilization}% max`);
        console.log(`Memory: ${result.memory.avgUtilization}% avg, ${result.memory.maxUtilization}% max`);
        console.log(`Pod Restarts: ${result.podRestarts ? 'YES' : 'NO'}`);
        
        return result;
        
    } catch (error) {
        console.error('Error fetching metrics:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const serviceName = process.argv[2];
    const arg2 = parseInt(process.argv[3]);
    const arg3 = parseInt(process.argv[4]);
    
    if (!serviceName) {
        console.log('Usage:');
        console.log('  node get-pod-metrics-enhanced.js <service-name> <start-epoch> <end-epoch>');
        console.log('  OR');
        console.log('  node get-pod-metrics-enhanced.js <service-name> <minutes>');
        console.log('');
        console.log('Examples:');
        console.log('  node get-pod-metrics-enhanced.js subscriber-event-service 1776753979 1776754339');
        console.log('  node get-pod-metrics-enhanced.js subscriber-event-service 5');
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
    
    getPodMetricsEnhanced(serviceName, startEpoch, endEpoch);
}

module.exports = { getPodMetricsEnhanced };
