#!/usr/bin/env node
/**
 * html-to-pdf.js — Convert an HTML file to PDF using Puppeteer (puppeteer-core)
 * Renders via the system's Edge/Chrome browser — preserves all CSS, charts, tables.
 *
 * Usage:
 *   node src/utils/html-to-pdf.js <input.html> [output.pdf] [options]
 *
 * Options:
 *   --format <size>       Page format: A4 (default), A3, Letter, Legal
 *   --landscape           Landscape orientation (default: portrait)
 *   --margin <px>         Page margin in px (default: 20)
 *   --scale <factor>      Scale factor 0.1–2.0 (default: 1)
 *   --no-background       Do not print backgrounds/colors
 *   --wait <ms>           Extra wait time for JS to render (default: 1000ms)
 *
 * Examples:
 *   node src/utils/html-to-pdf.js Reports/result.html
 *   node src/utils/html-to-pdf.js Reports/result.html Reports/result.pdf
 *   node src/utils/html-to-pdf.js Reports/result.html --landscape --format A3
 *   node src/utils/html-to-pdf.js Reports/result.html --scale 0.8 --wait 2000
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

// ── Browser discovery ────────────────────────────────────────────────────────

const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findBrowser() {
  for (const candidate of BROWSER_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// ── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const inputArg = args[0];
  const inputPath = path.resolve(inputArg);

  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Second positional arg is output path if it doesn't start with --
  const secondArg = args[1] && !args[1].startsWith('--') ? args[1] : null;
  const outputPath = secondArg
    ? path.resolve(secondArg)
    : inputPath.replace(/\.html?$/i, '.pdf');

  const opts = {
    format:     getFlag(args, '--format', 'A4'),
    landscape:  args.includes('--landscape'),
    background: !args.includes('--no-background'),
    scale:      parseFloat(getFlag(args, '--scale', '1')),
    margin:     getFlag(args, '--margin', '20'),
    wait:       parseInt(getFlag(args, '--wait', '1000'), 10),
  };

  return { inputPath, outputPath, opts };
}

function getFlag(args, flag, defaultVal) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

function printHelp() {
  console.log(`
html-to-pdf.js — Convert HTML to PDF using Puppeteer (puppeteer-core)

Usage:
  node src/utils/html-to-pdf.js <input.html> [output.pdf] [options]

Arguments:
  input.html    Path to the HTML file to convert (required)
  output.pdf    Output PDF path (optional — defaults to same name as input)

Options:
  --format <size>    Page format: A4 (default), A3, Letter, Legal
  --landscape        Use landscape orientation
  --margin <px>      Page margin in px (default: 20)
  --scale <factor>   Zoom scale 0.1-2.0 (default: 1)
  --no-background    Skip background colors and images
  --wait <ms>        Wait time for JS to finish rendering (default: 1000)

Examples:
  node src/utils/html-to-pdf.js Reports/result.html
  node src/utils/html-to-pdf.js Reports/result.html Reports/result.pdf
  node src/utils/html-to-pdf.js Reports/result.html --landscape --format A3
  node src/utils/html-to-pdf.js Reports/result.html --scale 0.8 --wait 2000
`);
}

// ── PDF generation ───────────────────────────────────────────────────────────

async function convertToPdf(inputPath, outputPath, opts, browserPath) {
  const fileUrl = `file:///${inputPath.replace(/\\/g, '/')}`;
  const marginPx = `${opts.margin}px`;

  console.log(`🌐 Browser  : ${path.basename(browserPath)}`);
  console.log(`📄 Input    : ${inputPath}`);
  console.log(`📁 Output   : ${outputPath}`);
  console.log(`📐 Format   : ${opts.format} | Landscape: ${opts.landscape} | Scale: ${opts.scale}`);
  console.log('⏳ Launching browser...\n');

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set a wide viewport so content doesn't get clipped
    await page.setViewport({ width: 1400, height: 900 });

    // Navigate and wait for network to settle + JS to render
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Extra wait for any deferred JS rendering (charts, dynamic content)
    if (opts.wait > 0) {
      await new Promise(r => setTimeout(r, opts.wait));
    }

    // Generate PDF with full formatting
    await page.pdf({
      path: outputPath,
      format: opts.format,
      landscape: opts.landscape,
      printBackground: opts.background,   // preserves background colors & images
      scale: opts.scale,
      margin: {
        top: marginPx,
        bottom: marginPx,
        left: marginPx,
        right: marginPx,
      },
      displayHeaderFooter: false,         // no URL or page number header/footer
    });

    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
    console.log(`✅ PDF created successfully!`);
    console.log(`   Size : ${sizeKB} KB`);
    console.log(`   Path : ${outputPath}`);
  } finally {
    await browser.close();
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { inputPath, outputPath, opts } = parseArgs();

  const browserPath = findBrowser();
  if (!browserPath) {
    console.error('❌ No supported browser found (Edge or Chrome).');
    console.error('   Add your browser path to BROWSER_CANDIDATES in src/utils/html-to-pdf.js');
    process.exit(1);
  }

  try {
    await convertToPdf(inputPath, outputPath, opts, browserPath);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
