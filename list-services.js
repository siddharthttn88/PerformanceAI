const { execSync } = require('child_process');

async function listAllServices() {
    console.log('=== NEW RELIC APM SERVICES ===\n');
    
    try {
        const newrelicCmd = 'node newrelic-client.js apps';
        const output = execSync(newrelicCmd, { encoding: 'utf-8' });
        
        // Find JSON in output (starts with {)
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in output');
        
        const data = JSON.parse(jsonMatch[0]);
        const apps = data.applications || [];
        
        // Group by reporting status
        const reporting = apps.filter(app => app.reporting).map(app => app.name).sort();
        const notReporting = apps.filter(app => !app.reporting).map(app => app.name).sort();
        
        console.log(`📊 Total Applications: ${apps.length}`);
        console.log(`✅ Reporting (${reporting.length}):`);
        reporting.forEach(name => console.log(`   - ${name}`));
        
        console.log(`\n⚫ Not Reporting (${notReporting.length}):`);
        notReporting.forEach(name => console.log(`   - ${name}`));
        
    } catch (error) {
        console.error('Error fetching New Relic services:', error.message);
    }
    
    console.log('\n=== KUBERNETES SERVICES (Prometheus) ===\n');
    
    try {
        const grafanaCmd = 'node grafana-reader.js label-values pod';
        const output = execSync(grafanaCmd, { encoding: 'utf-8' });
        
        // Extract JSON array from output
        const jsonMatch = output.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const pods = JSON.parse(jsonMatch[0]);
            
            // Extract service names from pod names (remove replicaset hash and pod hash)
            const serviceNames = new Set();
            pods.forEach(pod => {
                // Remove pattern: -[hash]-[hash] or -[hash]
                const serviceName = pod.replace(/-[a-z0-9]+-[a-z0-9]+$/, '')
                                       .replace(/-[a-z0-9]+$/, '');
                serviceNames.add(serviceName);
            });
            
            const sorted = Array.from(serviceNames).sort();
            console.log(`📦 Total Services: ${sorted.length}`);
            console.log(`🟢 Active Services:\n`);
            sorted.forEach(name => console.log(`   - ${name}`));
        }
        
    } catch (error) {
        console.error('Error fetching Kubernetes services:', error.message);
    }
}

listAllServices().catch(console.error);
