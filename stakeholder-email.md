# Stakeholder Email CSV Example

This CSV file contains email addresses of stakeholders who should receive load test reports.

## Format

The CSV should have at least an 'email' column. You can include additional columns like 'name' for documentation:

```csv
name,email
John Doe,john@example.com
Jane Smith,jane@example.com
```

Or just emails in a single column:

```csv
email
user1@example.com
user2@example.com
```

## Usage

The `send-email-report.js` script will automatically read this file and send emails to all addresses listed.

### Default CSV Path
- File name: `stakeholder-email.csv`
- Location: Same directory as the script

### Custom CSV Path
Use the `--stakeholders-csv` flag to specify a different file:
```bash
node send-email-report.js --stakeholders-csv "path/to/custom.csv" ...
```

## Tips

1. **Merge with --to flag**: Emails specified with `--to` will be merged with CSV emails
2. **Duplicate removal**: If the same email appears in both CSV and --to, it's sent only once
3. **No --to required**: If CSV exists with valid emails, --to flag becomes optional
4. **Comments**: You can add a header row (like "name,email") - it will be skipped automatically
