#!/usr/bin/env node

const fs = require('fs');
const { google } = require('googleapis');

// =========================
// INPUTS & OPTIONS
// =========================
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node upload-results-clean.js <result.html> <spreadsheet-id>');
  process.exit(1);
}

const htmlFile = args[0];
const spreadsheetId = args[1];

// =========================
// READ HTML
// =========================
const content = fs.readFileSync(htmlFile, 'utf8');
const idx = content.indexOf('window.templateArgs =');

if (idx === -1) {
  console.error('ERROR: templateArgs not found in HTML file');
  process.exit(1);
}

const chunk = content.substring(idx + 'window.templateArgs ='.length).trim();

// Parse JSON properly
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

// =========================
// EXTRACT DATA
// =========================
const aggregated = data.requests_statistics.find(s => s.name === 'Aggregated') || {};
const apiStats = data.requests_statistics.filter(s => s.name !== 'Aggregated');

const totalTPS = Math.round(aggregated.total_rps || 0);

// Convert UTC to IST (GMT+5:30)
function toIST(isoStr) {
  const dt = new Date(isoStr.replace('Z', '+00:00'));
  const istTime = new Date(dt.getTime() + (5.5 * 60 * 60 * 1000));
  
  const day = istTime.getDate();
  const month = istTime.getMonth() + 1;
  const year = istTime.getFullYear();
  let hours = istTime.getHours();
  const minutes = String(istTime.getMinutes()).padStart(2, '0');
  const seconds = String(istTime.getSeconds()).padStart(2, '0');
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  
  return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

const startTime = toIST(data.start_time);
const endTime = toIST(data.end_time);
const durationSeconds = Math.round(data.duration || 0);
const durationMinutes = Math.round(durationSeconds / 60);

// Get percentile data
const percMap = {};
(data.response_time_statistics || []).forEach(r => {
  percMap[r.name] = r;
});

// =========================
// SLA CHECK (1 second = 1000ms)
// =========================
const SLA_THRESHOLD = 1000;
const hasFailures = apiStats.some(stat => stat.num_failures > 0);
const slaViolations = apiStats.filter(stat => stat.avg_response_time > SLA_THRESHOLD);
const testStatus = (hasFailures || slaViolations.length > 0) ? 'FAIL' : 'PASS';

// =========================
// GOOGLE SHEETS
// =========================
(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const sheetName = 'Load Test Results';

  // Get or create sheet
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  let sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  
  let sheetId;
  if (!sheet) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    sheetId = res.data.replies[0].addSheet.properties.sheetId;
    console.log(`✅ Created sheet: "${sheetName}"`);
  } else {
    sheetId = sheet.properties.sheetId;
    console.log(`✅ Found sheet: "${sheetName}"`);
  }

  // =========================
  // CLEAR EXISTING DATA
  // =========================
  console.log('🧹 Clearing existing data...');
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  // =========================
  // BUILD DATA
  // =========================
  const rows = [];
  
  // Title Row
  rows.push(['LOCUST LOAD TEST RESULTS', '', '', '', '', '', '', '', '', '', '', '', '']);
  rows.push([]);
  
  // Test Summary Section
  rows.push(['TEST SUMMARY']);
  rows.push(['Test Date', startTime, '', 'End Time', endTime]);
  rows.push(['Duration', `${durationMinutes} minutes (${durationSeconds} seconds)`]);
  rows.push(['Total Requests', aggregated.num_requests ? aggregated.num_requests.toLocaleString() : '0', '', 'Total RPS', totalTPS]);
  rows.push(['Total Failures', aggregated.num_failures || 0, '', 'Failure Rate', ((aggregated.num_failures / aggregated.num_requests) * 100).toFixed(2) + '%']);
  rows.push(['Test Status', testStatus, '', 'SLA Threshold', '1000 ms']);
  rows.push([]);
  
  // Overall Performance
  rows.push(['OVERALL PERFORMANCE']);
  rows.push(['Metric', 'Value']);
  rows.push(['Average Response Time', Math.round(aggregated.avg_response_time) + ' ms']);
  rows.push(['Min Response Time', Math.round(aggregated.min_response_time) + ' ms']);
  rows.push(['Max Response Time', Math.round(aggregated.max_response_time) + ' ms']);
  rows.push(['Median (P50)', Math.round((percMap['Aggregated'] || {})['0.5'] || 0) + ' ms']);
  rows.push(['P90', Math.round((percMap['Aggregated'] || {})['0.9'] || 0) + ' ms']);
  rows.push(['P95', Math.round((percMap['Aggregated'] || {})['0.95'] || 0) + ' ms']);
  rows.push(['P99', Math.round((percMap['Aggregated'] || {})['0.99'] || 0) + ' ms']);
  rows.push([]);
  
  // API Details Header
  rows.push(['API ENDPOINT DETAILS']);
  rows.push([
    'Method',
    'API Name',
    'Requests',
    'Failures',
    'Avg (ms)',
    'Min (ms)',
    'Max (ms)',
    'RPS',
    'Fail/s',
    'P50 (ms)',
    'P90 (ms)',
    'P95 (ms)',
    'P99 (ms)'
  ]);
  
  const headerRowIndex = rows.length - 1;
  
  // API Stats
  apiStats.forEach(stat => {
    const perc = percMap[stat.name] || {};
    rows.push([
      stat.method || 'GET',
      stat.name,
      stat.num_requests || 0,
      stat.num_failures || 0,
      Math.round(stat.avg_response_time),
      Math.round(stat.min_response_time || 0),
      Math.round(stat.max_response_time || 0),
      Math.round(stat.total_rps * 100) / 100,
      Math.round(stat.total_fail_per_sec * 100) / 100,
      Math.round(perc['0.5'] || 0),
      Math.round(perc['0.9'] || 0),
      Math.round(perc['0.95'] || 0),
      Math.round(perc['0.99'] || 0)
    ]);
  });
  
  rows.push([]);
  
  // Failure Details (if any)
  if (hasFailures) {
    rows.push(['FAILURE DETAILS']);
    rows.push(['API Name', 'Failures', 'Failure Rate']);
    apiStats.filter(s => s.num_failures > 0).forEach(stat => {
      rows.push([
        stat.name,
        stat.num_failures,
        ((stat.num_failures / stat.num_requests) * 100).toFixed(2) + '%'
      ]);
    });
    rows.push([]);
  }
  
  // SLA Violations (if any)
  if (slaViolations.length > 0) {
    rows.push(['SLA VIOLATIONS (> 1000ms)']);
    rows.push(['API Name', 'Avg Response Time']);
    slaViolations.forEach(stat => {
      rows.push([stat.name, Math.round(stat.avg_response_time) + ' ms']);
    });
  }

  // =========================
  // WRITE DATA
  // =========================
  console.log('📝 Writing data to sheet...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // =========================
  // FORMATTING
  // =========================
  console.log('🎨 Applying formatting...');
  
  const requests = [
    // Title formatting
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.4, blue: 0.7 },
            textFormat: { bold: true, fontSize: 14, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: 'CENTER'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
      }
    },
    
    // Merge title row
    {
      mergeCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        mergeType: 'MERGE_ALL'
      }
    },
    
    // Section headers formatting (TEST SUMMARY, OVERALL PERFORMANCE, API ENDPOINT DETAILS, etc.)
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 2,
          endRowIndex: 3,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.4, green: 0.6, blue: 0.9 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    },
    
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 10,
          endRowIndex: 11,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.4, green: 0.6, blue: 0.9 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    },
    
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 19,
          endRowIndex: 20,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.4, green: 0.6, blue: 0.9 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    },
    
    // Test Status color
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 8,
          endRowIndex: 9,
          startColumnIndex: 1,
          endColumnIndex: 2
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: testStatus === 'PASS' 
              ? { red: 0.5, green: 0.9, blue: 0.5 }
              : { red: 0.9, green: 0.5, blue: 0.5 },
            textFormat: { bold: true, fontSize: 11 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    },
    
    // API Details header row
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 20,
          endRowIndex: 21,
          startColumnIndex: 0,
          endColumnIndex: 13
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.7, green: 0.7, blue: 0.7 },
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
      }
    },
    
    // Freeze header rows
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 21
          }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    },
    
    // Auto resize columns
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 13
        }
      }
    }
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests }
  });

  console.log('\n✅ Upload Complete!');
  console.log(`📊 Total APIs: ${apiStats.length}`);
  console.log(`📈 Total Rows: ${rows.length}`);
  console.log(`🎯 Status: ${testStatus}`);
  console.log(`\n🔗 View: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
})();
