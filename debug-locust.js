const fs = require('fs');

const htmlFile = process.argv[2] || "C:\\Users\\Siddharth Sarkhel\\Downloads\\result.html";

const content = fs.readFileSync(htmlFile, 'utf8');
const idx = content.indexOf('window.templateArgs =');

if (idx === -1) {
  console.error('templateArgs not found');
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

console.log('=== FIRST API STAT (full object) ===');
const firstStat = data.requests_statistics.find(s => s.name !== 'Aggregated');
console.log(JSON.stringify(firstStat, null, 2));

console.log('\n=== RESPONSE TIME STATISTICS ===');
if (data.response_time_statistics) {
  console.log('Found response_time_statistics array with', data.response_time_statistics.length, 'items');
  console.log('First item:', JSON.stringify(data.response_time_statistics[0], null, 2));
} else {
  console.log('No response_time_statistics found');
}

console.log('\n=== ALL KEYS IN DATA ===');
console.log(Object.keys(data));
