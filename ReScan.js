const mc = require('minecraft-protocol');
const fs = require('fs');
const path = require('path');

const port = 25565; // Default Minecraft port
const scanInterval = 1000; // 60 seconds

// Path to logs directory and specific subdirectories
const logsDir = path.join(__dirname, 'logs');
const officialDir = path.join(logsDir, 'official');
const crackedDir = path.join(logsDir, 'cracked');
const offlineDir = path.join(crackedDir, 'offline');

// Ensure required directories exist
function ensureDirectoriesExist() {
  const directories = [logsDir, officialDir, crackedDir, offlineDir];

  directories.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Create directories before initializing any other logic
ensureDirectoriesExist();

// Function to rescan a known online server
async function rescanServer(ip, port) {
  console.log(`Rescanning ${ip}:${port}...`);
  try {
    const data = await mc.ping({ host: ip, port: port, version: false });

    const isOfflineMode = data.modinfo ? data.modinfo.type === 'Vanilla' : false;
    const playerNames = data.players.sample ? data.players.sample.map(player => player.name) : [];

    const logEntry = {
      time: new Date().toISOString(),
      ip: ip,
      port: port,
      version: data.version.name,
      onlinePlayers: data.players.online,
      maxPlayers: data.players.max,
      software: data.modinfo ? data.modinfo.type : 'Vanilla',
      isOfflineMode: isOfflineMode,
      playerNames: playerNames,
    };

    // Choose directory based on server mode
    const serverDir = isOfflineMode ? path.join(crackedDir, ip) : path.join(officialDir, ip);
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    // Append log entry to the server's log file
    const logFilePath = path.join(serverDir, 'log.json');
    fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + ',\n');
    console.log(`Updated log for ${ip} in ${isOfflineMode ? 'cracked' : 'official'} mode.`);
  } catch (error) {
    console.log(`${ip} is now offline. Moving log to offline directory.`);
    const offlineServerDir = path.join(offlineDir, ip);

    // Ensure offline directory for this IP exists
    if (!fs.existsSync(offlineServerDir)) {
      fs.mkdirSync(offlineServerDir, { recursive: true });
    }

    // Append log entry for the offline status
    const logFilePath = path.join(offlineServerDir, 'log.json');
    fs.appendFileSync(logFilePath, JSON.stringify({ time: new Date().toISOString(), status: 'offline' }) + ',\n');
  }
}

// Function to rescan all detected servers periodically
async function rescanAllServers() {
  while (true) {
    // Collect server IPs from log directories
    const serverDirs = fs.readdirSync(logsDir)
      .filter(dir => fs.lstatSync(path.join(logsDir, dir)).isDirectory())
      .map(dir => dir.trim())
      .filter(dir => dir && fs.existsSync(path.join(logsDir, dir, 'log.json'))); // Check for log.json

    const scanPromises = serverDirs.map((ip) => rescanServer(ip, port));
    
    // Execute all scans and wait for completion
    await Promise.allSettled(scanPromises);
    
    console.log(`Waiting ${scanInterval / 1000} seconds before next rescan...`);
    await new Promise((resolve) => setTimeout(resolve, scanInterval));
  }
}

// Start rescanning detected servers indefinitely
rescanAllServers();
