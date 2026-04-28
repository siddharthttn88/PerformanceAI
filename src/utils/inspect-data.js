#!/usr/bin/env node

const fs = require('fs');

const htmlFile = process.argv[2] || 'D:\\AstroPayTV\\PayTV\\reports\\result.html';

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

console.log('Available top-level fields in templateArgs:');
console.log(Object.keys(data).join(', '));

console.log('\n\nKey values:');
console.log('start_time:', data.start_time);
console.log('end_time:', data.end_time);
console.log('duration:', data.duration);
console.log('user_count:', data.user_count);
console.log('num_requests:', data.num_requests);
console.log('num_failures:', data.num_failures);
console.log('host:', data.host);

console.log('\n\nAggregated stats:');
const agg = data.requests_statistics.find(s => s.name === 'Aggregated');
if (agg) {
  console.log('num_requests:', agg.num_requests);
  console.log('num_failures:', agg.num_failures);
  console.log('avg_response_time:', agg.avg_response_time);
  console.log('total_rps:', agg.total_rps);
}
