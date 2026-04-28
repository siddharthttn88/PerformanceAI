# Email Report Enhancements - Summary

## Changes Made

### 1. Fixed P90/P95/P99 Percentile Extraction

**Problem:** Percentile data (P90, P95, P99) was showing as 0 in email reports because the field names in Locust's JSON output weren't being matched correctly.

**Solution:** Enhanced the `extractTestSummary()` function to try multiple field name variations:
- `get_response_time_percentile_90`
- `response_time_percentile_90`
- `response_time_percentile_0_90`
- `response_time_percentile_0.90`
- `90%ile`

This ensures compatibility with different Locust versions and output formats.

**Location:** `send-email-report.js` lines 275-300

### 2. Added CSV-Based Email Distribution

**Problem:** Managing multiple recipient emails via command-line arguments was cumbersome and not reusable across multiple test runs.

**Solution:** Added CSV file support for managing stakeholder email lists.

**Features:**
- Reads emails from `stakeholder-email.csv` by default
- Custom CSV path via `--stakeholders-csv <path>` flag
- Merges CSV emails with `--to` flag emails
- Automatic duplicate removal
- Makes `--to` flag optional if CSV exists

**New Function Added:** `readStakeholdersFromCSV(csvPath)` - Parses CSV and extracts email addresses

**CSV Format:**
```csv
name,email
John Doe,john@example.com
Jane Smith,jane@example.com
```

Or simplified:
```csv
email
user1@example.com
user2@example.com
```

### 3. Files Created

1. **stakeholder-email.csv** - Example CSV with stakeholder emails
   ```csv
   name,email
   Siddharth Sarkhel,siddharth.sarkhel@tothenew.com
   ```

2. **stakeholder-email.md** - Documentation for CSV format and usage

3. **test-csv.js** - Test script to verify CSV parsing logic

### 4. Documentation Updated

1. **KNOWLEDGE-BASE.md**
   - Added "Stakeholder Email Distribution" section
   - Updated options to include `--stakeholders-csv`
   - Added CSV usage examples

2. **README.md**
   - Added CSV email distribution section
   - Updated command line options
   - Added CSV usage examples

3. **send-email-report.js help text**
   - Added `--stakeholders-csv` option to help message

## Usage Examples

### Using CSV for distribution (recommended)
```bash
# Automatically reads stakeholder-email.csv
node send-email-report.js \
  --subject "Weekly Load Test Results" \
  --report "result.html"
```

### Combining CSV with additional recipients
```bash
# Sends to CSV emails + urgent-alert@example.com
node send-email-report.js \
  --to "urgent-alert@example.com" \
  --subject "Critical: Breaking Point Found" \
  --report "result.html"
```

### Using custom CSV path
```bash
node send-email-report.js \
  --stakeholders-csv "team-emails.csv" \
  --subject "Load Test Results" \
  --report "result.html"
```

## Benefits

1. **Better P90/P95 Data:** Email reports now show accurate percentile data for performance analysis
2. **Reusable Distribution Lists:** Maintain stakeholder emails in one place
3. **Easier Management:** Update CSV file instead of changing scripts
4. **No Duplication:** Automatic removal of duplicate emails
5. **Flexible:** Can still use --to flag or combine with CSV

## Testing

To verify the CSV functionality works:
```bash
# Create test CSV
echo "name,email" > test-emails.csv
echo "Test User,test@example.com" >> test-emails.csv

# Run with test CSV (won't actually send if SMTP not configured)
node send-email-report.js \
  --stakeholders-csv "test-emails.csv" \
  --subject "Test" \
  --report "Reports/result.html"
```

The script will show:
```
📧 Found 1 stakeholder email(s) in test-emails.csv
```

## Backward Compatibility

All existing functionality remains intact:
- Can still use `--to` flag without CSV
- All existing command-line arguments work as before
- No breaking changes to API or behavior

## Next Steps

1. Populate `stakeholder-email.csv` with your team's email addresses
2. Test email sending with actual SMTP credentials
3. Verify P90/P95 data appears correctly in email reports
4. Update any automation scripts to use CSV-based distribution
