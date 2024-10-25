const mc = require('minecraft-protocol');
const fs = require('fs');
const path = require('path');

const port = 25565; // Default Minecraft port
const maxConcurrentScans = 200; // Number of parallel scans
const timeoutMs = 3000; // Timeout in milliseconds

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Function to generate a random IP address, avoiding 127 and 0
function getRandomIp() {
  let ip;
  do {
    ip = `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
  } while (ip.startsWith('127.') || ip.startsWith('0.'));
  return ip;
}

// Timeout wrapper for the scan function
function scanWithTimeout(ip, port, timeout) {
  return Promise.race([
    mc.ping({ host: ip, port: port, version: false }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), timeout)
    ),
  ]);
}

// Function to scan a single IP with timeout
async function scanIp(ip, port) {
  console.log(`Scanning ${ip}:${port}...`); // Log IP before scanning
  try {
    const data = await scanWithTimeout(ip, port, timeoutMs);

    // Determine if server is offline mode based on properties (approximate)
    const isOfflineMode = data.modinfo ? data.modinfo.type === 'Vanilla' : false;

    // Extract player names if available
    const playerNames = data.players.sample
      ? data.players.sample.map(player => player.name)
      : [];

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

    console.log(`Found server at ${ip}:${port}`, logEntry);

    // Create a directory for the server using its IP address
    const serverDir = path.join(logsDir, ip);
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir);
    }

    // Append log entry to the server's log file
    const logFilePath = path.join(serverDir, 'log.json');
    fs.appendFileSync(logFilePath, JSON.stringify(logEntry) + ',\n');
  } catch (error) {
    console.log(`No server at ${ip}:${port} or Timeout`);
  }
}

// Function to manage indefinite parallel scanning
async function scanRandomIpsIndefinitely(port, maxConcurrentScans) {
  while (true) {
    const scanPromises = [];
    for (let i = 0; i < maxConcurrentScans; i++) {
      const ip = getRandomIp();
      scanPromises.push(scanIp(ip, port));
    }
    await Promise.allSettled(scanPromises);
  }
}

// Run the scanner indefinitely
scanRandomIpsIndefinitely(port, maxConcurrentScans);
