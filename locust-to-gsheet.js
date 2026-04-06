#!/usr/bin/env node

const fs = require('fs');
const { google } = require('googleapis');

// =========================
// INPUTS & OPTIONS
// =========================
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node locust-to-gsheet.js <result.html> <spreadsheet-id> [options]');
  console.log('\nOptions:');
  console.log('  --users <number>       Total users');
  console.log('  --tps <number>         Target TPS');
  console.log('  --rampup <time>        Ramp-up time (e.g., "1 minute")');
  console.log('  --status <PASS|FAIL>   Test status (auto-calculated if not provided based on 1sec SLA)');
  console.log('  --comment <text>       Test comment');
  console.log('  --creds <file>         Credentials file (default: credentials.json)');
  console.log('\nSLA: Auto FAIL if any API avg > 1000ms or has failures');
  process.exit(1);
}

const htmlFile = args[0];
const spreadsheetId = args[1];

// Parse options
const options = {
  users: null,
  tps: null,
  status: 'PASS',
  statusManual: false,
  comment: '',
  rampup: '1 minute',
  credsFile: 'credentials.json',
};

for (let i = 2; i < args.length; i++) {
  if (args[i] === '--users' && i + 1 < args.length) {
    options.users = parseInt(args[++i]);
  } else if (args[i] === '--tps' && i + 1 < args.length) {
    options.tps = parseFloat(args[++i]);
  } else if (args[i] === '--status' && i + 1 < args.length) {
    options.status = args[++i];
    options.statusManual = true;
  } else if (args[i] === '--comment' && i + 1 < args.length) {
    options.comment = args[++i];
  } else if (args[i] === '--rampup' && i + 1 < args.length) {
    options.rampup = args[++i];
  } else if (args[i] === '--creds' && i + 1 < args.length) {
    options.credsFile = args[++i];
  }
}

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
const durationMinutes = Math.round(data.duration || 0);

// Build load description
const loadDesc = options.users 
  ? `${options.users.toLocaleString()} Users (${options.tps || 'N/A'} TPS)`
  : `${totalTPS} TPS`;

// Get percentile data
const percMap = {};
(data.response_time_statistics || []).forEach(r => {
  percMap[r.name] = r;
});

// =========================
// SLA CHECK (1 second = 1000ms)
// =========================
const SLA_THRESHOLD = 1000; // 1 second in milliseconds

// Check for failures and SLA violations
const hasFailures = apiStats.some(stat => stat.num_failures > 0);
const exceedsSLA = apiStats.some(stat => stat.avg_response_time > SLA_THRESHOLD);

// Find which APIs failed SLA
const failedAPIs = apiStats.filter(stat => 
  stat.avg_response_time > SLA_THRESHOLD || stat.num_failures > 0
);

// Check if status is manually provided, otherwise auto-calculate
if (!options.statusManual) {
  // Auto-calculate based on SLA
  if (hasFailures || exceedsSLA) {
    options.status = 'FAIL';
    console.log(`\n⚠️  Auto-detected status: FAIL`);
    console.log(`   SLA Threshold: ${SLA_THRESHOLD}ms (1 second)`);
    console.log(`   APIs exceeding SLA (${failedAPIs.length}):`);
    failedAPIs.forEach(api => {
      const reason = [];
      if (api.avg_response_time > SLA_THRESHOLD) {
        reason.push(`Avg: ${Math.round(api.avg_response_time)}ms`);
      }
      if (api.num_failures > 0) {
        reason.push(`Failures: ${api.num_failures}`);
      }
      console.log(`     - ${api.name} (${reason.join(', ')})`);
    });
  } else {
    options.status = 'PASS';
    console.log(`\n✅ Auto-detected status: PASS`);
    console.log(`   All APIs within SLA (< ${SLA_THRESHOLD}ms) and no failures`);
  }
} else {
  console.log(`\n📋 Manual status provided: ${options.status}`);
}

// =========================
// GOOGLE AUTH
// =========================
async function run() {
  const auth = new google.auth.GoogleAuth({
    keyFile: options.credsFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const sheetName = 'Load Test Results';

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
    console.log(`Created sheet: "${sheetName}"`);
  } else {
    sheetId = sheet.properties.sheetId;
    console.log(`Found sheet: "${sheetName}"`);
  }

  // Get current row count
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z1000`,
  });
  
  const existingRows = (response.data.values || []).length;

  // =========================
  // BUILD DATA (TEMPLATE FORMAT)
  // =========================
  const rows = [
    ['Load', loadDesc, '', `Total TPS on Service = ${totalTPS}`],
    ['Test Time', `${startTime} - ${endTime} (${durationMinutes} minutes)`, '', `Ramp-up: ${options.rampup}`],
    ['Test Status', options.status],
  ];
  
  if (options.comment) {
    rows.push(['Comment', options.comment]);
  }
  
  rows.push([]);
  
  const headerRow = ['Type', 'API Name', 'Requests', 'Fails', 'Avg(ms)', 'Min(ms)', 'Max(ms)', 'RPS', 'Failures/s', 'P90(ms)', 'P95(ms)'];
  rows.push(headerRow);

  apiStats.forEach(stat => {
    const perc = percMap[stat.name] || {};
    
    // Get percentiles from response_time_statistics or fallback to requests_statistics
    const p90 = Math.round(
      perc['0.9'] ||                              // From response_time_statistics
      stat['response_time_percentile_0.9'] ||     // Fallback (doesn't exist but just in case)
      0
    );
    const p95 = Math.round(
      perc['0.95'] ||                             // From response_time_statistics
      stat['response_time_percentile_0.95'] ||    // Fallback from stat object
      0
    );
    
    rows.push([
      stat.method || 'GET',
      stat.name,
      stat.num_requests || 0,
      stat.num_failures || 0,
      Math.round(stat.avg_response_time * 100) / 100,
      Math.round(stat.min_response_time || 0),
      Math.round(stat.max_response_time || 0),
      Math.round(stat.total_rps * 100) / 100,
      Math.round(stat.total_fail_per_sec * 100) / 100,
      p90,
      p95,
    ]);
  });
  
  rows.push([]);
  rows.push([]);

  // =========================
  // WRITE DATA
  // =========================
  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  const startRow = existingRows;
  const endRow = existingRows + rows.length;
  
  // Calculate row indices (accounting for existing rows)
  const statusRowIndex = existingRows + 2;  // Row with Test Status
  const tpsRowIndex = existingRows + 0;      // Row with TPS (first row)
  const headerRowIndex = existingRows + (options.comment ? 5 : 4); // Header row position (after empty row)

  // =========================
  // FORMATTING
  // =========================
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Borders
        {
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: startRow,
              endRowIndex: endRow,
              startColumnIndex: 0,
              endColumnIndex: 11,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
            innerHorizontal: { style: 'SOLID' },
            innerVertical: { style: 'SOLID' },
          },
        },

        // Status color (green for PASS, red for FAIL)
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: statusRowIndex,
              endRowIndex: statusRowIndex + 1,
              startColumnIndex: 1,
              endColumnIndex: 2,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: options.status === 'PASS' 
                  ? { red: 0.6, green: 0.9, blue: 0.6 }
                  : { red: 0.9, green: 0.6, blue: 0.6 },
                textFormat: { bold: true },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat.bold)',
          },
        },

        // TPS orange highlight
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: tpsRowIndex,
              endRowIndex: tpsRowIndex + 1,
              startColumnIndex: 3,
              endColumnIndex: 4,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.7, blue: 0.2 },
                textFormat: { bold: true },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat.bold)',
          },
        },

        // Header row bold with gray background
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: headerRowIndex,
              endRowIndex: headerRowIndex + 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },

        // Auto resize columns
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 11,
            },
          },
        },
      ],
    },
  });

  console.log('✅ Data appended with formatting');
  console.log(`  Rows added: ${rows.length}`);
  console.log(`  APIs tracked: ${apiStats.length}`);
  console.log(`\n  View: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

run();