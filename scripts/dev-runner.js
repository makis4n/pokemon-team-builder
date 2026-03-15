const { spawn, exec } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

const rootDir = path.resolve(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function createPrefixedLogger(name, colorCode) {
  return (chunk, isError = false) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter((line) => line.length > 0);

    for (const line of lines) {
      const stream = isError ? process.stderr : process.stdout;
      stream.write(`\u001b[${colorCode}m[${name}]\u001b[0m ${line}\n`);
    }
  };
}

function spawnDevProcess(name, args, colorCode) {
  const child = spawn(npmCommand, args, {
    cwd: rootDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const log = createPrefixedLogger(name, colorCode);

  child.stdout.on('data', (chunk) => log(chunk));
  child.stderr.on('data', (chunk) => log(chunk, true));

  child.on('exit', (code, signal) => {
    process.stdout.write(
      `\u001b[${colorCode}m[${name}]\u001b[0m exited (code=${code ?? 'null'}, signal=${signal ?? 'none'})\n`,
    );
  });

  return child;
}

const processes = [
  spawnDevProcess('frontend', ['run', 'dev', '--prefix', 'frontend'], '31'),
  spawnDevProcess('backend', ['run', 'dev', '--prefix', 'backend'], '34'),
];

let isShuttingDown = false;

function shutdown() {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  process.stdout.write('\nStopping frontend and backend...\n');

  for (const child of processes) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }

  setTimeout(() => {
    for (const child of processes) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }
    process.exit(0);
  }, 500);
}

function checkFrontendUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  return fetch(`${url}/api/ping`, { signal: controller.signal })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => clearTimeout(timeout));
}

function openUrlInBrowser(url) {
  let command;

  if (process.platform === 'darwin') {
    command = `open ${url}`;
  } else if (process.platform === 'win32') {
    command = `start ${url}`;
  } else {
    command = `xdg-open ${url}`;
  }

  exec(command, (error) => {
    if (error) {
      process.stderr.write(`Failed to open browser automatically: ${error.message}\n`);
      process.stdout.write(`Open this URL manually: ${url}\n`);
      return;
    }
    process.stdout.write(`Opened ${url} in your browser.\n`);
  });
}

async function handleOpenCommand() {
  const candidates = ['http://localhost:5173', 'http://localhost:5174'];

  for (const url of candidates) {
    // Use the working URL if one of the Vite ports is active.
    // eslint-disable-next-line no-await-in-loop
    const isActive = await checkFrontendUrl(url);
    if (isActive) {
      openUrlInBrowser(url);
      return;
    }
  }

  openUrlInBrowser('http://localhost:5173');
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

process.stdout.write('Commands: [o] + Enter to open app, [q] + Enter to quit.\n');

rl.on('line', async (input) => {
  const command = input.trim().toLowerCase();

  if (command === 'q') {
    rl.close();
    shutdown();
    return;
  }

  if (command === 'o') {
    await handleOpenCommand();
    return;
  }

  process.stdout.write('Unknown command. Use o to open browser, q to quit.\n');
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
