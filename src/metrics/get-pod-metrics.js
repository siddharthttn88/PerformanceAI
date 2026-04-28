/**
 * Get infrastructure metrics for a specific service's pods
 */

const grafana = require('./grafana-reader.js');

async function getPodMetrics(serviceName, minutes = 5) {
    try {
        console.log(`Fetching metrics for ${serviceName} pods (last ${minutes} minutes)...\n`);
        
        const now = Math.floor(Date.now() / 1000);
        const start = now - (minutes * 60);
        
        // 1. Get pod information
        console.log('=== POD INFORMATION ===');
        const podInfo = await grafana.prometheusQuery(`kube_pod_info{pod=~"${serviceName}.*"}`);
        
        if (podInfo.data.result.length === 0) {
            console.log(`No pods found matching: ${serviceName}`);
            return;
        }
        
        console.log(`Found ${podInfo.data.result.length} pod(s):\n`);
        
        const pods = [];
        podInfo.data.result.forEach((result, index) => {
            const labels = result.metric;
            console.log(`Pod ${index + 1}:`);
            console.log(`  Name: ${labels.pod}`);
            console.log(`  Namespace: ${labels.namespace}`);
            console.log(`  Node: ${labels.node}`);
            console.log(`  Host IP: ${labels.host_ip}`);
            console.log(`  Pod IP: ${labels.pod_ip}`);
            console.log(`  Created by: ${labels.created_by_kind}/${labels.created_by_name}`);
            if (labels.priority_class) console.log(`  Priority Class: ${labels.priority_class}`);
            console.log('');
            pods.push({ name: labels.pod, namespace: labels.namespace });
        });
        
        // 2. Get CPU usage (current)
        console.log('\n=== CPU USAGE (Current) ===');
        const cpuQuery = `sum(rate(container_cpu_usage_seconds_total{pod=~"${serviceName}.*", container!="", image!=""}[5m])) by (pod, container)`;
        const cpuUsage = await grafana.prometheusQuery(cpuQuery);
        
        if (cpuUsage.data.result.length > 0) {
            cpuUsage.data.result.forEach(result => {
                const cpuCores = parseFloat(result.value[1]);
                console.log(`  ${result.metric.pod} (${result.metric.container}): ${(cpuCores * 1000).toFixed(2)} millicores`);
            });
        } else {
            console.log('  No CPU data available');
        }
        
        // 3. Get memory usage (current)
        console.log('\n=== MEMORY USAGE (Current) ===');
        const memQuery = `sum(container_memory_working_set_bytes{pod=~"${serviceName}.*", container!="", image!=""}) by (pod, container)`;
        const memUsage = await grafana.prometheusQuery(memQuery);
        
        if (memUsage.data.result.length > 0) {
            memUsage.data.result.forEach(result => {
                const memBytes = parseFloat(result.value[1]);
                const memMB = (memBytes / 1024 / 1024).toFixed(2);
                console.log(`  ${result.metric.pod} (${result.metric.container}): ${memMB} MB`);
            });
        } else {
            console.log('  No memory data available');
        }
        
        // 4. Get resource requests and limits
        console.log('\n=== RESOURCE REQUESTS & LIMITS ===');
        const reqCpuQuery = `kube_pod_container_resource_requests{pod=~"${serviceName}.*", resource="cpu"}`;
        const reqCpu = await grafana.prometheusQuery(reqCpuQuery);
        
        const limCpuQuery = `kube_pod_container_resource_limits{pod=~"${serviceName}.*", resource="cpu"}`;
        const limCpu = await grafana.prometheusQuery(limCpuQuery);
        
        const reqMemQuery = `kube_pod_container_resource_requests{pod=~"${serviceName}.*", resource="memory"}`;
        const reqMem = await grafana.prometheusQuery(reqMemQuery);
        
        const limMemQuery = `kube_pod_container_resource_limits{pod=~"${serviceName}.*", resource="memory"}`;
        const limMem = await grafana.prometheusQuery(limMemQuery);
        
        console.log('CPU Requests:');
        if (reqCpu.data.result.length > 0) {
            reqCpu.data.result.forEach(result => {
                const cpuCores = parseFloat(result.value[1]);
                console.log(`  ${result.metric.pod} (${result.metric.container}): ${(cpuCores * 1000).toFixed(0)} millicores`);
            });
        } else {
            console.log('  No data');
        }
        
        console.log('\nCPU Limits:');
        if (limCpu.data.result.length > 0) {
            limCpu.data.result.forEach(result => {
                const cpuCores = parseFloat(result.value[1]);
                console.log(`  ${result.metric.pod} (${result.metric.container}): ${(cpuCores * 1000).toFixed(0)} millicores`);
            });
        } else {
            console.log('  No data');
        }
        
        console.log('\nMemory Requests:');
        if (reqMem.data.result.length > 0) {
            reqMem.data.result.forEach(result => {
                const memBytes = parseFloat(result.value[1]);
                const memMB = (memBytes / 1024 / 1024).toFixed(2);
                console.log(`  ${result.metric.pod} (${result.metric.container}): ${memMB} MB`);
            });
        } else {
            console.log('  No data');
        }
        
        console.log('\nMemory Limits:');
        if (limMem.data.result.length > 0) {
            limMem.data.result.forEach(result => {
                const memBytes = parseFloat(result.value[1]);
                const memMB = (memBytes / 1024 / 1024).toFixed(2);
                console.log(`  ${result.metric.pod} (${result.metric.container}): ${memMB} MB`);
            });
        } else {
            console.log('  No data');
        }
        
        // 5. Get pod status
        console.log('\n=== POD STATUS ===');
        const statusQuery = `kube_pod_status_phase{pod=~"${serviceName}.*"}`;
        const status = await grafana.prometheusQuery(statusQuery);
        
        if (status.data.result.length > 0) {
            status.data.result.forEach(result => {
                const phase = result.metric.phase;
                const value = result.value[1];
                if (value === '1') {
                    console.log(`  ${result.metric.pod}: ${phase}`);
                }
            });
        }
        
        // 6. Get container restarts
        console.log('\n=== CONTAINER RESTARTS (Last 5 minutes) ===');
        const restartsQuery = `sum(increase(kube_pod_container_status_restarts_total{pod=~"${serviceName}.*"}[${minutes}m])) by (pod, container)`;
        const restarts = await grafana.prometheusQuery(restartsQuery);
        
        if (restarts.data.result.length > 0) {
            let hasRestarts = false;
            restarts.data.result.forEach(result => {
                const count = parseFloat(result.value[1]);
                if (count > 0) {
                    hasRestarts = true;
                    console.log(`  ${result.metric.pod} (${result.metric.container}): ${count} restart(s)`);
                }
            });
            if (!hasRestarts) {
                console.log('  No restarts in the last 5 minutes');
            }
        } else {
            console.log('  No restart data available');
        }
        
        // 7. Get network I/O (if available)
        console.log('\n=== NETWORK I/O (Rate over 5m) ===');
        const netRxQuery = `sum(rate(container_network_receive_bytes_total{pod=~"${serviceName}.*"}[5m])) by (pod)`;
        const netTxQuery = `sum(rate(container_network_transmit_bytes_total{pod=~"${serviceName}.*"}[5m])) by (pod)`;
        
        const netRx = await grafana.prometheusQuery(netRxQuery);
        const netTx = await grafana.prometheusQuery(netTxQuery);
        
        if (netRx.data.result.length > 0 || netTx.data.result.length > 0) {
            const networkData = {};
            
            netRx.data.result.forEach(result => {
                const pod = result.metric.pod;
                const rxBytesPerSec = parseFloat(result.value[1]);
                networkData[pod] = networkData[pod] || {};
                networkData[pod].rx = rxBytesPerSec;
            });
            
            netTx.data.result.forEach(result => {
                const pod = result.metric.pod;
                const txBytesPerSec = parseFloat(result.value[1]);
                networkData[pod] = networkData[pod] || {};
                networkData[pod].tx = txBytesPerSec;
            });
            
            Object.keys(networkData).forEach(pod => {
                const rx = (networkData[pod].rx || 0) / 1024;
                const tx = (networkData[pod].tx || 0) / 1024;
                console.log(`  ${pod}:`);
                console.log(`    RX: ${rx.toFixed(2)} KB/s`);
                console.log(`    TX: ${tx.toFixed(2)} KB/s`);
            });
        } else {
            console.log('  No network data available');
        }
        
        console.log('\n=== Summary Complete ===');
        
    } catch (error) {
        console.error('Error fetching metrics:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    const serviceName = process.argv[2] || 'subscriber-event-service';
    const minutes = parseInt(process.argv[3]) || 5;
    
    getPodMetrics(serviceName, minutes);
}

module.exports = { getPodMetrics };
