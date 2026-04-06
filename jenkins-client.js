#!/usr/bin/env node

const http = require('http');
const https = require('https');
const { readFileSync } = require('fs');
const { join } = require('path');

// Read configuration
const configPath = join(__dirname, 'config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const JENKINS_URL = config.mcpServers?.jenkins?.baseUrl || process.env.JENKINS_URL || 'http://localhost:8080';
const JENKINS_USER = config.mcpServers?.jenkins?.username || process.env.JENKINS_USER;
const JENKINS_TOKEN = config.mcpServers?.jenkins?.apiToken || process.env.JENKINS_TOKEN;

/**
 * Make an HTTP request to Jenkins API
 */
function makeJenkinsRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, JENKINS_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // Basic auth
    const auth = JENKINS_USER && JENKINS_TOKEN 
      ? `${JENKINS_USER}:${JENKINS_TOKEN}`
      : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    };

    if (auth) {
      options.headers['Authorization'] = `Basic ${Buffer.from(auth).toString('base64')}`;
    }

    // Add crumb for POST requests (CSRF protection)
    if (method === 'POST') {
      // We'll get the crumb in a separate request if needed
      // For now, try without it (some Jenkins instances don't require it)
    }

    if (body) {
      const bodyData = typeof body === 'string' ? body : JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Jenkins API error: ${res.statusCode} ${res.statusMessage}\n${data}`));
          return;
        }

        // Handle Location header for queue items
        if (res.statusCode === 201 && res.headers.location) {
          resolve({ 
            statusCode: res.statusCode,
            location: res.headers.location,
            queueUrl: res.headers.location
          });
          return;
        }

        try {
          // Some endpoints return empty responses
          if (!data || data.trim() === '') {
            resolve({ statusCode: res.statusCode });
            return;
          }
          
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          // If not JSON, return raw data
          resolve({ data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      const bodyData = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(bodyData);
    }

    req.end();
  });
}

/**
 * Get Jenkins crumb for CSRF protection
 */
async function getCrumb() {
  try {
    const crumb = await makeJenkinsRequest('/crumbIssuer/api/json');
    return crumb;
  } catch (error) {
    // Some Jenkins instances don't have CSRF protection enabled
    return null;
  }
}

/**
 * Make a POST request with CSRF crumb
 */
async function makeJenkinsPost(path, body = null) {
  const crumb = await getCrumb();
  
  return new Promise((resolve, reject) => {
    const url = new URL(path, JENKINS_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const auth = JENKINS_USER && JENKINS_TOKEN 
      ? `${JENKINS_USER}:${JENKINS_TOKEN}`
      : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    if (auth) {
      options.headers['Authorization'] = `Basic ${Buffer.from(auth).toString('base64')}`;
    }

    if (crumb) {
      options.headers[crumb.crumbRequestField] = crumb.crumb;
    }

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Jenkins API error: ${res.statusCode} ${res.statusMessage}\n${data}`));
          return;
        }

        // Return location header for queue items
        if (res.headers.location) {
          resolve({ 
            statusCode: res.statusCode,
            location: res.headers.location,
            queueUrl: res.headers.location
          });
          return;
        }

        resolve({ 
          statusCode: res.statusCode,
          data: data || 'Success'
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

/**
 * List all jobs
 */
async function listJobs() {
  const response = await makeJenkinsRequest('/api/json?tree=jobs[name,url,color,lastBuild[number,result,timestamp,duration]]');
  return response.jobs || [];
}

/**
 * Get job details
 */
async function getJobInfo(jobName) {
  const encodedName = encodeURIComponent(jobName);
  const response = await makeJenkinsRequest(`/job/${encodedName}/api/json`);
  return response;
}

/**
 * Get job configuration XML
 */
async function getJobConfig(jobName) {
  const encodedName = encodeURIComponent(jobName);
  
  return new Promise((resolve, reject) => {
    const url = new URL(`/job/${encodedName}/config.xml`, JENKINS_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const auth = JENKINS_USER && JENKINS_TOKEN 
      ? `${JENKINS_USER}:${JENKINS_TOKEN}`
      : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Accept': 'application/xml',
      },
    };

    if (auth) {
      options.headers['Authorization'] = `Basic ${Buffer.from(auth).toString('base64')}`;
    }

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Jenkins API error: ${res.statusCode} ${res.statusMessage}\n${data}`));
          return;
        }

        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Update job configuration XML
 * ⚠️ WARNING: This is a WRITE operation that modifies the Jenkins job
 */
async function updateJobConfig(jobName, configXml) {
  const encodedName = encodeURIComponent(jobName);
  const crumb = await getCrumb();
  
  return new Promise((resolve, reject) => {
    const url = new URL(`/job/${encodedName}/config.xml`, JENKINS_URL);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const auth = JENKINS_USER && JENKINS_TOKEN 
      ? `${JENKINS_USER}:${JENKINS_TOKEN}`
      : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
        'Content-Length': Buffer.byteLength(configXml),
      },
    };

    if (auth) {
      options.headers['Authorization'] = `Basic ${Buffer.from(auth).toString('base64')}`;
    }

    if (crumb) {
      options.headers[crumb.crumbRequestField] = crumb.crumb;
    }

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Jenkins API error: ${res.statusCode} ${res.statusMessage}\n${data}`));
          return;
        }

        resolve({ 
          statusCode: res.statusCode,
          message: 'Job configuration updated successfully'
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(configXml);
    req.end();
  });
}

/**
 * Trigger a job build (without parameters)
 */
async function triggerBuild(jobName) {
  const encodedName = encodeURIComponent(jobName);
  const response = await makeJenkinsPost(`/job/${encodedName}/build`);
  return response;
}

/**
 * Trigger a parameterized job build
 */
async function triggerParameterizedBuild(jobName, parameters) {
  const encodedName = encodeURIComponent(jobName);
  
  // Build form data
  const formParams = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    formParams.append(key, value);
  }
  
  const response = await makeJenkinsPost(
    `/job/${encodedName}/buildWithParameters`,
    formParams.toString()
  );
  return response;
}

/**
 * Get build info
 */
async function getBuildInfo(jobName, buildNumber) {
  const encodedName = encodeURIComponent(jobName);
  const response = await makeJenkinsRequest(`/job/${encodedName}/${buildNumber}/api/json`);
  return response;
}

/**
 * Get build status
 */
async function getBuildStatus(jobName, buildNumber) {
  const info = await getBuildInfo(jobName, buildNumber);
  return {
    number: info.number,
    result: info.result,
    building: info.building,
    duration: info.duration,
    estimatedDuration: info.estimatedDuration,
    timestamp: info.timestamp,
    url: info.url,
  };
}

/**
 * Get console output for a build
 */
async function getConsoleOutput(jobName, buildNumber) {
  const encodedName = encodeURIComponent(jobName);
  const response = await makeJenkinsRequest(`/job/${encodedName}/${buildNumber}/consoleText`);
  return response.data || response;
}

/**
 * Stop/abort a running build
 */
async function stopBuild(jobName, buildNumber) {
  const encodedName = encodeURIComponent(jobName);
  await makeJenkinsPost(`/job/${encodedName}/${buildNumber}/stop`);
  return { success: true, message: `Build #${buildNumber} stop requested` };
}

/**
 * Get queue item info
 */
async function getQueueItem(queueId) {
  const response = await makeJenkinsRequest(`/queue/item/${queueId}/api/json`);
  return response;
}

/**
 * Extract queue ID from location header
 */
function extractQueueId(location) {
  const match = location.match(/\/queue\/item\/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Wait for build to start and return build number
 */
async function waitForBuildStart(jobName, queueId, maxWaitSeconds = 60) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const queueItem = await getQueueItem(queueId);
      
      // Check if build has started
      if (queueItem.executable) {
        return queueItem.executable.number;
      }

      // Check if cancelled
      if (queueItem.cancelled) {
        throw new Error('Build was cancelled in queue');
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      // Queue item might be removed once build starts
      // Try to get the latest build
      try {
        const jobInfo = await getJobInfo(jobName);
        if (jobInfo.lastBuild) {
          return jobInfo.lastBuild.number;
        }
      } catch (e) {
        // Continue waiting
      }
    }
  }

  throw new Error(`Build did not start within ${maxWaitSeconds} seconds`);
}

/**
 * Wait for build to complete
 */
async function waitForBuildComplete(jobName, buildNumber, maxWaitSeconds = 600) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getBuildStatus(jobName, buildNumber);
    
    if (!status.building) {
      return status;
    }

    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`Build did not complete within ${maxWaitSeconds} seconds`);
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'list':
      case 'jobs': {
        const jobs = await listJobs();
        console.log(JSON.stringify(jobs, null, 2));
        break;
      }

      case 'info': {
        const jobName = args[1];
        if (!jobName) {
          console.error('Usage: node jenkins-client.js info <job-name>');
          process.exit(1);
        }
        const info = await getJobInfo(jobName);
        console.log(JSON.stringify(info, null, 2));
        break;
      }

      case 'config': {
        const jobName = args[1];
        if (!jobName) {
          console.error('Usage: node jenkins-client.js config <job-name>');
          process.exit(1);
        }
        const config = await getJobConfig(jobName);
        console.log(config);
        break;
      }

      case 'update-config': {
        const jobName = args[1];
        const configFile = args[2];
        if (!jobName || !configFile) {
          console.error('Usage: node jenkins-client.js update-config <job-name> <config-file.xml>');
          console.error('');
          console.error('⚠️  WARNING: This will update the job configuration!');
          console.error('Example: node jenkins-client.js update-config my-job config.xml');
          process.exit(1);
        }

        const fs = require('fs');
        if (!fs.existsSync(configFile)) {
          console.error(`Error: Config file not found: ${configFile}`);
          process.exit(1);
        }

        const configXml = fs.readFileSync(configFile, 'utf8');
        console.log(`⚠️  WARNING: About to update configuration for job: ${jobName}`);
        console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('Updating job configuration...');
        const result = await updateJobConfig(jobName, configXml);
        console.log('✓', result.message);
        break;
      }

      case 'build':
      case 'trigger': {
        const jobName = args[1];
        if (!jobName) {
          console.error('Usage: node jenkins-client.js build <job-name> [key=value ...]');
          process.exit(1);
        }

        // Parse parameters (key=value pairs)
        const parameters = {};
        for (let i = 2; i < args.length; i++) {
          const [key, value] = args[i].split('=');
          if (key && value) {
            parameters[key] = value;
          }
        }

        let response;
        if (Object.keys(parameters).length > 0) {
          console.log(`Triggering parameterized build for: ${jobName}`);
          console.log('Parameters:', parameters);
          response = await triggerParameterizedBuild(jobName, parameters);
        } else {
          console.log(`Triggering build for: ${jobName}`);
          response = await triggerBuild(jobName);
        }

        console.log('Build triggered successfully!');
        console.log('Queue URL:', response.location);
        
        // Extract queue ID and wait for build to start
        if (response.location) {
          const queueId = extractQueueId(response.location);
          if (queueId) {
            console.log(`Queue ID: ${queueId}`);
            console.log('Waiting for build to start...');
            
            const buildNumber = await waitForBuildStart(jobName, queueId);
            console.log(`Build #${buildNumber} started`);
            console.log(`Build URL: ${JENKINS_URL}/job/${jobName}/${buildNumber}/`);
          }
        }
        break;
      }

      case 'status': {
        const jobName = args[1];
        const buildNumber = args[2] || 'lastBuild';
        if (!jobName) {
          console.error('Usage: node jenkins-client.js status <job-name> [build-number]');
          process.exit(1);
        }
        const status = await getBuildStatus(jobName, buildNumber);
        console.log(JSON.stringify(status, null, 2));
        break;
      }

      case 'console':
      case 'log': {
        const jobName = args[1];
        const buildNumber = args[2] || 'lastBuild';
        if (!jobName) {
          console.error('Usage: node jenkins-client.js console <job-name> [build-number]');
          process.exit(1);
        }
        const output = await getConsoleOutput(jobName, buildNumber);
        console.log(output);
        break;
      }

      case 'stop':
      case 'abort': {
        const jobName = args[1];
        const buildNumber = args[2];
        if (!jobName || !buildNumber) {
          console.error('Usage: node jenkins-client.js stop <job-name> <build-number>');
          process.exit(1);
        }
        const result = await stopBuild(jobName, buildNumber);
        console.log(`✓ ${result.message}`);
        break;
      }

      case 'wait': {
        const jobName = args[1];
        const buildNumber = args[2];
        if (!jobName || !buildNumber) {
          console.error('Usage: node jenkins-client.js wait <job-name> <build-number>');
          process.exit(1);
        }
        console.log(`Waiting for build #${buildNumber} of ${jobName} to complete...`);
        const status = await waitForBuildComplete(jobName, buildNumber);
        console.log('Build completed!');
        console.log(JSON.stringify(status, null, 2));
        break;
      }

      case 'build-wait': {
        const jobName = args[1];
        if (!jobName) {
          console.error('Usage: node jenkins-client.js build-wait <job-name> [key=value ...]');
          process.exit(1);
        }

        // Parse parameters
        const parameters = {};
        for (let i = 2; i < args.length; i++) {
          const [key, value] = args[i].split('=');
          if (key && value) {
            parameters[key] = value;
          }
        }

        // Trigger build
        let response;
        if (Object.keys(parameters).length > 0) {
          console.log(`Triggering parameterized build for: ${jobName}`);
          console.log('Parameters:', parameters);
          response = await triggerParameterizedBuild(jobName, parameters);
        } else {
          console.log(`Triggering build for: ${jobName}`);
          response = await triggerBuild(jobName);
        }

        console.log('Build triggered successfully!');
        
        // Wait for build to start
        const queueId = extractQueueId(response.location);
        console.log('Waiting for build to start...');
        const buildNumber = await waitForBuildStart(jobName, queueId);
        console.log(`Build #${buildNumber} started`);
        
        // Wait for completion
        console.log('Waiting for build to complete...');
        const status = await waitForBuildComplete(jobName, buildNumber);
        console.log('\nBuild completed!');
        console.log(`Result: ${status.result}`);
        console.log(`Duration: ${(status.duration / 1000).toFixed(2)}s`);
        console.log(`URL: ${status.url}`);
        
        process.exit(status.result === 'SUCCESS' ? 0 : 1);
        break;
      }

      default: {
        console.log('Jenkins Client');
        console.log('');
        console.log('Usage:');
        console.log('  node jenkins-client.js list                                    - List all jobs');
        console.log('  node jenkins-client.js info <job-name>                         - Get job details');
        console.log('  node jenkins-client.js config <job-name>                       - Get job configuration XML');
        console.log('  node jenkins-client.js update-config <job-name> <file.xml>     - Update job configuration (⚠️  WRITE)');
        console.log('  node jenkins-client.js build <job-name> [key=value ...]        - Trigger a build');
        console.log('  node jenkins-client.js status <job-name> [build-number]        - Get build status');
        console.log('  node jenkins-client.js console <job-name> [build-number]       - Get console output');
        console.log('  node jenkins-client.js stop <job-name> <build-number>          - Stop/abort a running build');
        console.log('  node jenkins-client.js wait <job-name> <build-number>          - Wait for build to complete');
        console.log('  node jenkins-client.js build-wait <job-name> [key=value ...]   - Trigger and wait for completion');
        console.log('');
        console.log('Examples:');
        console.log('  node jenkins-client.js list');
        console.log('  node jenkins-client.js config my-job > config.xml');
        console.log('  node jenkins-client.js update-config my-job config.xml');
        console.log('  node jenkins-client.js build my-job');
        console.log('  node jenkins-client.js build my-job BRANCH=main ENV=prod');
        console.log('  node jenkins-client.js status my-job 42');
        console.log('  node jenkins-client.js stop my-job 42');
        console.log('  node jenkins-client.js build-wait my-job BRANCH=dev');
        process.exit(0);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Export functions for use as a module
module.exports = {
  listJobs,
  getJobInfo,
  getJobConfig,
  updateJobConfig,
  triggerBuild,
  triggerParameterizedBuild,
  getBuildInfo,
  getBuildStatus,
  getConsoleOutput,
  getQueueItem,
  waitForBuildStart,
  waitForBuildComplete,
};

// Run CLI if executed directly
if (require.main === module) {
  main();
}
