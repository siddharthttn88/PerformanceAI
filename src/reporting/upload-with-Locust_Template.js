const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('Usage: node upload-with-Locust_Template.js <HTML_REPORT_PATH> <SPREADSHEET_ID> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --users <count>      User count (required)');
    console.error('  --rampup <time>      Ramp-up time (e.g., "1 minute", "4 minutes")');
    console.error('  --sheet <name>       Sheet name (default: first sheet)');
    console.error('  --comment <text>     Infrastructure/config comment');
    console.error('  --creds <path>       Credentials file (default: config/credentials.json)');
    console.error('  --targettps <tps>    Target TPS for display');
    console.error('  --timezone <tz>      Timezone ("IST" or "local", default: local)');
    console.error('');
    console.error('Example:');
    console.error('  node upload-with-Locust_Template.js result.html SHEET_ID --users 10000 --rampup "1 minute" --sheet "Subscriber_21-04-26" --targettps 166');
    process.exit(1);
}

const htmlPath = path.resolve(args[0]);
const spreadsheetId = args[1];

// Parse options
const options = {
    users: null,
    rampup: '1 minute',
    sheet: null,
    comment: '',
    creds: 'credentials.json',
    targettps: null,
    timezone: 'local'
};

for (let i = 2; i < args.length; i++) {
    if (args[i] === '--users' && i + 1 < args.length) {
        options.users = parseInt(args[++i]);
    } else if (args[i] === '--rampup' && i + 1 < args.length) {
        options.rampup = args[++i];
    } else if (args[i] === '--sheet' && i + 1 < args.length) {
        options.sheet = args[++i];
    } else if (args[i] === '--comment' && i + 1 < args.length) {
        options.comment = args[++i];
    } else if (args[i] === '--creds' && i + 1 < args.length) {
        options.creds = args[++i];
    } else if (args[i] === '--targettps' && i + 1 < args.length) {
        options.targettps = parseInt(args[++i]);
    } else if (args[i] === '--timezone' && i + 1 < args.length) {
        options.timezone = args[++i];
    }
}

if (!options.users) {
    console.error('❌ Error: --users parameter is required');
    process.exit(1);
}

// Parse HTML report
function parseLocustReport(htmlPath) {
    const content = fs.readFileSync(htmlPath, 'utf8');
    const idx = content.indexOf('window.templateArgs =');
    
    if (idx === -1) {
        throw new Error('templateArgs not found in HTML file');
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
    
    // Parse statistics
    const stats = data.requests_statistics || [];
    
    // Build percentile map from response_time_statistics
    const percMap = {};
    (data.response_time_statistics || []).forEach(r => {
        percMap[r.name] = r;
    });
    
    return {
        startTime: data.start_time,
        endTime: data.end_time,
        duration: data.duration,
        host: data.host,
        stats: stats,
        percentiles: percMap
    };
}

// Parse duration string to seconds
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

// Format date from UTC to readable format (with timezone option)
function formatDateTime(utcString, timezone = 'local') {
    const date = new Date(utcString);
    
    let adjustedDate;
    if (timezone === 'IST') {
        // Convert to IST (GMT+5:30)
        adjustedDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
        const month = adjustedDate.getUTCMonth() + 1;
        const day = adjustedDate.getUTCDate();
        const year = adjustedDate.getUTCFullYear();
        let hours = adjustedDate.getUTCHours();
        const minutes = adjustedDate.getUTCMinutes().toString().padStart(2, '0');
        const seconds = adjustedDate.getUTCSeconds().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        
        return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
    } else {
        // Use local timezone
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        
        return `${month}/${day}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
    }
}

async function uploadToGoogleSheet() {
    try {
        console.log('📊 Parsing Locust report...');
        const reportData = parseLocustReport(htmlPath);
        
        // Parse duration
        const durationSeconds = parseDuration(reportData.duration);
        const durationMinutes = Math.floor(durationSeconds / 60);
        const durationRemainingSeconds = Math.round(durationSeconds % 60);
        
        console.log('📄 Report data:');
        console.log(`   Start: ${reportData.startTime}`);
        console.log(`   End: ${reportData.endTime}`);
        console.log(`   Duration: ${durationMinutes}m ${durationRemainingSeconds}s`);
        console.log(`   Endpoints: ${reportData.stats.length}`);
        
        // Calculate metrics
        const apiStats = reportData.stats.filter(s => s.name !== 'Aggregated');
        const totalRequests = apiStats.reduce((sum, s) => sum + s.num_requests, 0);
        const totalFailures = apiStats.reduce((sum, s) => sum + s.num_failures, 0);
        const errorRate = totalRequests > 0 ? (totalFailures / totalRequests * 100).toFixed(2) : 0;
        const totalRPS = apiStats.reduce((sum, s) => sum + s.total_rps, 0);
        const avgResponseTime = apiStats.reduce((sum, s) => sum + s.avg_response_time, 0) / apiStats.length;
        
        // Calculate target TPS (if not provided)
        const targetTPS = options.targettps || Math.round(options.users / 60);
        
        // Determine PASS/FAIL
        const SLA_THRESHOLD = 1000; // 1 second
        const ERROR_THRESHOLD = 5; // 5%
        
        const avgViolations = apiStats.filter(s => s.avg_response_time > SLA_THRESHOLD);
        const p95Violations = apiStats.filter(s => {
            const perc = reportData.percentiles[s.name];
            return perc && perc['0.95'] && perc['0.95'] > SLA_THRESHOLD;
        });
        const highErrorRate = parseFloat(errorRate) > ERROR_THRESHOLD;
        
        const testStatus = (highErrorRate || avgViolations.length > 0 || p95Violations.length > 0) ? 'FAIL' : 'PASS';
        
        console.log(`\n📊 Metrics Summary:`);
        console.log(`   Users: ${options.users.toLocaleString()}`);
        console.log(`   Total Requests: ${totalRequests.toLocaleString()}`);
        console.log(`   Total Failures: ${totalFailures.toLocaleString()}`);
        console.log(`   Error Rate: ${errorRate}%`);
        console.log(`   Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Total RPS: ${Math.round(totalRPS)}`);
        
        if (testStatus === 'FAIL') {
            console.log(`\n⚠️  Auto-detected status: FAIL`);
            if (highErrorRate) {
                console.log(`   - Reason: High error rate ${errorRate}% (threshold: ${ERROR_THRESHOLD}%)`);
            }
            if (avgViolations.length > 0) {
                console.log(`   - Avg SLA violations: ${avgViolations.map(s => `${s.name} (${Math.round(s.avg_response_time)}ms)`).join(', ')}`);
            }
            if (p95Violations.length > 0) {
                console.log(`   - P95 SLA violations: ${p95Violations.map(s => {
                    const perc = reportData.percentiles[s.name];
                    return `${s.name} (${Math.round(perc['0.95'])}ms)`;
                }).join(', ')}`);
            }
        } else {
            console.log(`\n✅ Auto-detected status: PASS`);
            console.log(`   - Error rate: ${errorRate}% (<${ERROR_THRESHOLD}%)`);
            console.log(`   - Response times: All APIs avg & P95 <${SLA_THRESHOLD}ms`);
        }
        
        // Format timestamps
        const startFormatted = formatDateTime(reportData.startTime, options.timezone);
        const endFormatted = formatDateTime(reportData.endTime, options.timezone);
        
        // Load credentials
        const credsPath = path.resolve(options.creds);
        if (!fs.existsSync(credsPath)) {
            console.error(`❌ Credentials file not found: ${credsPath}`);
            process.exit(1);
        }
        
        const credentials = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Get or create sheet
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        let sheetName = options.sheet;
        if (!sheetName) {
            sheetName = spreadsheet.data.sheets[0].properties.title;
        }
        
        let sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        let sheetId;
        
        if (!sheet) {
            console.log(`📝 Creating new sheet: "${sheetName}"...`);
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
        
        // Prepare data rows following templateNew format
        const rows = [
            ['Load', `${options.users} Users (${targetTPS}TPS)`, `Total TPS on service = ${Math.round(totalRPS)}`], // Row 1
            ['Test Time', `${startFormatted} - ${endFormatted} (${reportData.duration})`, '', `RampUp - ${options.rampup}`], // Row 2
            ['Test Status ', testStatus], // Row 3
            ['Comment ', options.comment], // Row 4
            ['Type', 'Name', '# Requests', '# Fails', 'Average (ms)', 'Min (ms)', 'Max (ms)', 'RPS', 'Failures/s', '90%ile (ms)', '95%ile (ms)'] // Row 5: Headers
        ];
        
        // Add API data rows
        apiStats.forEach(stat => {
            const perc = reportData.percentiles[stat.name] || {};
            const p90 = perc['0.90'] ? Math.round(perc['0.90']) : Math.round(stat.median_response_time);
            const p95 = perc['0.95'] ? Math.round(perc['0.95']) : Math.round(stat.median_response_time);
            
            rows.push([
                stat.method,
                stat.name,
                stat.num_requests,
                stat.num_failures,
                stat.avg_response_time.toFixed(2),
                stat.min_response_time,
                stat.max_response_time,
                stat.total_rps.toFixed(2),
                stat.total_fail_per_sec.toFixed(2),
                p90,
                p95
            ]);
        });
        
        console.log('📍 Finding last row...');
        
        // Get current data to find last row
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:K1000`,
        });
        
        const existingRows = response.data.values || [];
        let lastRow = existingRows.length;
        
        // Find the actual last non-empty row
        for (let i = existingRows.length - 1; i >= 0; i--) {
            if (existingRows[i] && existingRows[i].some(cell => cell && cell.trim())) {
                lastRow = i + 1;
                break;
            }
        }
        
        let startRow;
        if (lastRow === 0) {
            console.log('📝 Writing to empty sheet...');
            startRow = 1;
        } else {
            console.log(`📝 Appending after row ${lastRow} (with 6 blank lines)...`);
            startRow = lastRow + 7; // 6 blank lines + 1 for next row
        }
        
        // Write data
        console.log('📝 Writing data to sheet...');
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A${startRow}`,
            valueInputOption: 'RAW',
            requestBody: {
                values: rows
            }
        });
        
        console.log('🎨 Applying formatting...');
        
        // Apply formatting
        const requests = [
            // Merge Comment row cells (B through K) for more space
            {
                mergeCells: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 2,
                        endRowIndex: startRow + 3,
                        startColumnIndex: 1,
                        endColumnIndex: 11
                    },
                    mergeType: 'MERGE_ALL'
                }
            },
            // Add borders around all data
            {
                updateBorders: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow - 1,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 0,
                        endColumnIndex: 11
                    },
                    top: { style: 'SOLID', width: 1 },
                    bottom: { style: 'SOLID', width: 1 },
                    left: { style: 'SOLID', width: 1 },
                    right: { style: 'SOLID', width: 1 },
                    innerHorizontal: { style: 'SOLID', width: 1 },
                    innerVertical: { style: 'SOLID', width: 1 }
                }
            },
            // Bold and color header row (Row 5)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 3,
                        endRowIndex: startRow + 4,
                        startColumnIndex: 0,
                        endColumnIndex: 11
                    },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 0.8, green: 0.8, blue: 0.8 },
                            textFormat: { bold: true }
                        }
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat)'
                }
            },
            // Color Test Status cell based on PASS/FAIL (Row 3)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 1,
                        endRowIndex: startRow + 2,
                        startColumnIndex: 1,
                        endColumnIndex: 2
                    },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: testStatus === 'PASS' 
                                ? { red: 0.7, green: 0.9, blue: 0.7 }
                                : { red: 0.9, green: 0.7, blue: 0.7 },
                            textFormat: { bold: true }
                        }
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat)'
                }
            },
            // Highlight Total TPS value (Row 1)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow - 1,
                        endRowIndex: startRow,
                        startColumnIndex: 2,
                        endColumnIndex: 3
                    },
                    cell: {
                        userEnteredFormat: {
                            backgroundColor: { red: 1.0, green: 0.9, blue: 0.6 },
                            textFormat: { bold: true }
                        }
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat)'
                }
            },
            // Enable text wrapping for merged Comment cell
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 2,
                        endRowIndex: startRow + 3,
                        startColumnIndex: 1,
                        endColumnIndex: 11
                    },
                    cell: {
                        userEnteredFormat: {
                            wrapStrategy: 'WRAP',
                            verticalAlignment: 'TOP'
                        }
                    },
                    fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
                }
            },
            // Right-align Average (ms) column (E) in data rows
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 4,
                        endColumnIndex: 5
                    },
                    cell: {
                        userEnteredFormat: {
                            horizontalAlignment: 'RIGHT'
                        }
                    },
                    fields: 'userEnteredFormat(horizontalAlignment)'
                }
            },
            // Right-align RPS column (H) in data rows
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 7,
                        endColumnIndex: 8
                    },
                    cell: {
                        userEnteredFormat: {
                            horizontalAlignment: 'RIGHT'
                        }
                    },
                    fields: 'userEnteredFormat(horizontalAlignment)'
                }
            },
            // Right-align Failures/s column (I) in data rows
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 8,
                        endColumnIndex: 9
                    },
                    cell: {
                        userEnteredFormat: {
                            horizontalAlignment: 'RIGHT'
                        }
                    },
                    fields: 'userEnteredFormat(horizontalAlignment)'
                }
            },
            // Bold summary section labels (Column A)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow - 1,
                        endRowIndex: startRow + 3,
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
            // Auto-resize columns
            {
                autoResizeDimensions: {
                    dimensions: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 0,
                        endIndex: 11
                    }
                }
            },
            // Set Name column (B) to fixed width - 400px
            {
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 1,
                        endIndex: 2
                    },
                    properties: {
                        pixelSize: 400
                    },
                    fields: 'pixelSize'
                }
            },
            // Set Average (ms) column (E) to 85px
            {
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 4,
                        endIndex: 5
                    },
                    properties: {
                        pixelSize: 85
                    },
                    fields: 'pixelSize'
                }
            },
            // Set Min (ms) column (F) to 65px
            {
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 5,
                        endIndex: 6
                    },
                    properties: {
                        pixelSize: 65
                    },
                    fields: 'pixelSize'
                }
            },
            // Set Max (ms) column (G) to 65px
            {
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 6,
                        endIndex: 7
                    },
                    properties: {
                        pixelSize: 65
                    },
                    fields: 'pixelSize'
                }
            },
            // Set RPS column (H) to 65px
            {
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 7,
                        endIndex: 8
                    },
                    properties: {
                        pixelSize: 65
                    },
                    fields: 'pixelSize'
                }
            },
            // Set Failures/s column (I) to 85px
            {
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 8,
                        endIndex: 9
                    },
                    properties: {
                        pixelSize: 85
                    },
                    fields: 'pixelSize'
                }
            },
            // Set 90%ile (ms) column (J) to 85px
            {
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 9,
                        endIndex: 10
                    },
                    properties: {
                        pixelSize: 85
                    },
                    fields: 'pixelSize'
                }
            },
            // Set 95%ile (ms) column (K) to 85px
            {
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'COLUMNS',
                        startIndex: 10,
                        endIndex: 11
                    },
                    properties: {
                        pixelSize: 85
                    },
                    fields: 'pixelSize'
                }
            },
            // Set number format for Average (ms) column (E)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 4,
                        endColumnIndex: 5
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0.00'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Set number format for Min (ms) column (F)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 5,
                        endColumnIndex: 6
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Set number format for Max (ms) column (G)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 6,
                        endColumnIndex: 7
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Set number format for RPS column (H)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 7,
                        endColumnIndex: 8
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0.00'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Set number format for Failures/s column (I)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 8,
                        endColumnIndex: 9
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0.00'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Set number format for 90%ile (ms) column (J)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 9,
                        endColumnIndex: 10
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            },
            // Set number format for 95%ile (ms) column (K)
            {
                repeatCell: {
                    range: {
                        sheetId: sheetId,
                        startRowIndex: startRow + 4,
                        endRowIndex: startRow + rows.length - 1,
                        startColumnIndex: 10,
                        endColumnIndex: 11
                    },
                    cell: {
                        userEnteredFormat: {
                            numberFormat: {
                                type: 'NUMBER',
                                pattern: '#,##0'
                            }
                        }
                    },
                    fields: 'userEnteredFormat.numberFormat'
                }
            }
        ];
        
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });
        
        console.log(`\n✅ Upload Complete!`);
        console.log(`📊 Total APIs: ${apiStats.length}`);
        console.log(`📈 Total Rows: ${rows.length}`);
        console.log(`🎯 Status: ${testStatus}`);
        console.log(`\n🔗 View: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

uploadToGoogleSheet();
