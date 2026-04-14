#!/usr/bin/env node

const fs = require('fs');
const { google } = require('googleapis');

// =========================
// INPUTS & OPTIONS
// =========================
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node upload-with-template.js <result.html> <spreadsheet-id> [options]');
  console.log('\nOptions:');
  console.log('  --users <number>       Total users');
  console.log('  --tps <number>         Target TPS');
  console.log('  --rampup <time>        Ramp-up time (default: "1 minute")');
  console.log('  --comment <text>       Test comment');
  process.exit(1);
}

const htmlFile = args[0];
const spreadsheetId = args[1];

// Parse options
const options = {
  users: null,
  tps: null,
  rampup: '1 minute',
  comment: '',
};

for (let i = 2; i < args.length; i++) {
  if (args[i] === '--users' && i + 1 < args.length) {
    options.users = parseInt(args[++i]);
  } else if (args[i] === '--tps' && i + 1 < args.length) {
    options.tps = parseFloat(args[++i]);
  } else if (args[i] === '--rampup' && i + 1 < args.length) {
    options.rampup = args[++i];
  } else if (args[i] === '--comment' && i + 1 < args.length) {
    options.comment = args[++i];
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

// Parse duration string (e.g., "3 minutes and 1 second")
function parseDuration(durationStr) {
  if (typeof durationStr === 'number') {
    return durationStr;
  }
  
  let totalSeconds = 0;
  const minutesMatch = durationStr.match(/(\d+)\s*minute/);
  const secondsMatch = durationStr.match(/(\d+)\s*second/);
  
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1]) * 60;
  }
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1]);
  }
  
  return totalSeconds;
}

const durationSeconds = parseDuration(data.duration || 0);
const durationMinutes = Math.floor(durationSeconds / 60);
const durationRemainingSeconds = Math.round(durationSeconds % 60);

// Convert UTC to IST (GMT+5:30)
function toIST(isoStr) {
  const dt = new Date(isoStr);
  const istTime = new Date(dt.getTime() + (5.5 * 60 * 60 * 1000));
  
  const day = istTime.getUTCDate();
  const month = istTime.getUTCMonth() + 1;
  const year = istTime.getUTCFullYear();
  let hours = istTime.getUTCHours();
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  
  return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

const startTime = toIST(data.start_time);
const endTime = toIST(data.end_time);

// Build load description - user count must be provided via --users option
const userCount = options.users;
const calculatedTPS = userCount ? Math.round(userCount / 60) : null;
const loadDesc = userCount 
  ? `${userCount.toLocaleString()} Users (${calculatedTPS} TPS)`
  : `${aggregated.num_requests ? aggregated.num_requests.toLocaleString() : '0'} Total Requests`;

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

console.log('\n📊 Detected from HTML Report:');
console.log(`   Users: ${userCount ? userCount.toLocaleString() : 'N/A'}`);
console.log(`   Start: ${startTime}`);
console.log(`   End: ${endTime}`);
console.log(`   Duration: ${durationMinutes}m ${durationRemainingSeconds}s`);
console.log(`   Total TPS: ${totalTPS}`);

if (testStatus === 'FAIL') {
  console.log('\n⚠️  Auto-detected status: FAIL');
  if (hasFailures) {
    console.log('   - Reason: Request failures detected');
  }
  if (slaViolations.length > 0) {
    console.log('   - SLA violations:', slaViolations.map(s => s.name).join(', '));
  }
}

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
  // GET LAST ROW FOR APPEND MODE
  // =========================
  console.log('📍 Finding last row...');
  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  
  const lastRow = existingData.data.values ? existingData.data.values.length : 0;
  const startRow = lastRow + 7; // Leave 6 blank lines
  
  if (lastRow > 0) {
    console.log(`📝 Appending after row ${lastRow} (with 6 blank lines)...`);
  } else {
    console.log('📝 Writing to empty sheet...');
  }

  // =========================
  // BUILD DATA (TEMPLATE FORMAT)
  // =========================
  const rows = [];
  
  // Summary Table (matching template exactly)
  rows.push(['Load', loadDesc, `Total TPS on Service = ${totalTPS}`]);
  rows.push(['Test Time', `${startTime} - ${endTime} (${durationMinutes} minutes)`, `Ramp-up = ${options.rampup}`]);
  rows.push(['Test Status', testStatus, '']);
  
  if (options.comment) {
    rows.push(['Comment', options.comment, '']);
  }
  
  rows.push([]); // Empty row separator
  
  // Data Table Header (matching template exactly)
  rows.push([
    'Type',
    'Name',
    '# Requests',
    '# Fails',
    'Average (ms)',
    'Min (ms)',
    'Max (ms)',
    'RPS',
    'Failures/s',
    '90%ile (ms)',
    '95%ile (ms)'
  ]);

  // API Stats
  apiStats.forEach(stat => {
    const perc = percMap[stat.name] || {};
    
    rows.push([
      stat.method || 'POST',
      stat.name,
      stat.num_requests || 0,
      stat.num_failures || 0,
      Math.round(stat.avg_response_time * 100) / 100,
      Math.round(stat.min_response_time || 0),
      Math.round(stat.max_response_time || 0),
      Math.round(stat.total_rps * 100) / 100,
      Math.round((stat.total_fail_per_sec || 0) * 100) / 100,
      Math.round(perc['0.9'] || 0),
      Math.round(perc['0.95'] || 0)
    ]);
  });

  // =========================
  // WRITE DATA
  // =========================
  console.log('📝 Writing data to sheet...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${startRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // =========================
  // FORMATTING (matching template style)
  // =========================
  console.log('🎨 Applying formatting...');
  
  const summaryEndRow = (startRow - 1) + (options.comment ? 4 : 3);
  const headerRow = summaryEndRow + 1;
  const dataStartRow = headerRow + 1;
  
  const requests = [
    // Summary section - light gray background
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: startRow - 1,
          endRowIndex: summaryEndRow + 1,
          startColumnIndex: 0,
          endColumnIndex: 3
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
            borders: {
              top: { style: 'SOLID', width: 1 },
              bottom: { style: 'SOLID', width: 1 },
              left: { style: 'SOLID', width: 1 },
              right: { style: 'SOLID', width: 1 }
            }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,borders)'
      }
    },
    
    // Bold first column in summary
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: startRow - 1,
          endRowIndex: summaryEndRow + 1,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true }
          }
        },
        fields: 'userEnteredFormat.textFormat.bold'
      }
    },
    
    // Test Status color (green for PASS, red for FAIL)
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: startRow + 1,
          endRowIndex: startRow + 2,
          startColumnIndex: 1,
          endColumnIndex: 2
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: testStatus === 'PASS' 
              ? { red: 0.7, green: 0.95, blue: 0.7 }
              : { red: 0.95, green: 0.7, blue: 0.7 },
            textFormat: { bold: true }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat.bold)'
      }
    },
    
    // Data table header - darker gray with bold text
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: headerRow,
          endRowIndex: headerRow + 1,
          startColumnIndex: 0,
          endColumnIndex: 11
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 },
            textFormat: { bold: true },
            horizontalAlignment: 'CENTER',
            borders: {
              top: { style: 'SOLID_MEDIUM', width: 2 },
              bottom: { style: 'SOLID_MEDIUM', width: 2 },
              left: { style: 'SOLID', width: 1 },
              right: { style: 'SOLID', width: 1 }
            }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,borders)'
      }
    },
    
    // Data rows - borders and right-align numbers
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: dataStartRow,
          endRowIndex: startRow - 1 + rows.length,
          startColumnIndex: 0,
          endColumnIndex: 11
        },
        cell: {
          userEnteredFormat: {
            borders: {
              top: { style: 'SOLID', width: 1 },
              bottom: { style: 'SOLID', width: 1 },
              left: { style: 'SOLID', width: 1 },
              right: { style: 'SOLID', width: 1 }
            }
          }
        },
        fields: 'userEnteredFormat.borders'
      }
    },
    
    // Right-align numeric columns
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: dataStartRow,
          endRowIndex: startRow - 1 + rows.length,
          startColumnIndex: 2,
          endColumnIndex: 11
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'RIGHT'
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment'
      }
    },
    
    // Auto resize columns
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 11
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
