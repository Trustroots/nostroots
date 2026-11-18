import { createServer } from 'http';
import { readFileSync, realpathSync, statSync } from 'fs';
import { join, extname, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const webRoot = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const port = 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpg',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  let filePath = req.url || '/';
  // Remove query string before treating as path
  filePath = filePath.split('?')[0];
  if (filePath === '/' || filePath === '') filePath = '/index.html';
  if (filePath.endsWith('/')) filePath += 'index.html';
  const requestedPath = join(webRoot, filePath);
  const requestedRelative = relative(webRoot, requestedPath);

  try {
    if (requestedRelative !== '..' && !requestedRelative.startsWith('..' + sep)) {
      const fullPath = realpathSync(requestedPath);
      const realRelative = relative(webRoot, fullPath);
      if (realRelative !== '..' && !realRelative.startsWith('..' + sep) && statSync(fullPath).isFile()) {
        const content = readFileSync(fullPath);
        const ext = extname(requestedPath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
      console.error('Error serving %s:', filePath, error);
      res.writeHead(500);
      res.end('Internal server error');
      return;
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Test server running on http://localhost:${port}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
