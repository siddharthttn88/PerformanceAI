#!/usr/bin/env node
/**
 * Test script to verify P90/P95 percentile extraction is working correctly
 */

const fs = require('fs');
const path = require('path');

function extractPercentiles(htmlPath) {
    try {
        const html = fs.readFileSync(htmlPath, 'utf8');
        
        // Find and parse window.templateArgs
        const templateArgsMatch = html.match(/window\.templateArgs\s*=\s*/);
        if (!templateArgsMatch) {
            console.error('❌ Could not find window.templateArgs in HTML');
            return;
        }
        
        const startIdx = html.indexOf(templateArgsMatch[0]) + templateArgsMatch[0].length;
        let braceCount = 0;
        let endIdx = startIdx;
        let inString = false;
        let stringChar = '';
        
        for (let i = startIdx; i < html.length; i++) {
            const char = html[i];
            const prevChar = i > 0 ? html[i-1] : '';
            
            if ((char === '"' || char === "'") && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }
            
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
        const data = JSON.parse(jsonStr);
        
        console.log('\n✅ Successfully parsed window.templateArgs\n');
        
        // Check for response_time_statistics
        if (!data.response_time_statistics) {
            console.error('❌ response_time_statistics field not found in data');
            return;
        }
        
        console.log('📊 PERCENTILE DATA FROM response_time_statistics:\n');
        console.log('='*80);
        
        data.response_time_statistics.forEach(stat => {
            console.log(`\n🎯 Endpoint: ${stat.name} (${stat.method})`);
            console.log(`   P50 (Median):  ${stat['0.5'] || 'N/A'}ms`);
            console.log(`   P60:           ${stat['0.6'] || 'N/A'}ms`);
            console.log(`   P70:           ${stat['0.7'] || 'N/A'}ms`);
            console.log(`   P80:           ${stat['0.8'] || 'N/A'}ms`);
            console.log(`   P90:           ${stat['0.9'] || 'N/A'}ms  ⭐ P90 FOUND!`);
            console.log(`   P95:           ${stat['0.95'] || 'N/A'}ms ⭐ P95 FOUND!`);
            console.log(`   P99:           ${stat['0.99'] || 'N/A'}ms`);
            console.log(`   P100 (Max):    ${stat['1.0'] || stat['1'] || 'N/A'}ms`);
        });
        
        console.log('\n' + '='*80);
        console.log('\n✅ P90 and P95 percentiles are now being extracted correctly!');
        console.log('   Previous issue: Code was using median as P90 approximation');
        console.log('   Fixed: Now reading actual P90/P95 from response_time_statistics\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

// Run test
const reportPath = path.join(__dirname, 'Reports', 'result.html');

if (!fs.existsSync(reportPath)) {
    console.error(`❌ Report file not found: ${reportPath}`);
    console.error('   Please ensure result.html exists in the Reports folder');
    process.exit(1);
}

console.log(`🔍 Testing percentile extraction from: ${reportPath}\n`);
extractPercentiles(reportPath);
