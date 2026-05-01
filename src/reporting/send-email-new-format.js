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

// Function to read emails from CSV file
function readStakeholdersFromCSV(csvPath) {
    try {
        if (!fs.existsSync(csvPath)) {
            return [];
        }
        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        const emails = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (i === 0 && (line.toLowerCase().includes('email') || line.toLowerCase().includes('name'))) {
                continue;
            }
            const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
            const email = parts.find(p => p.includes('@'));
            if (email && email.includes('@')) {
                emails.push(email);
            }
        }
        return emails;
    } catch (error) {
        console.warn(`⚠️  Could not read stakeholders CSV (${csvPath}):`, error.message);
        return [];
    }
}

// Parse command line arguments
function parseArgs() {
    const args = {
        to: null,
        cc: null,
        subject: null,
        report: null,
        body: '',
        attach: [],
        config: 'config/config.json',
        template: 'detailed',
        stakeholdersCsv: 'config/stakeholder-email.csv',
        serviceName: null,
        pods: null,
        cpu: null,
        memory: null
    };

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        const nextArg = process.argv[i + 1];
        switch (arg) {
            case '--to': args.to = nextArg; i++; break;
            case '--cc': args.cc = nextArg; i++; break;
            case '--subject': args.subject = nextArg; i++; break;
            case '--report': args.report = nextArg; i++; break;
            case '--body': args.body = nextArg; i++; break;
            case '--attach': args.attach = nextArg.split(',').map(p => p.trim()); i++; break;
            case '--config': args.config = nextArg; i++; break;
            case '--template': args.template = nextArg; i++; break;
            case '--service-name': args.serviceName = nextArg; i++; break;
            case '--pods': args.pods = nextArg; i++; break;
            case '--cpu': args.cpu = nextArg; i++; break;
            case '--memory': args.memory = nextArg; i++; break;
            case '--stakeholders-csv': args.stakeholdersCsv = nextArg; i++; break;
            case '--help': case '-h': printHelp(); process.exit(0);
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
  --stakeholders-csv <path>  Path to CSV with stakeholder emails (default: stakeholder-email.csv)
  --help, -h             Show this help message
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
        process.exit(1);
    }
}

// Extract test summary from HTML report
function extractTestSummary(htmlPath) {
    try {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const summary = {
            totalRequests: 0, totalFailures: 0, avgResponseTime: 0,
            rps: 0, testDuration: '', endpoints: [], failureRate: 0,
            users: 0, rampupRate: 0, duration: '', startTime: '', endTime: ''
        };

        const templateArgsMatch = html.match(/window\.templateArgs\s*=\s*/);
        if (templateArgsMatch) {
            try {
                const startIdx = html.indexOf(templateArgsMatch[0]) + templateArgsMatch[0].length;
                let braceCount = 0, endIdx = startIdx, inString = false, stringChar = '';
                for (let i = startIdx; i < html.length; i++) {
                    const char = html[i];
                    const prevChar = i > 0 ? html[i-1] : '';
                    if ((char === '"' || char === "'") && prevChar !== '\\') {
                        if (!inString) { inString = true; stringChar = char; }
                        else if (char === stringChar) { inString = false; }
                    }
                    if (!inString) {
                        if (char === '{') braceCount++;
                        else if (char === '}') braceCount--;
                        if (braceCount === 0 && char === '}') { endIdx = i + 1; break; }
                    }
                }
                const data = JSON.parse(html.substring(startIdx, endIdx));

                const percentileMap = new Map();
                if (data.response_time_statistics && Array.isArray(data.response_time_statistics)) {
                    data.response_time_statistics.forEach(stat => {
                        percentileMap.set(stat.name, {
                            p90: stat['0.9'] || stat['0.90'] || 0,
                            p95: stat['0.95'] || 0,
                            p99: stat['0.99'] || 0,
                        });
                    });
                }

                if (data.requests_statistics && Array.isArray(data.requests_statistics)) {
                    const aggregated = data.requests_statistics.find(stat => stat.name === 'Aggregated');
                    if (aggregated) {
                        summary.totalRequests = aggregated.num_requests || 0;
                        summary.totalFailures = aggregated.num_failures || 0;
                        summary.avgResponseTime = Math.round(aggregated.avg_response_time || aggregated.median_response_time || 0);
                        summary.rps = parseFloat((aggregated.total_rps || aggregated.current_rps || 0).toFixed(2));
                        summary.failureRate = aggregated.num_requests > 0
                            ? parseFloat(((aggregated.num_failures / aggregated.num_requests) * 100).toFixed(2)) : 0;
                    }
                    summary.endpoints = data.requests_statistics
                        .filter(stat => stat.name !== 'Aggregated')
                        .map(stat => {
                            const percentiles = percentileMap.get(stat.name) || { p90: 0, p95: 0, p99: 0 };
                            return {
                                name: stat.name, method: stat.method || 'GET',
                                requests: stat.num_requests || 0, failures: stat.num_failures || 0,
                                avgTime: Math.round(stat.avg_response_time || 0),
                                medianTime: Math.round(stat.median_response_time || 0),
                                p90Time: Math.round(percentiles.p90) || 0,
                                p95Time: Math.round(percentiles.p95) || 0,
                                p99Time: Math.round(percentiles.p99) || 0,
                                rps: parseFloat((stat.total_rps || stat.current_rps || 0).toFixed(2))
                            };
                        })
                        .sort((a, b) => b.requests - a.requests)
                        .slice(0, 10);
                }

                if (data.start_time) summary.startTime = new Date(data.start_time).toLocaleString();
                if (data.end_time) summary.endTime = new Date(data.end_time).toLocaleString();
                if (data.duration) {
                    summary.duration = typeof data.duration === 'string' ? data.duration : `${Math.round(data.duration)}s`;
                    summary.testDuration = summary.duration;
                }
                if (data.history && Array.isArray(data.history) && data.history.length > 0) {
                    const userCounts = data.history.filter(h => h.user_count && Array.isArray(h.user_count)).map(h => h.user_count[1]);
                    if (userCounts.length > 0) {
                        summary.users = Math.max(...userCounts);
                        const firstNonZero = data.history.find(h => h.user_count && h.user_count[1] > 0);
                        const rampupPoint = data.history.find(h => h.user_count && h.user_count[1] > firstNonZero?.user_count[1]);
                        if (firstNonZero && rampupPoint) {
                            const timeDiff = (new Date(rampupPoint.time) - new Date(firstNonZero.time)) / 1000;
                            const userDiff = rampupPoint.user_count[1] - firstNonZero.user_count[1];
                            if (timeDiff > 0) summary.rampupRate = (userDiff / timeDiff).toFixed(2);
                        }
                    }
                }
            } catch (parseError) {
                console.warn('Could not parse templateArgs JSON:', parseError.message);
            }
        }

        if (summary.totalRequests === 0) {
            const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/);
            if (tableMatch) {
                const aggregatedMatch = tableMatch[1].match(/Aggregated[^<]*<\/td>\s*<td[^>]*>(\d+(?:,\d+)*)<\/td>\s*<td[^>]*>(\d+(?:,\d+)*)<\/td>/);
                if (aggregatedMatch) {
                    summary.totalRequests = parseInt(aggregatedMatch[1].replace(/,/g, ''), 10);
                    summary.totalFailures = parseInt(aggregatedMatch[2].replace(/,/g, ''), 10);
                    summary.failureRate = summary.totalRequests > 0
                        ? parseFloat(((summary.totalFailures / summary.totalRequests) * 100).toFixed(2)) : 0;
                }
            }
        }

        console.log('\n📊 Extracted Test Summary:');
        console.log(`   Requests: ${summary.totalRequests.toLocaleString()}`);
        console.log(`   Failures: ${summary.totalFailures} (${summary.failureRate}%)`);
        console.log(`   Avg Response: ${summary.avgResponseTime}ms`);
        if (summary.users > 0) console.log(`   Users: ${summary.users} concurrent`);
        if (summary.duration) console.log(`   Duration: ${summary.duration}`);
        if (summary.endpoints.length > 0) console.log(`   Endpoints: ${summary.endpoints.length} tracked`);

        return summary;
    } catch (error) {
        console.warn('⚠️  Could not extract test summary from HTML:', error.message);
        return { totalRequests: 0, totalFailures: 0, avgResponseTime: 0, rps: 0, testDuration: '', endpoints: [], failureRate: 0, users: 0, rampupRate: 0, duration: '', startTime: '', endTime: '' };
    }
}

// Generate HTML email body
function generateEmailBody(template, summary, customBody, infraDetails) {
    const failureRate = summary && summary.totalRequests > 0
        ? ((summary.totalFailures / summary.totalRequests) * 100).toFixed(2) : '0.00';

    const SLA_THRESHOLD = 1000;
    const ERROR_THRESHOLD = 5;
    const avgViolation   = summary && summary.avgResponseTime > SLA_THRESHOLD;
    const errorViolation = parseFloat(failureRate) > ERROR_THRESHOLD;
    const p90Violations  = summary && summary.endpoints ? summary.endpoints.filter(e => e.p90Time > SLA_THRESHOLD) : [];
    const p95Violations  = summary && summary.endpoints ? summary.endpoints.filter(e => e.p95Time > SLA_THRESHOLD) : [];
    const status = (avgViolation || errorViolation || p90Violations.length > 0 || p95Violations.length > 0) ? 'FAIL' : 'PASS';
    const isPass = status === 'PASS';

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const year    = new Date().getFullYear();

    // Color helpers
    const colorAvg  = (ms) => ms < 500 ? '#16a34a' : ms < 1000 ? '#d97706' : '#dc2626';
    const colorFail = (n)  => n === 0  ? '#16a34a' : '#dc2626';
    const colorP    = (ms) => ms < 500 ? '#16a34a' : ms < 1000 ? '#d97706' : '#dc2626';
    const methodBg  = (m)  => ({ GET: '#3b82f6', POST: '#10b981', PUT: '#f59e0b', DELETE: '#ef4444' }[m] || '#64748b');

    // ── BASIC template ────────────────────────────────────────────────────────
    if (template === 'basic') {
        return `<!DOCTYPE html>
<html>
<head>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;padding:20px;color:#1e293b;}
  .wrap{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;}
  .hdr{background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3b82f6 100%);color:#fff;padding:28px 32px;}
  .hdr h1{font-size:22px;font-weight:700;margin:0 0 6px;}
  .hdr-date{font-size:13px;opacity:.85;}
  .body{padding:28px 32px;}
  .badge{display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:20px;font-weight:700;font-size:14px;background:${isPass?'#dcfce7':'#fee2e2'};color:${isPass?'#15803d':'#dc2626'};border:2px solid ${isPass?'#86efac':'#fca5a5'};}
  .body-text{background:#f8fafc;border-radius:8px;padding:16px 20px;border-left:4px solid #3b82f6;font-size:14px;color:#475569;line-height:1.7;margin-top:16px;}
  .footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;}
  .no-reply{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 16px;color:#92400e;font-weight:600;font-size:12px;margin-bottom:10px;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>🚀 Load Test Performance Report</h1>
    <div class="hdr-date">📅 ${dateStr} at ${timeStr}</div>
  </div>
  <div class="body">
    <div style="margin-bottom:16px;">
      <span style="font-weight:600;color:#374151;margin-right:10px;">Test Status:</span>
      <span class="badge">${isPass?'✅':'❌'} ${status}</span>
    </div>
    ${customBody ? `<div class="body-text">${customBody.replace(/\n/g,'<br>')}</div>` : ''}
    <p style="margin-top:16px;color:#64748b;font-size:14px;">Please find the detailed load test report attached to this email.</p>
  </div>
  <div class="footer">
    <div class="no-reply">⚠️ This is an automated email. Please do not reply to this message.</div>
    Generated by PerformanceAI Toolkit &nbsp;|&nbsp; ${dateStr}
  </div>
</div>
</body>
</html>`;
    }

    // ── DETAILED template (card-based, matches reference image) ──────────────
    const introText = isPass
        ? "We're pleased to share the results of the recent load test execution. The system performed within expected thresholds and met all performance objectives."
        : "The load test has completed. Please review the results below — one or more SLA thresholds were breached and require immediate attention.";

    const execText = summary
        ? `The load test processed <strong>${summary.totalRequests.toLocaleString()} requests</strong> with an average response time of <strong>${summary.avgResponseTime}ms</strong> and a failure rate of <strong>${failureRate}%</strong>. ${parseFloat(failureRate) <= 1 ? 'System performance is excellent.' : parseFloat(failureRate) <= 5 ? 'System performance is acceptable.' : 'System requires immediate attention.'}`
        : 'No summary data was extracted from the report.';

    const hasInfra = infraDetails && (infraDetails.serviceName || infraDetails.pods || infraDetails.cpu || infraDetails.memory);
    const hasConfig = summary && (summary.users > 0 || summary.duration);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Load Test Performance Report</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);color:#1e293b;padding:32px 20px;}
  .wrap{max-width:920px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);}

  /* Header */
  .hdr{background:linear-gradient(135deg,#1e40af 0%,#3b82f6 50%,#60a5fa 100%);padding:48px 40px;display:flex;align-items:center;justify-content:space-between;gap:20px;position:relative;overflow:hidden;}
  .hdr::before{content:'';position:absolute;top:-50%;right:-10%;width:400px;height:400px;background:radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);border-radius:50%;}
  .hdr::after{content:'';position:absolute;bottom:-50%;left:-10%;width:300px;height:300px;background:radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, transparent 70%);border-radius:50%;}
  .hdr-left{display:flex;align-items:center;gap:16px;position:relative;z-index:1;}
  .hdr-icon{width:52px;height:52px;background:rgba(255,255,255,.18);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;}
  .hdr-text h1{font-size:28px;font-weight:700;color:#fff;letter-spacing:-.5px;text-shadow:0 2px 4px rgba(0, 0, 0, 0.1);margin-bottom:12px;}
  .hdr-date{font-size:15px;color:rgba(255,255,255,.95);display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
  .hdr-badge{background:#fff;border-radius:12px;padding:16px 24px;text-align:center;flex-shrink:0;position:relative;z-index:1;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.1);}
  .badge-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:6px;}
  .badge-status{font-size:20px;font-weight:800;color:${isPass?'#16a34a':'#dc2626'};display:flex;align-items:center;gap:8px;justify-content:center;}
  .badge-check{width:24px;height:24px;border-radius:50%;background:${isPass?'#dcfce7':'#fee2e2'};border:3px solid ${isPass?'#86efac':'#fca5a5'};display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 4px rgba(0,0,0,0.1);}

  /* Greeting */
  .greeting{padding:32px 40px;border-bottom:2px solid #e5e7eb;background:linear-gradient(to right, #f8fafc 0%, #ffffff 50%, #f8fafc 100%);}
  .greeting h2{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:12px;}
  .greeting p{font-size:15px;color:#475569;line-height:1.8;}

  /* Body */
  .body{padding:40px;}

  /* Generic card */
  .card{background:linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);border:2px solid #e5e7eb;border-radius:12px;padding:24px;height:100%;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05);transition:all 0.3s ease;}
  .card:hover{transform:translateY(-2px);box-shadow:0 10px 15px -3px rgba(0, 0, 0, 0.1);border-color:#3b82f6;}
  .card-title{display:flex;align-items:center;gap:12px;font-size:16px;font-weight:700;margin-bottom:18px;}
  .ci{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;box-shadow:0 2px 4px rgba(0,0,0,0.05);}

  /* Infra rows */
  .ir{margin-bottom:16px;}
  .ir:last-child{margin-bottom:0;}
  .ir-label{font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
  .ir-value{font-size:16px;font-weight:700;color:#0f172a;font-family:'Courier New',monospace;}
  .ir-value.lg{font-size:20px;font-family:inherit;}
  .divider{height:2px;background:#e5e7eb;margin:16px 0;}

  /* Config rows */
  .cr{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #e5e7eb;}
  .cr:last-child{border-bottom:none;}
  .cr-label{font-size:14px;color:#64748b;font-weight:500;}
  .cr-value{font-size:15px;font-weight:700;color:#0f172a;text-align:right;}
  .cr-value.sm{font-size:13px;line-height:1.7;}

  /* Executive summary */
  .exec{background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);border:2px solid #bfdbfe;border-radius:12px;padding:32px;margin-bottom:32px;box-shadow:0 4px 6px -1px rgba(59, 130, 246, 0.1);}
  .exec-text{font-size:15px;color:#1e40af;line-height:1.8;margin-bottom:24px;}

  /* Metric boxes */
  .mbox{border:2px solid #e5e7eb;border-radius:12px;padding:20px;background:linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);transition:all 0.3s ease;position:relative;overflow:hidden;}
  .mbox::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%;}
  .mbox.blue::before{background:linear-gradient(180deg, #3b82f6 0%, #60a5fa 100%);}
  .mbox.red::before{background:linear-gradient(180deg, #ef4444 0%, #f87171 100%);}
  .mbox.green::before{background:linear-gradient(180deg, #10b981 0%, #34d399 100%);}
  .mbox.purple::before{background:linear-gradient(180deg, #8b5cf6 0%, #a78bfa 100%);}
  .mbox:hover{transform:translateY(-4px);box-shadow:0 20px 25px -5px rgba(0, 0, 0, 0.1);border-color:#3b82f6;}
  .m-name{font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;}
  .m-num{font-size:26px;font-weight:700;color:#0f172a;line-height:1;margin-bottom:8px;}
  .m-sub{font-size:13px;color:#64748b;font-weight:500;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;}

  /* Endpoints */
  .ep-wrap{background:#fff;border:2px solid #e5e7eb;border-radius:12px;overflow:hidden;margin:40px 0;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05);}
  .ep-hdr{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:2px solid #e5e7eb;background:linear-gradient(to right, #f8fafc 0%, transparent 100%);}
  .ep-hdr-left{display:flex;align-items:center;gap:12px;font-size:16px;font-weight:700;color:#0f172a;}
  .ep-hdr-right{font-size:13px;color:#3b82f6;font-weight:600;}
  .ep-table{width:100%;border-collapse:collapse;font-size:14px;}
  .ep-table th{padding:16px 18px;text-align:left;font-size:13px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.8px;background:linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);border-bottom:none;}
  .ep-table th.r,.ep-table td.r{text-align:right;}
  .ep-table td{padding:16px 18px;border-bottom:1px solid #f1f5f9;color:#334155;vertical-align:middle;}
  .ep-table tr:last-child td{border-bottom:none;}
  .ep-table tr:hover td{background:linear-gradient(to right, #f8fafc 0%, #ffffff 100%);transition:background 0.2s;}
  .ep-name{font-family:'Courier New',monospace;font-size:13px;color:#0f172a;font-weight:500;}
  .mbadge{display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;color:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);}
  .ep-note{padding:12px 24px;font-size:13px;color:#64748b;border-top:2px solid #e5e7eb;background:#f8fafc;}

  /* Analysis */
  .analysis{background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);border-left:5px solid #f59e0b;border-radius:0 12px 12px 0;padding:28px;margin:40px 0;box-shadow:0 4px 6px -1px rgba(245, 158, 11, 0.1);}
  .analysis h3{color:#92400e;font-size:18px;font-weight:700;margin-bottom:14px;}
  .analysis p{color:#78350f;font-size:15px;line-height:1.9;margin:10px 0;}

  /* Bottom cards */
  .attach-card{background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);border:2px solid #fcd34d;border-radius:12px;padding:24px;box-shadow:0 4px 6px -1px rgba(245, 158, 11, 0.1);}
  .attach-list{list-style:none;margin-bottom:16px;}
  .attach-list li{font-size:14px;color:#78350f;padding:6px 0 6px 20px;position:relative;line-height:1.6;}
  .attach-list li::before{content:'•';position:absolute;left:0;color:#d97706;font-size:18px;}
  .files-card{background:linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%);border:2px solid #34d399;border-radius:12px;padding:24px;box-shadow:0 4px 6px -1px rgba(16, 185, 129, 0.1);}
  .files-text{font-size:14px;color:#047857;line-height:1.8;margin-bottom:16px;}
  .chart-bars{background:#d1fae5;border-radius:8px;height:64px;display:flex;align-items:flex-end;padding:8px 12px;gap:6px;box-shadow:inset 0 2px 4px rgba(0,0,0,0.05);}
  .cbar{background:linear-gradient(180deg, #10b981 0%, #34d399 100%);border-radius:4px 4px 0 0;flex:1;box-shadow:0 2px 4px rgba(0,0,0,0.1);}
  .about-card{background:linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);border:2px solid #bfdbfe;border-radius:12px;padding:24px;box-shadow:0 4px 6px -1px rgba(59, 130, 246, 0.1);}
  .about-text{font-size:14px;color:#1e40af;line-height:1.8;}

  /* Footer */
  .footer{border-top:3px solid #cbd5e1;padding:32px 40px;text-align:center;background:linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);}
  .no-reply{background:linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);border:2px solid #fbbf24;border-radius:12px;padding:18px;margin-bottom:20px;box-shadow:0 2px 4px rgba(0,0,0,0.05);}
  .no-reply p{font-size:14px;color:#92400e;font-weight:700;margin-bottom:6px;}
  .no-reply span{display:block;font-size:13px;color:#78350f;font-weight:500;margin-top:6px;}
  .footer-brand{font-size:16px;font-weight:700;color:#0f172a;margin-bottom:10px;letter-spacing:-0.5px;}

  @media only screen and (max-width:600px){
    body{padding:16px;}
    .wrap{border-radius:12px;}
    .hdr{flex-direction:column;align-items:flex-start;padding:32px 24px;}
    .hdr-text h1{font-size:24px;}
    .greeting{padding:24px;}
    .body{padding:24px;}
    .footer{padding:24px;}
  }
</style>
</head>
<body>
<div class="wrap">

  <!-- HEADER -->
  <div class="hdr">
    <div class="hdr-left">
      <div class="hdr-icon">🚀</div>
      <div class="hdr-text">
        <h1>Load Test Performance Report</h1>
        <div class="hdr-date">📅 ${dateStr} at ${timeStr}</div>
      </div>
    </div>
    <div class="hdr-badge">
      <div class="badge-label">Test Status</div>
      <div class="badge-status">
        <div class="badge-check">${isPass ? '✓' : '✗'}</div>
        ${status}
      </div>
    </div>
  </div>

  <!-- GREETING -->
  <div class="greeting">
    <h2>Hello Team,</h2>
    <p>${introText}</p>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- Infrastructure + Test Configuration (side by side) -->
    ${hasInfra || hasConfig ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:16px;margin:-16px 0 8px;">
      <tr>
        <td width="50%" valign="top" style="padding:0 8px 0 0;">
          ${hasInfra ? `
          <div class="card">
            <div class="card-title" style="color:#1d4ed8;">
              <div class="ci" style="background:#dbeafe;color:#2563eb;">🖥</div>
              Infrastructure
            </div>
            ${infraDetails.serviceName ? `<div class="ir"><div class="ir-label">Service Name</div><div class="ir-value">${infraDetails.serviceName}</div></div><div class="divider"></div>` : ''}
            ${infraDetails.pods ? `<div class="ir"><div class="ir-label">Pods Running</div><div class="ir-value lg">${infraDetails.pods} <span style="font-size:14px;font-weight:500;color:#64748b;">pods</span></div></div>` : ''}
            ${infraDetails.cpu ? `<div class="ir" style="margin-top:8px;"><div class="ir-label">CPU per Pod</div><div class="ir-value lg">${infraDetails.cpu}</div></div>` : ''}
            ${infraDetails.memory ? `<div class="ir" style="margin-top:8px;"><div class="ir-label">Memory per Pod</div><div class="ir-value lg">${infraDetails.memory}</div></div>` : ''}
          </div>` : '<div></div>'}
        </td>
        <td width="50%" valign="top" style="padding:0 0 0 8px;">
          ${hasConfig ? `
          <div class="card">
            <div class="card-title" style="color:#059669;">
              <div class="ci" style="background:#d1fae5;color:#059669;">⚙️</div>
              Test Configuration
            </div>
            ${summary.users > 0 ? `<div class="cr"><span class="cr-label">Concurrent Users</span><span class="cr-value">${summary.users.toLocaleString()}</span></div>` : ''}
            ${summary.rampupRate > 0 ? `<div class="cr"><span class="cr-label">Ramp-up Rate</span><span class="cr-value">${summary.rampupRate} users/sec</span></div>` : ''}
            ${summary.duration ? `<div class="cr"><span class="cr-label">Test Duration</span><span class="cr-value">${summary.duration}</span></div>` : ''}
            ${summary.startTime ? `<div class="cr"><span class="cr-label">Test Period</span><span class="cr-value sm">Start: ${summary.startTime}${summary.endTime ? `<br>End:&nbsp; ${summary.endTime}` : ''}</span></div>` : ''}
          </div>` : '<div></div>'}
        </td>
      </tr>
    </table>
    ` : ''}

    <!-- Executive Summary + Metrics -->
    ${summary ? `
    <div class="exec">
      <div class="card-title" style="color:#1d4ed8;">
        <div class="ci" style="background:#dbeafe;color:#2563eb;">📊</div>
        Executive Summary
      </div>
      <p class="exec-text">${execText}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:12px;margin:-12px;">
        <tr>
          <td width="25%" valign="top" style="padding:6px;">
            <div class="mbox blue">
              <div class="m-name">Total Requests</div>
              <div class="m-num">${(summary.totalRequests/1000).toFixed(1)}<span style="font-size:16px;color:#64748b;font-weight:600;">K</span></div>
              <div class="m-sub">Over test duration</div>
            </div>
          </td>
          <td width="25%" valign="top" style="padding:6px;">
            <div class="mbox red">
              <div class="m-name">Total Failures</div>
              <div class="m-num" style="color:${colorFail(summary.totalFailures)};">${summary.totalFailures.toLocaleString()}</div>
              <div class="m-sub">Failure rate: ${failureRate}%</div>
            </div>
          </td>
          <td width="25%" valign="top" style="padding:6px;">
            <div class="mbox green">
              <div class="m-name">Avg Response Time</div>
              <div class="m-num" style="color:${colorAvg(summary.avgResponseTime)};">${summary.avgResponseTime}<span style="font-size:14px;color:#64748b;font-weight:600;">ms</span></div>
              <div class="m-sub">SLA: &lt;1000ms</div>
            </div>
          </td>
          <td width="25%" valign="top" style="padding:6px;">
            <div class="mbox purple">
              <div class="m-name">Throughput (RPS)</div>
              <div class="m-num">${summary.rps ? Math.round(summary.rps).toLocaleString() : 'N/A'}</div>
              <div class="m-sub">Requests per second</div>
            </div>
          </td>
        </tr>
      </table>
    </div>
    ` : ''}

    <!-- Top Endpoints Table -->
    ${summary && summary.endpoints && summary.endpoints.length > 0 ? `
    <div class="ep-wrap">
      <div class="ep-hdr">
        <div class="ep-hdr-left"><span style="font-size:20px;">🎯</span> Top ${summary.endpoints.length} Endpoints</div>
        <div class="ep-hdr-right">View All Endpoints →</div>
      </div>
      <table class="ep-table">
        <thead>
          <tr>
            <th>Endpoint</th>
            <th>Method</th>
            <th class="r">Requests</th>
            <th class="r">Failures</th>
            <th class="r">Avg (ms)</th>
            <th class="r">P90 (ms)</th>
            <th class="r">P95 (ms)</th>
            <th class="r">RPS</th>
          </tr>
        </thead>
        <tbody>
          ${summary.endpoints.map(ep => {
            const fr = ep.requests > 0 ? ((ep.failures / ep.requests) * 100).toFixed(1) : '0.0';
            return `<tr>
            <td class="ep-name">${ep.name.length > 46 ? ep.name.substring(0,43)+'…' : ep.name}</td>
            <td><span class="mbadge" style="background:${methodBg(ep.method)};">${ep.method}</span></td>
            <td class="r" style="font-weight:600;">${ep.requests.toLocaleString()}</td>
            <td class="r"><span style="color:${colorFail(ep.failures)};font-weight:600;">${ep.failures}</span> <span style="color:#94a3b8;font-size:11px;">(${fr}%)</span></td>
            <td class="r" style="font-weight:600;color:${colorAvg(ep.avgTime)};">${ep.avgTime}</td>
            <td class="r" style="font-weight:600;color:${colorP(ep.p90Time)};">${ep.p90Time}</td>
            <td class="r" style="font-weight:600;color:${colorP(ep.p95Time)};">${ep.p95Time}</td>
            <td class="r" style="color:#64748b;">${ep.rps.toFixed(1)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="ep-note">Showing top ${summary.endpoints.length} of ${summary.endpoints.length} endpoints</div>
    </div>
    ` : ''}

    <!-- Custom analysis -->
    ${customBody ? `
    <div class="analysis">
      <h3>📝 Detailed Analysis</h3>
      <p>${customBody.replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')}</p>
    </div>
    ` : ''}

    <!-- Bottom row: Attachments / Files / About -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:14px;margin:-14px;">
      <tr>
        <td width="33%" valign="top" style="padding:7px;">
          <div class="attach-card">
            <div class="card-title">
              <div class="ci" style="background:#fef3c7;color:#d97706;">📎</div>
              <span style="color:#92400e;">Attachments</span>
            </div>
            <ul class="attach-list">
              <li>Full Locust HTML report with detailed metrics</li>
              <li>Complete endpoint performance breakdown</li>
              <li>Response time distribution charts</li>
            </ul>
          </div>
        </td>
        <td width="33%" valign="top" style="padding:7px;">
          <div class="files-card">
            <div class="card-title">
              <div class="ci" style="background:#d1fae5;color:#059669;">📋</div>
              <span style="color:#065f46;">Attached Files</span>
            </div>
            <p class="files-text">Complete HTML report with detailed metrics, performance graphs, endpoint analysis, and historical data.</p>
            <div class="chart-bars">
              <div class="cbar" style="height:30%;"></div>
              <div class="cbar" style="height:50%;"></div>
              <div class="cbar" style="height:70%;"></div>
              <div class="cbar" style="height:55%;"></div>
              <div class="cbar" style="height:85%;"></div>
              <div class="cbar" style="height:65%;"></div>
              <div class="cbar" style="height:95%;"></div>
            </div>
          </div>
        </td>
        <td width="33%" valign="top" style="padding:7px;">
          <div class="about-card">
            <div class="card-title">
              <div class="ci" style="background:#dbeafe;color:#2563eb;">ℹ</div>
              <span style="color:#1d4ed8;">About This Report</span>
            </div>
            <p class="about-text">This automated performance report was generated by the PerformanceAI Load Testing Toolkit. The data includes comprehensive metrics from load testing tools, infrastructure monitoring, and application performance monitoring systems.</p>
          </div>
        </td>
      </tr>
    </table>

  </div><!-- /body -->

  <!-- FOOTER -->
  <div class="footer">
    <p style="font-size:13px;color:#64748b;margin-bottom:12px;">For questions or concerns, please review the attached report or contact the performance testing team.</p>
    <p style="color:#94a3b8;font-size:12px;margin-bottom:14px;">---</p>
    <div class="no-reply">
      <p>⚠️ This is an automated email. Please do not reply to this message.</p>
      <span>For questions or support, please contact your performance engineering team directly.</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px;">
      <div style="width:36px;height:36px;background:linear-gradient(135deg,#1e3a8a,#3b82f6);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;">📊</div>
      <div style="text-align:left;">
        <div class="footer-brand">PerformanceAI</div>
        <div style="font-size:11px;color:#94a3b8;font-style:italic;">Intelligent Performance Testing</div>
      </div>
    </div>
    <p style="font-size:12px;color:#94a3b8;margin-top:6px;">Generated by PerformanceAI Toolkit</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:2px;">Test Date: ${dateStr}</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:8px;">© ${year} Performance Testing Team | All rights reserved</p>
  </div>

</div><!-- /wrap -->
</body>
</html>`;
}

// Send email
async function sendEmail(config, args, summary) {
    try {
        const transporterConfig = {
            host: config.host,
            port: config.port,
            secure: config.secure || false,
            auth: { user: config.auth.user, pass: config.auth.pass }
        };
        if (config.service) transporterConfig.service = config.service;

        const transporter = nodemailer.createTransport(transporterConfig);
        const attachments = [];

        if (args.report && fs.existsSync(args.report)) {
            attachments.push({ filename: path.basename(args.report), path: args.report });
        }
        for (const attachPath of args.attach) {
            if (fs.existsSync(attachPath)) {
                attachments.push({ filename: path.basename(attachPath), path: attachPath });
            } else {
                console.warn(`Attachment not found: ${attachPath}`);
            }
        }

        const infraDetails = {
            serviceName: args.serviceName,
            pods: args.pods,
            cpu: args.cpu,
            memory: args.memory
        };

        const htmlBody = generateEmailBody(args.template, summary, args.body, infraDetails);
        const mailOptions = { from: config.from, to: args.to, subject: args.subject, html: htmlBody, attachments };
        if (args.cc) mailOptions.cc = args.cc;

        console.log('Sending email...');
        console.log(`To: ${args.to}`);
        if (args.cc) console.log(`CC: ${args.cc}`);
        console.log(`Subject: ${args.subject}`);
        console.log(`Attachments: ${attachments.length} file(s)`);

        const info = await transporter.sendMail(mailOptions);
        console.log('\n✅ Email sent successfully!');
        console.log(`Message ID: ${info.messageId}`);
        if (info.response) console.log(`Server Response: ${info.response}`);
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

    const stakeholderEmails = readStakeholdersFromCSV(args.stakeholdersCsv);
    if (stakeholderEmails.length > 0) {
        console.log(`📧 Found ${stakeholderEmails.length} stakeholder email(s) in ${args.stakeholdersCsv}`);
        if (args.to) {
            const existingEmails = args.to.split(',').map(e => e.trim());
            args.to = [...new Set([...existingEmails, ...stakeholderEmails])].join(',');
        } else {
            args.to = stakeholderEmails.join(',');
        }
    }

    if (!args.to || !args.subject || !args.report) {
        console.error('❌ Missing required arguments!');
        console.error('\nRequired: --subject, --report');
        console.error('Required: --to OR valid stakeholder-email.csv file');
        console.error('Run with --help for usage information');
        process.exit(1);
    }

    if (!fs.existsSync(args.report)) {
        console.error(`❌ Report file not found: ${args.report}`);
        process.exit(1);
    }

    const emailConfig = loadConfig(args.config);

    console.log(`📄 Reading report: ${args.report}`);
    const summary = extractTestSummary(args.report);

    if (summary) {
        console.log(`\n📊 Test Summary:`);
        console.log(`   Requests: ${summary.totalRequests.toLocaleString()}`);
        console.log(`   Failures: ${summary.totalFailures.toLocaleString()}`);
        console.log(`   Avg Response: ${summary.avgResponseTime}ms`);
        const failureRate = ((summary.totalFailures / summary.totalRequests) * 100).toFixed(2);

        const SLA_THRESHOLD = 1000, ERROR_THRESHOLD = 5;
        const avgViolation   = summary.avgResponseTime > SLA_THRESHOLD;
        const errorViolation = parseFloat(failureRate) > ERROR_THRESHOLD;
        const p90Violations  = summary.endpoints ? summary.endpoints.filter(e => e.p90Time > SLA_THRESHOLD) : [];
        const p95Violations  = summary.endpoints ? summary.endpoints.filter(e => e.p95Time > SLA_THRESHOLD) : [];
        const status = (avgViolation || errorViolation || p90Violations.length > 0 || p95Violations.length > 0) ? 'FAIL' : 'PASS';
        console.log(`   Status: ${status}`);

        if (status === 'FAIL') {
            if (avgViolation)          console.log(`   ⚠️  Avg response time (${summary.avgResponseTime}ms) exceeds SLA (${SLA_THRESHOLD}ms)`);
            if (errorViolation)        console.log(`   ⚠️  Error rate (${failureRate}%) exceeds threshold (${ERROR_THRESHOLD}%)`);
            if (p90Violations.length)  console.log(`   ⚠️  ${p90Violations.length} endpoint(s) with P90 > ${SLA_THRESHOLD}ms`);
            if (p95Violations.length)  console.log(`   ⚠️  ${p95Violations.length} endpoint(s) with P95 > ${SLA_THRESHOLD}ms`);
        }
    }

    await sendEmail(emailConfig, args, summary);
}

if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = { sendEmail, extractTestSummary, generateEmailBody, parseArgs };