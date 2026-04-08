const dns = require('dns');
const { promisify } = require('util');
const resolveSrv = promisify(dns.resolveSrv);

async function checkDns() {
    const hostname = '_mongodb._tcp.cluster0.1xzzedg.mongodb.net';
    console.log(`Resolving SRV for ${hostname}...`);
    try {
        const addresses = await resolveSrv(hostname);
        console.log('SRV Addresses found:');
        console.log(JSON.stringify(addresses, null, 2));
    } catch (err) {
        console.error('DNS Resolution Error:', err);
    }
}

checkDns();
