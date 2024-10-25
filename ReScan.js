const mc = require('minecraft-protocol');
const fs = require('fs');
const path = require('path');

const port = 25565; // Default Minecraft port
const scanInterval = 1000; // Scan interval in milliseconds

// Path to logs directory
const logsDir = path.join(__dirname, 'logs');

// Function to rescan a known online server
async function rescanServer(ip, port) {
  console.log(`Rescanning ${ip}:${port}...`);
  try {
    const data = await mc.ping({ host: ip, port: port, version: false });

    const logEntry = {
      time: new Date().toISOString(),
      ip: ip,
      port: port,
      version: data.version.name,
      onlinePlayers: data.players.online,
      maxPlayers: data.players.max,
      software: data.modinfo ? data.modinfo.type : 'Vanilla',
      isOfflineMode: data.modinfo ? data.modinfo.type === 'Vanilla' : false,
      playerNames: data.players.sample ? data.players.sample.map(player => player.name) : [],
    };

    // Append log entry to the server's log file
    const serverDir = path.join(logsDir, ip);
    const logFilePath = path.join(serverDir, 'log.json');
    fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + ',\n');
    console.log(`Updated log for ${ip}`);
  } catch (error) {
    console.log(`Failed to reach ${ip}:${port}`);
  }
}

// Function to rescan all detected servers periodically
async function rescanAllServers() {
  while (true) {
    const serverDirs = fs.readdirSync(logsDir).filter((dir) => {
      const serverPath = path.join(logsDir, dir);
      return fs.lstatSync(serverPath).isDirectory();
    });

    const scanPromises = serverDirs.map((ip) => rescanServer(ip, port));
    await Promise.allSettled(scanPromises);
    console.log(`Waiting ${scanInterval / 1000} seconds before next rescan...`);
    await new Promise((resolve) => setTimeout(resolve, scanInterval));
  }
}

// Start rescanning detected servers indefinitely
rescanAllServers();
