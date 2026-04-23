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
        template: 'detailed',
        // Infrastructure details
        serviceName: null,
        pods: null,
        cpu: null,
        memory: null
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
            case '--service-name':
                args.serviceName = nextArg;
                i++;
                break;
            case '--pods':
                args.pods = nextArg;
                i++;
                break;
            case '--cpu':
                args.cpu = nextArg;
                i++;
                break;
            case '--memory':
                args.memory = nextArg;
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
  --service-name <name>  Service name being tested
  --pods <number>        Number of pods running
  --cpu <value>          CPU per pod (e.g., "3 cores" or "3000m")
  --memory <value>       Memory per pod (e.g., "3000 MB" or "3 GB")
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
            endpoints: [],
            failureRate: 0,
            // Test execution parameters
            users: 0,
            rampupRate: 0,
            duration: '',
            startTime: '',
            endTime: ''
        };

        // Extract data from window.templateArgs (Locust embeds data this way)
        const templateArgsMatch = html.match(/window\.templateArgs\s*=\s*/);
        if (templateArgsMatch) {
            try {
                // Find the complete JSON object by counting braces
                const startIdx = html.indexOf(templateArgsMatch[0]) + templateArgsMatch[0].length;
                let braceCount = 0;
                let endIdx = startIdx;
                let inString = false;
                let stringChar = '';
                
                for (let i = startIdx; i < html.length; i++) {
                    const char = html[i];
                    const prevChar = i > 0 ? html[i-1] : '';
                    
                    if ((char === '"' || char === "'") && prevChar !== '\\') {
                        if (!inString) {
                            inString = true;
                            stringChar = char;
                        } else if (char === stringChar) {
                            inString = false;
                        }
                    }
                    
                    if (!inString) {
                        if (char === '{') braceCount++;
                        else if (char === '}') braceCount--;
                        
                        if (braceCount === 0 && char === '}') {
                            endIdx = i + 1;
                            break;
                        }
                    }
                }
                
                const jsonStr = html.substring(startIdx, endIdx);
                const data = JSON.parse(jsonStr);
                
                // Extract from requests_statistics (Locust's actual field name)
                if (data.requests_statistics && Array.isArray(data.requests_statistics)) {
                    // Find the "Aggregated" row which contains total stats
                    const aggregated = data.requests_statistics.find(stat => stat.name === 'Aggregated');
                    if (aggregated) {
                        summary.totalRequests = aggregated.num_requests || 0;
                        summary.totalFailures = aggregated.num_failures || 0;
                        summary.avgResponseTime = Math.round(aggregated.avg_response_time || aggregated.median_response_time || 0);
                        summary.rps = parseFloat((aggregated.total_rps || aggregated.current_rps || 0).toFixed(2));
                        summary.failureRate = aggregated.num_requests > 0 
                            ? parseFloat(((aggregated.num_failures / aggregated.num_requests) * 100).toFixed(2))
                            : 0;
                    }
                    
                    // Extract individual endpoint stats (exclude Aggregated)
                    summary.endpoints = data.requests_statistics
                        .filter(stat => stat.name !== 'Aggregated')
                        .map(stat => ({
                            name: stat.name,
                            method: stat.method || 'GET',
                            requests: stat.num_requests || 0,
                            failures: stat.num_failures || 0,
                            avgTime: Math.round(stat.avg_response_time || 0),
                            medianTime: Math.round(stat.median_response_time || 0),
                            p90Time: Math.round(stat.response_time_percentile_0_90 || stat['response_time_percentile_0.90'] || 0),
                            p95Time: Math.round(stat.response_time_percentile_0_95 || stat['response_time_percentile_0.95'] || 0),
                            p99Time: Math.round(stat.response_time_percentile_0_99 || stat['response_time_percentile_0.99'] || 0),
                            rps: parseFloat((stat.total_rps || stat.current_rps || 0).toFixed(2))
                        }))
                        .sort((a, b) => b.requests - a.requests)
                        .slice(0, 10); // Top 10 endpoints
                }
                
                // Extract test duration/timestamps and execution parameters
                if (data.start_time) {
                    const startDate = new Date(data.start_time);
                    summary.startTime = startDate.toLocaleString();
                }
                if (data.end_time) {
                    const endDate = new Date(data.end_time);
                    summary.endTime = endDate.toLocaleString();
                }
                if (data.duration) {
                    summary.duration = typeof data.duration === 'string' ? data.duration : `${Math.round(data.duration)}s`;
                    summary.testDuration = summary.duration;
                }
                
                // Extract user count from history (peak concurrent users)
                if (data.history && Array.isArray(data.history) && data.history.length > 0) {
                    const userCounts = data.history
                        .filter(h => h.user_count && Array.isArray(h.user_count))
                        .map(h => h.user_count[1]);
                    if (userCounts.length > 0) {
                        summary.users = Math.max(...userCounts);
                        
                        // Calculate rampup rate (users/second) from first few history points
                        const firstNonZero = data.history.find(h => h.user_count && h.user_count[1] > 0);
                        const rampupPoint = data.history.find(h => h.user_count && h.user_count[1] > firstNonZero?.user_count[1]);
                        if (firstNonZero && rampupPoint) {
                            const timeDiff = (new Date(rampupPoint.time) - new Date(firstNonZero.time)) / 1000; // seconds
                            const userDiff = rampupPoint.user_count[1] - firstNonZero.user_count[1];
                            if (timeDiff > 0) {
                                summary.rampupRate = (userDiff / timeDiff).toFixed(2);
                            }
                        }
                    }
                }
                
            } catch (parseError) {
                console.warn('Could not parse templateArgs JSON:', parseError.message);
            }
        }

        // Fallback: Try to extract from HTML tables if JSON parsing failed
        if (summary.totalRequests === 0) {
            // Look for table data using more specific patterns
            const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
            if (tableMatch) {
                const tableContent = tableMatch[1];
                
                // Try to find Aggregated row in table
                const aggregatedMatch = tableContent.match(/Aggregated[^<]*<\/td>\s*<td[^>]*>(\d+(?:,\d+)*)<\/td>\s*<td[^>]*>(\d+(?:,\d+)*)<\/td>/);
                if (aggregatedMatch) {
                    summary.totalRequests = parseInt(aggregatedMatch[1].replace(/,/g, ''), 10);
                    summary.totalFailures = parseInt(aggregatedMatch[2].replace(/,/g, ''), 10);
                    summary.failureRate = summary.totalRequests > 0
                        ? parseFloat(((summary.totalFailures / summary.totalRequests) * 100).toFixed(2))
                        : 0;
                }
            }
        }

        console.log('\n📊 Extracted Test Summary:');
        console.log(`   Requests: ${summary.totalRequests.toLocaleString()}`);
        console.log(`   Failures: ${summary.totalFailures} (${summary.failureRate}%)`);
        console.log(`   Avg Response: ${summary.avgResponseTime}ms`);
        if (summary.users > 0) {
            console.log(`   Users: ${summary.users} concurrent`);
        }
        if (summary.duration) {
            console.log(`   Duration: ${summary.duration}`);
        }
        if (summary.endpoints.length > 0) {
            console.log(`   Endpoints: ${summary.endpoints.length} tracked`);
        }

        return summary;
    } catch (error) {
        console.warn('⚠️  Could not extract test summary from HTML:', error.message);
        return {
            totalRequests: 0,
            totalFailures: 0,
            avgResponseTime: 0,
            rps: 0,
            testDuration: '',
            endpoints: [],
            failureRate: 0,
            users: 0,
            rampupRate: 0,
            duration: '',
            startTime: '',
            endTime: ''
        };
    }
}

// Generate HTML email body
function generateEmailBody(template, summary, customBody, infraDetails) {
    const failureRate = summary ? ((summary.totalFailures / summary.totalRequests) * 100).toFixed(2) : 0;
    const status = summary && (summary.avgResponseTime > 1000 || failureRate > 5) ? 'FAIL' : 'PASS';
    const statusColor = status === 'PASS' ? '#10b981' : '#ef4444';
    const statusBg = status === 'PASS' ? '#d1fae5' : '#fee2e2';
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
        // Professional Enterprise Template
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #1f2937; 
            background-color: #f3f4f6;
            padding: 20px;
        }
        .email-wrapper { 
            max-width: 900px; 
            margin: 0 auto; 
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        
        /* Header Styles */
        .header { 
            background: linear-gradient(135deg, #1e40af 0%, #7c3aed 50%, #db2777 100%);
            color: white; 
            padding: 40px 30px;
            position: relative;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJhIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0wIDQwTDQwIDBaTTQwIDQwTDAgMDBaIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjYSkiLz48L3N2Zz4=');
            opacity: 0.15;
        }
        .header-content { position: relative; z-index: 1; }
        .header h1 { 
            font-size: 32px; 
            font-weight: 700;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        .header-meta { 
            font-size: 14px; 
            opacity: 0.9;
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        .header-meta-item {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        /* Status Badge */
        .status-section {
            background: #f9fafb;
            padding: 24px 30px;
            border-bottom: 1px solid #e5e7eb;
            text-align: center;
        }
        .status-badge { 
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px; 
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            background: ${statusBg};
            color: ${statusColor};
            border: 2px solid ${statusColor};
        }
        
        /* Main Content */
        .content { padding: 30px; }
        
        /* Executive Summary */
        .executive-summary {
            background: linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%);
            padding: 24px;
            border-radius: 8px;
            margin-bottom: 24px;
            border: 1px solid #ddd6fe;
        }
        .executive-summary h2 {
            color: #4c1d95;
            font-size: 18px;
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* Metrics Grid */
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px; 
            margin: 24px 0;
        }
        .metric-card { 
            background: #ffffff;
            padding: 20px; 
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .metric-label { 
            font-size: 12px; 
            color: #6b7280; 
            text-transform: uppercase; 
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .metric-value { 
            font-size: 28px; 
            font-weight: 700; 
            color: #111827;
            line-height: 1.2;
        }
        .metric-unit {
            font-size: 14px;
            color: #6b7280;
            font-weight: 400;
        }
        .metric-trend {
            font-size: 12px;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #f3f4f6;
            color: #6b7280;
        }
        
        /* Section Headers */
        .section { 
            margin: 32px 0; 
        }
        .section-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e5e7eb;
        }
        .section-title { 
            font-size: 20px;
            font-weight: 700;
            color: #111827;
            margin: 0;
        }
        .section-icon {
            font-size: 24px;
        }
        
        /* Analysis Box */
        .analysis-box { 
            background: #fffbeb;
            padding: 24px; 
            border-left: 4px solid #f59e0b;
            border-radius:0 8px 8px 0;
            margin: 20px 0;
        }
        .analysis-box h3 { 
            color: #92400e;
            font-size: 16px;
            margin-bottom: 12px;
            font-weight: 600;
        }
        .analysis-box p {
            color: #78350f;
            line-height: 1.8;
            margin: 8px 0;
        }
        
        /* Data Table */
        .data-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin: 16px 0;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
        }
        .data-table thead {
            background: #f9fafb;
        }
        .data-table th {
            padding: 12px 16px;
            text-align: left;
            font-weight: 600;
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid #e5e7eb;
        }
        .data-table td {
            padding: 12px 16px;
            border-bottom: 1px solid #f3f4f6;
            color: #374151;
        }
        .data-table tbody tr:last-child td {
            border-bottom: none;
        }
        .data-table tbody tr:hover {
            background: #f9fafb;
        }
        
        /* Info Cards */
        .info-card {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 20px;
            margin: 16px 0;
        }
        .info-card-title {
            font-weight: 600;
            color: #0c4a6e;
            margin-bottom: 12px;
            font-size: 16px;
        }
        .info-card-content {
            color: #075985;
            line-height: 1.8;
        }
        
        /* Issue Badge */
        .issue-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .issue-critical { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .issue-warning { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
        .issue-info { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
        
        /* Attachment Section */
        .attachment-section { 
            background: #ecfdf5;
            padding: 20px; 
            border-left: 4px solid #10b981;
            border-radius: 0 8px 8px 0;
            margin: 24px 0;
        }
        .attachment-title {
            font-weight: 600;
            color: #065f46;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .attachment-description {
            color: #047857;
            font-size: 14px;
        }
        
        /* Footer */
        .footer { 
            background: #f9fafb;
            padding: 24px 30px;
            text-align: center;
            font-size: 13px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
        }
        .footer-brand {
            font-weight: 600;
            color: #111827;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .footer-tech {
            color: #9ca3af;
            margin: 8px 0;
        }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .email-wrapper { border-radius: 0; }
            .header { padding: 30px 20px; }
            .content { padding: 20px; }
            .metrics-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 24px; }
            .metric-value { font-size: 24px; }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <!-- Header -->
        <div class="header">
            <div class="header-content">
                <h1>${statusEmoji} Load Test Performance Report</h1>
                <div class="header-meta">
                    <span class="header-meta-item">📅 ${new Date().toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    })}</span>
                    <span class="header-meta-item">🕐 ${new Date().toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit'
                    })}</span>
                </div>
            </div>
        </div>
        
        <!-- Status Section -->
        <div class="status-section">
            <div class="status-badge">
                <span>${statusEmoji}</span>
                <span>Test Status: ${status}</span>
            </div>
        </div>
        
        <!-- Main Content -->
        <div class="content">
            ${infraDetails && (infraDetails.serviceName || infraDetails.pods || infraDetails.cpu || infraDetails.memory) ? `
            <!-- Infrastructure Configuration -->
            <div class="info-card" style="background: #fef3c7; border-color: #fcd34d; margin-bottom: 24px;">
                <div class="info-card-title" style="color: #92400e; display: flex; align-items: center; gap: 8px;">
                    <span>🏗️</span>
                    <span>Infrastructure Configuration</span>
                </div>
                <div class="info-card-content" style="color: #78350f;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                        ${infraDetails.serviceName ? `
                        <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #fde68a;">
                            <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Service Name</div>
                            <div style="font-size: 18px; font-weight: 700; color: #78350f; font-family: 'Courier New', monospace;">${infraDetails.serviceName}</div>
                        </div>
                        ` : ''}
                        ${infraDetails.pods ? `
                        <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #fde68a;">
                            <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Pods Running</div>
                            <div style="font-size: 24px; font-weight: 700; color: #78350f;">${infraDetails.pods} <span style="font-size: 14px; color: #b45309;">pods</span></div>
                        </div>
                        ` : ''}
                        ${infraDetails.cpu ? `
                        <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #fde68a;">
                            <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">CPU per Pod</div>
                            <div style="font-size: 24px; font-weight: 700; color: #78350f;">${infraDetails.cpu}</div>
                        </div>
                        ` : ''}
                        ${infraDetails.memory ? `
                        <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #fde68a;">
                            <div style="font-size: 11px; color: #92400e; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Memory per Pod</div>
                            <div style="font-size: 24px; font-weight: 700; color: #78350f;">${infraDetails.memory}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ` : ''}
            ${summary && (summary.users > 0 || summary.duration) ? `
            <!-- Test Configuration -->
            <div class="info-card" style="background: #f0fdf4; border-color: #bbf7d0; margin-bottom: 24px;">
                <div class="info-card-title" style="color: #065f46; display: flex; align-items: center; gap: 8px;">
                    <span>⚙️</span>
                    <span>Test Configuration</span>
                </div>
                <div class="info-card-content" style="color: #047857;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
                        ${summary.users > 0 ? `
                        <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
                            <div style="font-size: 11px; color: #047857; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Concurrent Users</div>
                            <div style="font-size: 24px; font-weight: 700; color: #065f46;">${summary.users.toLocaleString()}</div>
                        </div>
                        ` : ''}
                        ${summary.rampupRate > 0 ? `
                        <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
                            <div style="font-size: 11px; color: #047857; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Ramp-up Rate</div>
                            <div style="font-size: 24px; font-weight: 700; color: #065f46;">${summary.rampupRate} <span style="font-size: 14px; color: #059669;">users/sec</span></div>
                        </div>
                        ` : ''}
                        ${summary.duration ? `
                        <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
                            <div style="font-size: 11px; color: #047857; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Test Duration</div>
                            <div style="font-size: 24px; font-weight: 700; color: #065f46;">${summary.duration}</div>
                        </div>
                        ` : ''}
                        ${summary.startTime ? `
                        <div style="padding: 12px; background: white; border-radius: 6px; border: 1px solid #d1fae5;">
                            <div style="font-size: 11px; color: #047857; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">Test Period</div>
                            <div style="font-size: 11px; color: #065f46; line-height: 1.6;">
                                <div><strong>Start:</strong> ${summary.startTime}</div>
                                ${summary.endTime ? `<div><strong>End:</strong> ${summary.endTime}</div>` : ''}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            ` : ''}
            ${summary ? `
            <!-- Executive Summary -->
            <div class="executive-summary">
                <h2>📊 Executive Summary</h2>
                <p style="color: #6b46c1; margin: 0; line-height: 1.8;">
                    The load test processed <strong>${summary.totalRequests.toLocaleString()} requests</strong> 
                    with an average response time of <strong>${summary.avgResponseTime}ms</strong> 
                    and a failure rate of <strong>${failureRate}%</strong>. 
                    ${failureRate <= 1 ? 'System performance is excellent.' : failureRate <= 5 ? 'System performance is acceptable.' : 'System requires immediate attention.'}
                </p>
            </div>
            
            <!-- Key Metrics Grid -->
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Total Requests</div>
                    <div class="metric-value">${(summary.totalRequests / 1000).toFixed(1)}<span class="metric-unit">K</span></div>
                    <div class="metric-trend">Over test duration</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Failures</div>
                    <div class="metric-value" style="color: ${summary.totalFailures > 0 ? '#ef4444' : '#10b981'};">
                        ${summary.totalFailures.toLocaleString()}
                    </div>
                    <div class="metric-trend">Failure rate: ${failureRate}%</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Response Time</div>
                    <div class="metric-value" style="color: ${summary.avgResponseTime > 1000 ? '#ef4444' : summary.avgResponseTime > 500 ? '#f59e0b' : '#10b981'};">
                        ${summary.avgResponseTime}<span class="metric-unit">ms</span>
                    </div>
                    <div class="metric-trend">SLA: <1000ms</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Throughput (RPS)</div>
                    <div class="metric-value">${summary.rps ? summary.rps.toFixed(0) : 'N/A'}</div>
                    <div class="metric-trend">Requests per second</div>
                </div>
            </div>
            ` : ''}
            
            ${summary && summary.endpoints && summary.endpoints.length > 0 ? `
            <!-- Top Endpoints Performance -->
            <div class="section">
                <div class="section-header">
                    <span class="section-icon">🎯</span>
                    <h2 class="section-title">Top ${summary.endpoints.length} Endpoints</h2>
                </div>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 15px;">
                        <thead>
                            <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Endpoint</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Method</th>
                                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Requests</th>
                                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Failures</th>
                                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Avg (ms)</th>
                                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">P90 (ms)</th>
                                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">P95 (ms)</th>
                                <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">RPS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${summary.endpoints.map((endpoint, idx) => {
                                const failRate = endpoint.requests > 0 ? ((endpoint.failures / endpoint.requests) * 100).toFixed(1) : 0;
                                const failColor = endpoint.failures === 0 ? '#10b981' : failRate < 1 ? '#f59e0b' : '#ef4444';
                                const avgColor = endpoint.avgTime < 500 ? '#10b981' : endpoint.avgTime < 1000 ? '#f59e0b' : '#ef4444';
                                const p90Color = endpoint.p90Time < 500 ? '#10b981' : endpoint.p90Time < 1000 ? '#f59e0b' : '#ef4444';
                                const p95Color = endpoint.p95Time < 500 ? '#10b981' : endpoint.p95Time < 1000 ? '#f59e0b' : '#ef4444';
                                const methodColor = endpoint.method === 'GET' ? '#3b82f6' : endpoint.method === 'POST' ? '#10b981' : '#8b5cf6';
                                
                                return `
                                <tr style="border-bottom: 1px solid #f3f4f6; ${idx % 2 === 0 ? 'background: #fafafa;' : ''}">
                                    <td style="padding: 12px; color: #111827; font-family: 'Courier New', monospace; font-size: 12px;">
                                        ${endpoint.name.length > 50 ? endpoint.name.substring(0, 47) + '...' : endpoint.name}
                                    </td>
                                    <td style="padding: 12px; text-align: center;">
                                        <span style="background: ${methodColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">
                                            ${endpoint.method}
                                        </span>
                                    </td>
                                    <td style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">
                                        ${endpoint.requests.toLocaleString()}
                                    </td>
                                    <td style="padding: 12px; text-align: right;">
                                        <span style="color: ${failColor}; font-weight: 600;">
                                            ${endpoint.failures}
                                        </span>
                                        <span style="color: #9ca3af; font-size: 11px; margin-left: 4px;">
                                            (${failRate}%)
                                        </span>
                                    </td>
                                    <td style="padding: 12px; text-align: right; font-weight: 600; color: ${avgColor};">
                                        ${endpoint.avgTime}
                                    </td>
                                    <td style="padding: 12px; text-align: right; font-weight: 600; color: ${p90Color};">
                                        ${endpoint.p90Time}
                                    </td>
                                    <td style="padding: 12px; text-align: right; font-weight: 600; color: ${p95Color};">
                                        ${endpoint.p95Time}
                                    </td>
                                    <td style="padding: 12px; text-align: right; color: #6b7280;">
                                        ${endpoint.rps.toFixed(1)}
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
            
            ${customBody ? `
            <!-- Detailed Analysis -->
            <div class="section">
                <div class="section-header">
                    <span class="section-icon">📝</span>
                    <h2 class="section-title">Detailed Analysis</h2>
                </div>
                <div class="analysis-box">
                    <div class="analysis-content">${customBody.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>
                </div>
            </div>
            ` : ''}
            
            <!-- Attachments -->
            <div class="attachment-section">
                <div class="attachment-title">📎 Attached Files</div>
                <div class="attachment-description">
                    Complete HTML report with detailed metrics, performance graphs, endpoint analysis, and historical data.
                </div>
            </div>
            
            <!-- Info Card -->
            <div class="info-card">
                <div class="info-card-title">ℹ️ About this Report</div>
                <div class="info-card-content">
                    This automated performance report was generated by the PerformanceAI Load Testing Toolkit. 
                    The data includes comprehensive metrics from load testing tools, infrastructure monitoring, 
                    and application performance monitoring systems. For questions or detailed analysis, 
                    please contact your performance engineering team.
                </div>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="footer-brand">⚡ PerformanceAI Toolkit</div>
            <div class="footer-tech">Integrated with Grafana • Prometheus • New Relic • Jenkins</div>
            <div style="margin-top: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} Performance Testing Team | All rights reserved
            </div>
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

        // Prepare infrastructure details
        const infraDetails = {
            serviceName: args.serviceName,
            pods: args.pods,
            cpu: args.cpu,
            memory: args.memory
        };

        // Generate email body
        const htmlBody = generateEmailBody(args.template, summary, args.body, infraDetails);

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
    generateEmailBody,
    parseArgs
};
