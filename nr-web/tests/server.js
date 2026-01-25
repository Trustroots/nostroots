import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const port = 8080;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  // Remove query string
  filePath = filePath.split('?')[0];
  const fullPath = join(__dirname, '..', filePath);

  if (existsSync(fullPath) && statSync(fullPath).isFile()) {
    try {
      const content = readFileSync(fullPath);
      const ext = extname(fullPath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      console.error(`Error serving ${filePath}:`, error);
      res.writeHead(500);
      res.end('Internal server error');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
