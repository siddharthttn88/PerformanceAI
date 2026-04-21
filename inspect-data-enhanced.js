#!/usr/bin/env node

const fs = require('fs');

const htmlFile = process.argv[2] || 'D:\\PerformanceAI\\Reports\\result.html';
const outputFormat = process.argv[3] || 'text'; // 'text' or 'json'

const content = fs.readFileSync(htmlFile, 'utf8');
const idx = content.indexOf('window.templateArgs =');

if (idx === -1) {
  console.error('ERROR: templateArgs not found');
  process.exit(1);
}

const chunk = content.substring(idx + 'window.templateArgs ='.length).trim();

let depth = 0, end = 0, inString = false, escape = false;
for (let i = 0; i < chunk.length; i++) {
  const c = chunk[i];
  
  if (escape) {
    escape = false;
    continue;
  }
  
  if (c === '\\' && inString) {
    escape = true;
    continue;
  }
  
  if (c === '"' && !escape) {
    inString = !inString;
    continue;
  }
  
  if (!inString) {
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
}

const jsonStr = chunk.substring(0, end);
const data = JSON.parse(jsonStr);

// Parse duration to seconds
function parseDurationToSeconds(durationStr) {
    if (typeof durationStr === 'number') {
        return durationStr;
    }
    
    const minutesMatch = durationStr.match(/(\d+)\s*minute/);
    const secondsMatch = durationStr.match(/(\d+)\s*second/);
    
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    const seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;
    
    return minutes * 60 + seconds;
}

// Calculate metrics timerange with 1 minute buffer
const durationSeconds = parseDurationToSeconds(data.duration);
const startTime = new Date(data.start_time);
const endTime = new Date(data.end_time);
const bufferEndTime = new Date(endTime.getTime() + 60 * 1000); // Add 1 minute buffer

// Extract failure status codes
const failureStatusCodes = {};
if (data.failures_statistics && Array.isArray(data.failures_statistics)) {
    data.failures_statistics.forEach(failure => {
        // Extract status code from error string like "LocustBadStatusCode(code=400)"
        const match = failure.error.match(/code=(\d+)/);
        if (match) {
            const statusCode = match[1];
            if (!failureStatusCodes[statusCode]) {
                failureStatusCodes[statusCode] = {
                    code: statusCode,
                    count: 0,
                    endpoints: []
                };
            }
            failureStatusCodes[statusCode].count += failure.occurrences;
            failureStatusCodes[statusCode].endpoints.push({
                method: failure.method,
                name: failure.name,
                count: failure.occurrences
            });
        }
    });
}

// Get aggregated stats
const agg = data.requests_statistics.find(s => s.name === 'Aggregated');

// Sort endpoints by response time (descending) and get top 5
const sortedByResponseTime = [...data.requests_statistics]
    .filter(s => s.name !== 'Aggregated')
    .sort((a, b) => b.avg_response_time - a.avg_response_time)
    .slice(0, 5);

// Sort endpoints by failure percentage (descending) and get top 5
const sortedByFailureRate = [...data.requests_statistics]
    .filter(s => s.name !== 'Aggregated' && s.num_requests > 0)
    .map(s => ({
        ...s,
        failure_rate: (s.num_failures / s.num_requests) * 100
    }))
    .sort((a, b) => b.failure_rate - a.failure_rate)
    .slice(0, 5);

const result = {
    timestamps: {
        start: data.start_time,
        end: data.end_time,
        startISO: startTime.toISOString(),
        endISO: endTime.toISOString(),
        bufferEndISO: bufferEndTime.toISOString(),
        startEpoch: Math.floor(startTime.getTime() / 1000),
        endEpoch: Math.floor(endTime.getTime() / 1000),
        bufferEndEpoch: Math.floor(bufferEndTime.getTime() / 1000)
    },
    duration: {
        string: data.duration,
        seconds: durationSeconds,
        secondsWithBuffer: durationSeconds + 60
    },
    aggregated: agg ? {
        requests: agg.num_requests,
        failures: agg.num_failures,
        failure_percentage: ((agg.num_failures / agg.num_requests) * 100).toFixed(2),
        avg_response_time: agg.avg_response_time,
        min_response_time: agg.min_response_time,
        max_response_time: agg.max_response_time,
        total_rps: agg.total_rps
    } : null,
    failureStatusCodes: Object.values(failureStatusCodes).sort((a, b) => b.count - a.count),
    top5SlowestEndpoints: sortedByResponseTime.map(s => ({
        method: s.method,
        name: s.name,
        avg_response_time: s.avg_response_time,
        num_requests: s.num_requests,
        num_failures: s.num_failures,
        failure_rate: ((s.num_failures / s.num_requests) * 100).toFixed(2)
    })),
    top5HighestFailureEndpoints: sortedByFailureRate.map(s => ({
        method: s.method,
        name: s.name,
        avg_response_time: s.avg_response_time,
        num_requests: s.num_requests,
        num_failures: s.num_failures,
        failure_rate: s.failure_rate.toFixed(2)
    })),
    host: data.host,
    user_count: data.user_count
};

if (outputFormat === 'json') {
    console.log(JSON.stringify(result, null, 2));
} else {
    console.log('=== TEST TIMESTAMPS ===');
    console.log(`Start Time: ${result.timestamps.startISO}`);
    console.log(`End Time:   ${result.timestamps.endISO}`);
    console.log(`Buffer End: ${result.timestamps.bufferEndISO} (includes 1-minute buffer)`);
    console.log(`\nEpoch Timestamps:`);
    console.log(`Start:      ${result.timestamps.startEpoch}`);
    console.log(`End:        ${result.timestamps.endEpoch}`);
    console.log(`Buffer End: ${result.timestamps.bufferEndEpoch}`);
    
    console.log('\n=== DURATION ===');
    console.log(`String:           ${result.duration.string}`);
    console.log(`Seconds:          ${result.duration.seconds}s`);
    console.log(`With Buffer:      ${result.duration.secondsWithBuffer}s (includes 1-minute)`);
    
    console.log('\n=== AGGREGATED STATS ===');
    if (result.aggregated) {
        console.log(`Total Requests:   ${result.aggregated.requests.toLocaleString()}`);
        console.log(`Total Failures:   ${result.aggregated.failures.toLocaleString()} (${result.aggregated.failure_percentage}%)`);
        console.log(`Avg Response:     ${result.aggregated.avg_response_time.toFixed(2)} ms`);
        console.log(`Min Response:     ${result.aggregated.min_response_time} ms`);
        console.log(`Max Response:     ${result.aggregated.max_response_time.toLocaleString()} ms`);
        console.log(`Total RPS:        ${result.aggregated.total_rps.toFixed(2)}`);
    }
    
    console.log('\n=== FAILURE STATUS CODES ===');
    if (result.failureStatusCodes.length > 0) {
        result.failureStatusCodes.forEach(fc => {
            console.log(`\nStatus ${fc.code}: ${fc.count.toLocaleString()} failures`);
            fc.endpoints.forEach(ep => {
                console.log(`  - ${ep.method} ${ep.name}: ${ep.count.toLocaleString()} times`);
            });
        });
    } else {
        console.log('No status code failures detected');
    }
    
    console.log('\n=== TOP 5 SLOWEST ENDPOINTS ===');
    result.top5SlowestEndpoints.forEach((ep, idx) => {
        console.log(`${idx + 1}. ${ep.method} ${ep.name}`);
        console.log(`   Avg Response: ${ep.avg_response_time.toFixed(2)} ms`);
        console.log(`   Requests: ${ep.num_requests.toLocaleString()}, Failures: ${ep.num_failures.toLocaleString()} (${ep.failure_rate}%)`);
    });
    
    console.log('\n=== TOP 5 HIGHEST FAILURE RATE ENDPOINTS ===');
    result.top5HighestFailureEndpoints.forEach((ep, idx) => {
        console.log(`${idx + 1}. ${ep.method} ${ep.name}`);
        console.log(`   Failure Rate: ${ep.failure_rate}%`);
        console.log(`   Requests: ${ep.num_requests.toLocaleString()}, Failures: ${ep.num_failures.toLocaleString()}`);
        console.log(`   Avg Response: ${ep.avg_response_time.toFixed(2)} ms`);
    });
}
