#!/usr/bin/env node

/**
 * Send Email Report - Load Test Results Mailer
 * 
 * Sends load test report and analysis via email with HTML formatting
 * Supports attachments (HTML reports, screenshots, metrics files)
 * 
 * Usage:
 *   node send-email-report.js --to "email@example.com" --subject "Load Test Report" --report "result.html" [options]
 * 
 * Options:
 *   --to <email>           Recipient email (required, can be comma-separated for multiple)
 *   --cc <email>           CC recipients (optional, comma-separated)
 *   --subject <text>       Email subject (required)
 *   --report <path>        Path to HTML report file (required)
 *   --body <text>          Additional body text/analysis (optional)
 *   --attach <paths>       Additional attachments (optional, comma-separated)
 *   --config <path>        Config file path (default: config.json)
 *   --template <basic|detailed>  Email template style (default: detailed)
 * 
 * Examples:
 *   # Send basic report
 *   node send-email-report.js --to "team@example.com" --subject "Load Test - 5000 Users" --report "result.html"
 * 
 *   # Send with analysis and CC
 *   node send-email-report.js --to "manager@example.com" --cc "dev@example.com,qa@example.com" \
 *     --subject "Breaking Point Test - subscriber-event-service" \
 *     --report "result.html" \
 *     --body "Breaking point reached at 40K users. CPU maxed at 100%. See attached report for details."
 * 
 *   # Send with multiple attachments
 *   node send-email-report.js --to "team@example.com" --subject "Load Test Results" \
 *     --report "result.html" \
 *     --attach "metrics.json,screenshots.png"
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
function parseArgs() {
    const args = {
        to: null,
        cc: null,
        subject: null,
        report: null,
        body: '',
        attach: [],
        config: 'config.json',
        template: 'detailed'
    };

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        const nextArg = process.argv[i + 1];

        switch (arg) {
            case '--to':
                args.to = nextArg;
                i++;
                break;
            case '--cc':
                args.cc = nextArg;
                i++;
                break;
            case '--subject':
                args.subject = nextArg;
                i++;
                break;
            case '--report':
                args.report = nextArg;
                i++;
                break;
            case '--body':
                args.body = nextArg;
                i++;
                break;
            case '--attach':
                args.attach = nextArg.split(',').map(p => p.trim());
                i++;
                break;
            case '--config':
                args.config = nextArg;
                i++;
                break;
            case '--template':
                args.template = nextArg;
                i++;
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
        }
    }

    return args;
}

function printHelp() {
    console.log(`
Send Email Report - Load Test Results Mailer

Usage:
  node send-email-report.js --to <email> --subject <text> --report <path> [options]

Required Options:
  --to <email>           Recipient email (comma-separated for multiple)
  --subject <text>       Email subject line
  --report <path>        Path to HTML report file

Optional:
  --cc <email>           CC recipients (comma-separated)
  --body <text>          Additional body text/analysis
  --attach <paths>       Additional attachments (comma-separated)
  --config <path>        Config file path (default: config.json)
  --template <style>     Email template: basic|detailed (default: detailed)
  --help, -h             Show this help message

Examples:
  # Basic usage
  node send-email-report.js --to "team@example.com" \\
    --subject "Load Test - 5000 Users" \\
    --report "result.html"

  # With analysis and CC
  node send-email-report.js --to "manager@example.com" \\
    --cc "dev@example.com,qa@example.com" \\
    --subject "Breaking Point Test Results" \\
    --report "result.html" \\
    --body "Breaking point reached at 40K users. See attached report."

  # With multiple attachments
  node send-email-report.js --to "team@example.com" \\
    --subject "Load Test Results" \\
    --report "result.html" \\
    --attach "metrics.json,grafana-screenshot.png"
`);
}

// Load configuration
function loadConfig(configPath) {
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        if (!config.email) {
            throw new Error('Email configuration not found in config.json. Please add "email" section.');
        }

        return config.email;
    } catch (error) {
        console.error(`Error loading config from ${configPath}:`, error.message);
        console.error('\nExpected config.json format:');
        console.error(`{
  "email": {
    "service": "gmail",
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
    "auth": {
      "user": "your-email@gmail.com",
      "pass": "your-app-password"
    },
    "from": "Load Test Reports <your-email@gmail.com>"
  }
}`);
        process.exit(1);
    }
}

// Extract test summary from HTML report
function extractTestSummary(htmlPath) {
    try {
        const html = fs.readFileSync(htmlPath, 'utf8');
        
        const summary = {
            totalRequests: 0,
            totalFailures: 0,
            avgResponseTime: 0,
            rps: 0,
            testDuration: '',
            endpoints: []
        };

        // Extract total requests
        const requestsMatch = html.match(/Total.*?(\d+(?:,\d+)*)/i);
        if (requestsMatch) {
            summary.totalRequests = parseInt(requestsMatch[1].replace(/,/g, ''));
        }

        // Extract total failures
        const failuresMatch = html.match(/Total.*?(\d+(?:,\d+)*)\s+(\d+(?:,\d+)*)/i);
        if (failuresMatch) {
            summary.totalFailures = parseInt(failuresMatch[2].replace(/,/g, ''));
        }

        // Extract average response time
        const avgTimeMatch = html.match(/(\d+)\s*ms/);
        if (avgTimeMatch) {
            summary.avgResponseTime = parseInt(avgTimeMatch[1]);
        }

        // Extract RPS
        const rpsMatch = html.match(/(\d+(?:\.\d+)?)\s*RPS/i);
        if (rpsMatch) {
            summary.rps = parseFloat(rpsMatch[1]);
        }

        // Extract test duration
        const durationMatch = html.match(/Test started at:\s*(.+?)$/m);
        if (durationMatch) {
            summary.testDuration = durationMatch[1].trim();
        }

        return summary;
    } catch (error) {
        console.warn('Could not extract test summary from HTML:', error.message);
        return null;
    }
}

// Generate HTML email body
function generateEmailBody(template, summary, customBody) {
    const failureRate = summary ? ((summary.totalFailures / summary.totalRequests) * 100).toFixed(2) : 0;
    const status = summary && (summary.avgResponseTime > 1000 || failureRate > 5) ? 'FAIL' : 'PASS';
    const statusColor = status === 'PASS' ? '#28a745' : '#dc3545';
    const statusEmoji = status === 'PASS' ? '✅' : '🔴';

    if (template === 'basic') {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .custom-body { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; }
        .footer { background: #e9ecef; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; border-radius: 0 0 5px 5px; }
        .status { font-size: 18px; font-weight: bold; color: ${statusColor}; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${statusEmoji} Load Test Report</h1>
        </div>
        <div class="content">
            ${customBody ? `<div class="custom-body">${customBody.replace(/\n/g, '<br>')}</div>` : ''}
            <p><strong>Status:</strong> <span class="status">${status}</span></p>
            <p>Please find the detailed load test report attached.</p>
        </div>
        <div class="footer">
            Generated by PerformanceAI Toolkit | ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`;
    } else {
        // Detailed template
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { background: white; padding: 30px; border: 1px solid #dee2e6; }
        .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
        .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #6c757d; text-transform: uppercase; }
        .summary-card .value { font-size: 24px; font-weight: bold; color: #333; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; background: ${statusColor}; color: white; }
        .custom-body { background: #fff3cd; padding: 20px; margin: 20px 0; border-left: 4px solid #ffc107; border-radius: 5px; }
        .custom-body h3 { margin-top: 0; color: #856404; }
        .metrics { background: #e7f3ff; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .metrics h3 { margin-top: 0; color: #004085; }
        .metrics-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .metrics-table th, .metrics-table td { padding: 8px; text-align: left; border-bottom: 1px solid #b8daff; }
        .metrics-table th { background: #cfe2ff; color: #004085; font-weight: bold; }
        .footer { background: #e9ecef; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; border-radius: 0 0 10px 10px; }
        .attachment-note { background: #d1ecf1; padding: 15px; margin: 20px 0; border-left: 4px solid #0c5460; border-radius: 5px; color: #0c5460; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${statusEmoji} Load Test Report</h1>
            <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.9;">Generated ${new Date().toLocaleString()}</p>
        </div>
        <div class="content">
            <div style="text-align: center; margin: 20px 0;">
                <span class="status-badge">Test Status: ${status}</span>
            </div>

            ${summary ? `
            <div class="metrics">
                <h3>📊 Test Metrics Summary</h3>
                <div class="summary-grid">
                    <div class="summary-card">
                        <h3>Total Requests</h3>
                        <div class="value">${summary.totalRequests.toLocaleString()}</div>
                    </div>
                    <div class="summary-card">
                        <h3>Total Failures</h3>
                        <div class="value" style="color: ${summary.totalFailures > 0 ? '#dc3545' : '#28a745'};">${summary.totalFailures.toLocaleString()}</div>
                    </div>
                    <div class="summary-card">
                        <h3>Failure Rate</h3>
                        <div class="value" style="color: ${failureRate > 5 ? '#dc3545' : '#28a745'};">${failureRate}%</div>
                    </div>
                    <div class="summary-card">
                        <h3>Avg Response Time</h3>
                        <div class="value" style="color: ${summary.avgResponseTime > 1000 ? '#dc3545' : '#28a745'};">${summary.avgResponseTime}ms</div>
                    </div>
                </div>
            </div>
            ` : ''}

            ${customBody ? `
            <div class="custom-body">
                <h3>📝 Test Analysis</h3>
                <div>${customBody.replace(/\n/g, '<br>')}</div>
            </div>
            ` : ''}

            <div class="attachment-note">
                <strong>📎 Attached Files:</strong><br>
                Complete HTML report with detailed metrics, graphs, and endpoint performance data.
            </div>

            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px;">
                This is an automated report from the PerformanceAI Load Testing Toolkit.<br>
                For questions or support, please contact your performance testing team.
            </p>
        </div>
        <div class="footer">
            <strong>PerformanceAI Toolkit</strong><br>
            Grafana • Prometheus • New Relic • Jenkins Integration<br>
            © ${new Date().getFullYear()} Performance Testing Team
        </div>
    </div>
</body>
</html>`;
    }
}

// Send email
async function sendEmail(config, args, summary) {
    try {
        // Create transporter
        const transporterConfig = {
            host: config.host,
            port: config.port,
            secure: config.secure || false,
            auth: {
                user: config.auth.user,
                pass: config.auth.pass
            }
        };

        // Add service if specified
        if (config.service) {
            transporterConfig.service = config.service;
        }

        const transporter = nodemailer.createTransport(transporterConfig);

        // Prepare attachments
        const attachments = [];

        // Add HTML report
        if (args.report && fs.existsSync(args.report)) {
            attachments.push({
                filename: path.basename(args.report),
                path: args.report
            });
        }

        // Add additional attachments
        for (const attachPath of args.attach) {
            if (fs.existsSync(attachPath)) {
                attachments.push({
                    filename: path.basename(attachPath),
                    path: attachPath
                });
            } else {
                console.warn(`Attachment not found: ${attachPath}`);
            }
        }

        // Generate email body
        const htmlBody = generateEmailBody(args.template, summary, args.body);

        // Email options
        const mailOptions = {
            from: config.from,
            to: args.to,
            subject: args.subject,
            html: htmlBody,
            attachments: attachments
        };

        // Add CC if specified
        if (args.cc) {
            mailOptions.cc = args.cc;
        }

        // Send email
        console.log('Sending email...');
        console.log(`To: ${args.to}`);
        if (args.cc) console.log(`CC: ${args.cc}`);
        console.log(`Subject: ${args.subject}`);
        console.log(`Attachments: ${attachments.length} file(s)`);

        const info = await transporter.sendMail(mailOptions);

        console.log('\n✅ Email sent successfully!');
        console.log(`Message ID: ${info.messageId}`);
        if (info.response) {
            console.log(`Server Response: ${info.response}`);
        }

        return true;
    } catch (error) {
        console.error('\n❌ Failed to send email:', error.message);
        if (error.code === 'EAUTH') {
            console.error('\nAuthentication failed. Please check your email credentials.');
            console.error('For Gmail: Make sure you are using an App Password, not your regular password.');
            console.error('Generate one at: https://myaccount.google.com/apppasswords');
        }
        throw error;
    }
}

// Main function
async function main() {
    const args = parseArgs();

    // Validate required arguments
    if (!args.to || !args.subject || !args.report) {
        console.error('❌ Missing required arguments!');
        console.error('\nRequired: --to, --subject, --report');
        console.error('Run with --help for usage information');
        process.exit(1);
    }

    // Check if report file exists
    if (!fs.existsSync(args.report)) {
        console.error(`❌ Report file not found: ${args.report}`);
        process.exit(1);
    }

    // Load email configuration
    const emailConfig = loadConfig(args.config);

    // Extract test summary
    console.log(`📄 Reading report: ${args.report}`);
    const summary = extractTestSummary(args.report);
    
    if (summary) {
        console.log(`\n📊 Test Summary:`);
        console.log(`   Requests: ${summary.totalRequests.toLocaleString()}`);
        console.log(`   Failures: ${summary.totalFailures.toLocaleString()}`);
        console.log(`   Avg Response: ${summary.avgResponseTime}ms`);
        const failureRate = ((summary.totalFailures / summary.totalRequests) * 100).toFixed(2);
        const status = summary.avgResponseTime > 1000 || failureRate > 5 ? 'FAIL' : 'PASS';
        console.log(`   Status: ${status}`);
    }

    // Send email
    await sendEmail(emailConfig, args, summary);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = {
    sendEmail,
    extractTestSummary,
    generateEmailBody
};
