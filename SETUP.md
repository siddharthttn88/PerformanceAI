# Setup Guide - PerformanceAI Toolkit

This guide will help you configure the PerformanceAI toolkit with your own credentials.

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd PerformanceAI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Credentials

#### A. Main Configuration (config.json)

Copy the example file and edit with your credentials:
```bash
# Windows PowerShell
Copy-Item config.example.json config.json

# Linux/Mac
cp config.example.json config.json
```

Edit `config.json` and replace the following:

**New Relic Configuration:**
- `NEW_RELIC_API_KEY`: Your New Relic User API key (starts with NRAK-)
  - Get it from: https://one.newrelic.com/admin-portal/api-keys/home
- `NEW_RELIC_ACCOUNT_ID`: Your New Relic account ID
- `NEW_RELIC_REGION`: "US" or "EU" based on your region

**Grafana Configuration:**
- `GRAFANA_URL`: Your Grafana instance URL (e.g., http://grafana.example.com:3000/)
- `GRAFANA_SERVICE_ACCOUNT_TOKEN`: Your Grafana service account token (starts with glsa_)
  - Create one at: Grafana > Configuration > Service Accounts

**Jenkins Configuration:**
- `baseUrl`: Your Jenkins server URL (e.g., http://jenkins.example.com:8080)
- `username`: Your Jenkins username
- `apiToken`: Your Jenkins API token
  - Generate at: Jenkins > User > Configure > API Token

**Email Configuration (for sending reports):**
- `service`: Email service provider ("gmail", "outlook", or omit for custom SMTP)
- `host`: SMTP server hostname (e.g., smtp.gmail.com)
- `port`: SMTP port (587 for TLS, 465 for SSL)
- `secure`: Use SSL (true) or TLS (false)
- `auth.user`: Your email address
- `auth.pass`: Your email password or app-specific password
  - **For Gmail**: Generate App Password at https://myaccount.google.com/apppasswords
  - **Note**: Regular passwords won't work with Gmail SMTP
- `from`: Sender name and email for reports

**Example for Gmail:**
```json
"email": {
  "service": "gmail",
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "yourname@gmail.com",
    "pass": "abcd efgh ijkl mnop"
  },
  "from": "PerformanceAI <yourname@gmail.com>"
}
```

**Example for Outlook:**
```json
"email": {
  "service": "outlook",
  "host": "smtp-mail.outlook.com",
  "port": 587,
  "secure": false,
  "auth": {
    "user": "yourname@outlook.com",
    "pass": "your-password"
  },
  "from": "PerformanceAI <yourname@outlook.com>"
}
```

#### B. Google Sheets Credentials (credentials.json)

Copy the example file:
```bash
# Windows PowerShell
Copy-Item credentials.example.json credentials.json

# Linux/Mac
cp credentials.example.json credentials.json
```

**To get Google Sheets API credentials:**

1. Go to https://console.cloud.google.com
2. Create a new project (or select existing)
3. Enable "Google Sheets API"
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create Service Account credentials
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and click "Create"
   - Click "Done" (no roles needed for basic access)
5. Generate JSON key
   - Click on the created service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Select "JSON" format
   - Download the file
6. Replace the contents of `credentials.json` with the downloaded JSON

**Important:** Share your Google Sheet with the service account email:
- Open your Google Sheet
- Click "Share"
- Add the email from `client_email` in credentials.json
- Grant "Editor" role
- Click "Send"

### 4. Verify Configuration

Test your setup with these commands:

**Test Grafana connection:**
```bash
node grafana-reader.js health
```

**Test New Relic connection:**
```bash
node newrelic-client.js account
```

**Test Jenkins connection:**
```bash
node jenkins-client.js list
```

**Test Email configuration:**
```bash
node send-email-report.js --to "your-email@example.com" --subject "Test Email" --report "Reports/result.html"
```

**Test Google Sheets (if you have a report):**
```bash
node read-gsheet.js YOUR_SPREADSHEET_ID
```

## 🔒 Security Best Practices

1. **Never commit credential files to git**
   - `config.json` and `credentials.json` are in `.gitignore`
   - Always use the `.example.json` templates for sharing

2. **Use service accounts and API tokens**
   - Never use personal passwords in config files
   - Use API tokens with minimal required permissions
   - Rotate tokens regularly

3. **For Gmail**
   - Enable 2-Factor Authentication
   - Use App Passwords (not your regular password)
   - Generate a specific password for this application

4. **Protect your config files**
   - Set appropriate file permissions
   - Don't share config.json files containing real credentials

## 📝 Configuration Reference

### Minimal Working Configuration

At minimum, you need:
- **For Grafana/Prometheus queries**: Grafana URL and token
- **For New Relic queries**: New Relic API key and account ID
- **For Jenkins automation**: Jenkins URL, username, token
- **For Google Sheets upload**: credentials.json with service account
- **For Email reports**: Email SMTP credentials

### Optional Configuration

You can comment out or omit sections you don't need:
- If not using Jenkins, omit the `jenkins` section
- If not using email, omit the `email` section
- If not using New Relic, omit the `newrelic` section

## 🆘 Troubleshooting

### "Invalid credentials" error
- Check if API keys/tokens are correct and not expired
- Ensure no extra spaces in credential strings
- For Gmail: Make sure you're using an App Password, not regular password

### "Permission denied" error
- Check if API tokens have required permissions
- For Google Sheets: Ensure service account email has access to your sheet

### "Connection refused" error
- Verify server URLs are correct and accessible
- Check if services are running and ports are open

### Email authentication fails
- For Gmail: Generate App Password at https://myaccount.google.com/apppasswords
- For Outlook: May need to enable "Less secure apps" or use app password
- Check SMTP host and port are correct

## 📚 Additional Resources

- [New Relic API Documentation](https://docs.newrelic.com/docs/apis/intro-apis/introduction-new-relic-apis/)
- [Grafana API Documentation](https://grafana.com/docs/grafana/latest/developers/http_api/)
- [Jenkins API Documentation](https://www.jenkins.io/doc/book/using/remote-access-api/)
- [Google Sheets API Documentation](https://developers.google.com/sheets/api/guides/concepts)
- [Nodemailer Documentation](https://nodemailer.com/usage/)

## ✅ Verification Checklist

- [ ] Copied config.example.json to config.json
- [ ] Updated all API keys and tokens in config.json
- [ ] Copied credentials.example.json to credentials.json
- [ ] Updated Google service account credentials
- [ ] Shared Google Sheet with service account email
- [ ] Generated Gmail App Password (if using Gmail)
- [ ] Tested Grafana connection
- [ ] Tested New Relic connection
- [ ] Tested Jenkins connection (if using)
- [ ] Tested Email sending (if using)
- [ ] Tested Google Sheets access (if using)

## 🎉 You're Ready!

Once all configurations are complete and verified, you can start using the toolkit:

```bash
# Run a load test
node jenkins-client.js build "Locust - Test Runner" Users=1000

# Check pod metrics
node get-pod-metrics-enhanced.js subscriber-event-service 5

# Send test report
node send-email-report.js --to "team@example.com" --subject "Load Test Results" --report "Reports/result.html"
```

For detailed usage examples, see [README.md](README.md) and [KNOWLEDGE-BASE.md](KNOWLEDGE-BASE.md).
