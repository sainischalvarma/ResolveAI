const fs = require('fs');

const categories = ['network', 'vpn', 'hardware', 'software', 'account', 'system', 'other'];
const paths = ['happy', 'confused', 'fail_twice', 'fail_all', 'immediate_escalation'];
const devices = ['Windows 11', 'MacBook Pro', 'iPhone', 'Android'];

const scenarios = [];

let id = 1;

for (let category of categories) {
    for (let path of paths) {
        let turns = [];
        if (path === 'happy') {
            turns.push({ user: `My ${category} is broken on my ${devices[id % devices.length]}`, expectedSystemPattern: "Step 1:" });
            turns.push({ user: "solved", expectedSystemPattern: "resolved" });
        } else if (path === 'confused') {
            turns.push({ user: `I have a ${category} issue`, expectedSystemPattern: "Step 1:" });
            turns.push({ user: "I am confused", expectedSystemPattern: "Step 2:" });
        } else if (path === 'fail_twice') {
            turns.push({ user: `${category} not working`, expectedSystemPattern: "Step 1:" });
            turns.push({ user: "did not work", expectedSystemPattern: "Step 2:" });
            turns.push({ user: "solved", expectedSystemPattern: "resolved" });
        } else if (path === 'fail_all') {
            turns.push({ user: `Fix my ${category}`, expectedSystemPattern: "Step 1:" });
            turns.push({ user: "did not work", expectedSystemPattern: "Step 2:" });
            turns.push({ user: "did not work", expectedSystemPattern: "Step 3:" });
            turns.push({ user: "did not work", expectedSystemPattern: "Step 4:" });
            turns.push({ user: "did not work", expectedSystemPattern: "Step 5:" });
            turns.push({ user: "did not work", expectedSystemPattern: "escalat|ticket" });
        } else if (path === 'immediate_escalation') {
            turns.push({ user: `Critical production ${category} is down! I need a technician`, expectedSystemPattern: "escalat|ticket" });
        }
        
        scenarios.push({
            name: `${category} - ${path}`,
            category: category,
            turns: turns
        });
        id++;
    }
}

// Ensure at least 40 scenarios (we have 7 * 5 = 35 + 5 explicit)
scenarios.push(
    { name: "Explicit escalation", category: "general", turns: [{ user: "I need a human technician", expectedSystemPattern: "escalat|ticket" }] },
    { name: "Critical outage", category: "general", turns: [{ user: "The entire production server is down and we are losing data", expectedSystemPattern: "escalat|ticket" }] },
    { name: "Printer happy path", category: "hardware", turns: [{ user: "Printer is not working", expectedSystemPattern: "Step 1:" }, { user: "working now", expectedSystemPattern: "resolved|ticket" }] },
    { name: "Wi-Fi toggle issue", category: "network", turns: [{ user: "My wifi is not connecting", expectedSystemPattern: "Step 1:.*toggle" }, { user: "it worked", expectedSystemPattern: "resolved" }] },
    { name: "VPN connection issue", category: "vpn", turns: [{ user: "VPN issue", expectedSystemPattern: "Step 1:" }, { user: "did not work", expectedSystemPattern: "Step 2:" }, { user: "solved", expectedSystemPattern: "resolved" }] }
);

fs.writeFileSync('c:/SOA/resolveai/eval/chat-scenarios.json', JSON.stringify(scenarios, null, 2));
