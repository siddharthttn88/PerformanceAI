const fs = require('fs');

const html = fs.readFileSync('Reports/result.html', 'utf8');

console.log('HTML file size:', (html.length / 1024).toFixed(2), 'KB');
console.log('\nExtracting templateArgs...\n');

// Find window.templateArgs with better regex
const startMatch = html.match(/window\.templateArgs\s*=\s*/);
if (startMatch) {
    console.log('✅ Found window.templateArgs declaration');
    
    const startIdx = html.indexOf(startMatch[0]) + startMatch[0].length;
    
    // Find the matching closing brace - need to count braces
    let braceCount = 0;
    let endIdx = startIdx;
    let inString = false;
    let stringChar = '';
    
    for (let i = startIdx; i < html.length; i++) {
        const char = html[i];
        const prevChar = i > 0 ? html[i-1] : '';
        
        // Handle strings
        if ((char === '"' || char === "'") && prevChar !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (char === stringChar) {
                inString = false;
            }
        }
        
        // Count braces only outside strings
        if (!inString) {
            if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
            
            if (braceCount === 0 && char === '}') {
                endIdx = i + 1;
                break;
            }
        }
    }
    
    const jsonStr = html.substring(startIdx, endIdx);
    console.log('Extracted JSON length:', jsonStr.length);
    
    try {
        // Try to parse the JSON
        const data = JSON.parse(jsonStr);
        console.log('\n✅ Successfully parsed JSON!');
        console.log('\nData keys:', Object.keys(data));
        
        if (data.stats) {
            console.log(`\nFound ${data.stats.length} stat entries`);
            
            // Find Aggregated stats
            const aggregated = data.stats.find(s => s.name === 'Aggregated');
            if (aggregated) {
                console.log('\n📊 Aggregated Stats:');
                console.log('   Total Requests:', aggregated.num_requests);
                console.log('   Total Failures:', aggregated.num_failures);
                console.log('   Failure Rate:', (aggregated.num_failures / aggregated.num_requests * 100).toFixed(2) + '%');
                console.log('   Avg Response Time:', Math.round(aggregated.avg_response_time), 'ms');
                console.log('   Median Response Time:', Math.round(aggregated.median_response_time), 'ms');
                console.log('   P95 Response Time:', Math.round(aggregated.response_time_percentile_0_95), 'ms');
                console.log('   Total RPS:', aggregated.total_rps.toFixed(2));
            }
            
            // Show top 5 endpoints
            const endpoints = data.stats.filter(s => s.name !== 'Aggregated');
            console.log('\n🎯 Top Endpoints:');
            endpoints.slice(0, 5).forEach((ep, idx) => {
                console.log(`   ${idx + 1}. ${ep.method} ${ep.name}`);
                console.log(`      Requests: ${ep.num_requests}, Failures: ${ep.num_failures}, Avg: ${Math.round(ep.avg_response_time)}ms`);
            });
        }
        
        // Save to file for inspection
        fs.writeFileSync('extracted-data.json', JSON.stringify(data, null, 2));
        console.log('\n✅ Full data saved to extracted-data.json');
        
    } catch (error) {
        console.error('❌ Failed to parse JSON:', error.message);
        console.log('\nFirst 500 chars:', jsonStr.substring(0, 500));
    }
} else {
    console.log('❌ window.templateArgs not found');
}
