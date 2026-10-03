import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import apiRoutes from './routes.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

initDb();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', apiRoutes);

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

const startServer = (port = 5000) => {
  const server = app.listen(port, () => {
    console.log(`E-Commerce App running on http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, automatically switching to http://localhost:${port + 1}`);
      startServer(port + 1);
    } else {
      console.error(err);
    }
  });
};

startServer();
