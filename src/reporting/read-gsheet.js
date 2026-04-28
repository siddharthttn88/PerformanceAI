const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
    console.error('Usage: node read-gsheet.js <SPREADSHEET_ID> [options]');
    console.error('');
    console.error('Options:');
    console.error('  --sheet <name>       Sheet name (default: first sheet)');
    console.error('  --range <A1:Z100>    Cell range to read (default: all data)');
    console.error('  --creds <path>       Path to credentials JSON (default: config/credentials.json)');
    console.error('  --format <json|csv>  Output format (default: json)');
    console.error('');
    console.error('Examples:');
    console.error('  node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw');
    console.error('  node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw --sheet "Subscriber_21-04-26"');
    console.error('  node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw --sheet "Load Test Results" --range "A1:K50"');
    console.error('  node read-gsheet.js 1ngmUfc0QsOsDnvZkr6K-PtgUFN3mUN_ShxaKmkwi7nw --format csv');
    process.exit(1);
}

const spreadsheetId = args[0];

// Parse options
const options = {
    sheet: null,
    range: null,
    creds: 'config/credentials.json',
    format: 'json'
};

for (let i = 1; i < args.length; i++) {
    if (args[i] === '--sheet' && i + 1 < args.length) {
        options.sheet = args[++i];
    } else if (args[i] === '--range' && i + 1 < args.length) {
        options.range = args[++i];
    } else if (args[i] === '--creds' && i + 1 < args.length) {
        options.creds = args[++i];
    } else if (args[i] === '--format' && i + 1 < args.length) {
        options.format = args[++i].toLowerCase();
    }
}

async function readGoogleSheet() {
    try {
        // Load credentials
        const credsPath = path.resolve(options.creds);
        if (!fs.existsSync(credsPath)) {
            console.error(`❌ Credentials file not found: ${credsPath}`);
            console.error('Please ensure credentials.json exists with Google Sheets API access.');
            process.exit(1);
        }

        const credentials = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        
        // Authenticate
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        console.log('📊 Reading from Google Sheet...');
        console.log(`   Spreadsheet ID: ${spreadsheetId}`);

        // Get spreadsheet metadata to find sheet name if not provided
        let sheetName = options.sheet;
        if (!sheetName) {
            const metadata = await sheets.spreadsheets.get({
                spreadsheetId,
            });
            sheetName = metadata.data.sheets[0].properties.title;
            console.log(`   Using first sheet: "${sheetName}"`);
        } else {
            console.log(`   Sheet: "${sheetName}"`);
        }

        // Build the range
        let range = sheetName;
        if (options.range) {
            range = `${sheetName}!${options.range}`;
            console.log(`   Range: ${options.range}`);
        } else {
            console.log(`   Range: All data`);
        }

        // Read data
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });

        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            console.log('\n⚠️  No data found in the specified range.');
            return;
        }

        console.log(`\n✅ Successfully read ${rows.length} rows\n`);

        // Output based on format
        if (options.format === 'csv') {
            // CSV format
            rows.forEach(row => {
                console.log(row.map(cell => {
                    // Escape cells containing commas or quotes
                    if (cell && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                        return `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell || '';
                }).join(','));
            });
        } else {
            // JSON format (default)
            if (rows.length > 0) {
                // Use first row as headers
                const headers = rows[0];
                const data = rows.slice(1).map(row => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index] || '';
                    });
                    return obj;
                });

                console.log(JSON.stringify(data, null, 2));
            }
        }

        // Print summary
        console.log(`\n📈 Summary:`);
        console.log(`   Total rows: ${rows.length}`);
        console.log(`   Columns: ${rows[0]?.length || 0}`);
        
    } catch (error) {
        if (error.code === 404) {
            console.error(`\n❌ Error: Spreadsheet not found`);
            console.error(`   Make sure the spreadsheet ID is correct and you have access to it.`);
        } else if (error.message.includes('Unable to parse range')) {
            console.error(`\n❌ Error: Invalid sheet name "${options.sheet}"`);
            console.error(`   The sheet may not exist in this spreadsheet.`);
        } else if (error.message.includes('not found')) {
            console.error(`\n❌ Error: Sheet "${options.sheet}" not found`);
            console.error(`   Check that the sheet name is spelled correctly.`);
        } else {
            console.error('\n❌ Error reading from Google Sheet:');
            console.error(`   ${error.message}`);
        }
        process.exit(1);
    }
}

readGoogleSheet();
