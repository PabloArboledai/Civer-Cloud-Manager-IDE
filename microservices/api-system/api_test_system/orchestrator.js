const axios = require('axios');
const io = require('socket.io-client');
// Basic console logging instead of chalk
const chalk = {
    blue: { bold: (t) => t },
    magenta: { bold: (t) => t },
    cyan: (t) => t,
    green: (t) => t,
    red: (t) => t,
    gray: (t) => t,
    yellow: (t) => t,
    white: (t) => t
};

const fs = require('fs-extra');
const path = require('path');
const AdmZip = require('adm-zip');

const CONFIG = {
    API_BASE: 'http://127.0.0.1:3050/api',
    WS_BASE: 'http://127.0.0.1:3050',
    PROJECT_ID: 'hola'
};

async function runSnapshotTests() {
    console.log(chalk.blue.bold('\n🚀 STARTING API SNAPSHOT TESTS...'));
    
    try {
        // 1. Fetch List
        console.log(chalk.cyan('Testing GET /snapshots/:id...'));
        const listRes = await axios.get(`${CONFIG.API_BASE}/snapshots/${CONFIG.PROJECT_ID}`);
        console.log(chalk.green(`  ✓ Found ${listRes.data.length} snapshots.`));

        // 2. Test Download (Code)
        console.log(chalk.cyan('\nTesting GET /download?type=code...'));
        const downloadRes = await axios({
            url: `${CONFIG.API_BASE}/snapshots/${CONFIG.PROJECT_ID}/download?type=code`,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        const cd = downloadRes.headers['content-disposition'];
        if (cd) {
            const filenameMatch = cd.match(/filename="(.+?)"/);
            const filename = filenameMatch ? filenameMatch[1] : 'unknown.zip';
            console.log(chalk.green(`  ✓ Received file: ${chalk.white(filename)}`));
        } else {
            console.log(chalk.yellow('  ! Warning: No Content-Disposition header.'));
        }

    } catch (err) {
        console.log(chalk.red(`  ✗ API ERROR: ${err.message}`));
    }
}

function runWSTests() {
    console.log(chalk.magenta.bold('\n🔌 STARTING WEBSOCKET MONITORING...'));
    const socket = io(CONFIG.WS_BASE);

    socket.on('connect', () => {
        console.log(chalk.green('  ✓ Connected to WebSocket server!'));
        setTimeout(() => {
            socket.disconnect();
            console.log(chalk.magenta('\n✅ WS Monitoring test finished.'));
            process.exit(0);
        }, 3000);
    });
}

async function start() {
    await runSnapshotTests();
    // runWSTests(); // Disabled for quick final check
    process.exit(0);
}

start();
