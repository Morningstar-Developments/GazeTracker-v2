import express from 'express';
import cors from 'cors';
import net from 'net';
import gazeRoutes from './routes/gaze';

const app = express();
const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const MAX_PORT_ATTEMPTS = 10;

// Function to check if a port is available
async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        server.close();
        resolve(true);
      })
      .listen(port);
  });
}

// Function to find an available port
async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found between ${startPort} and ${startPort + MAX_PORT_ATTEMPTS - 1}`);
}

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', gazeRoutes);

// Start server with automatic port selection
async function startServer() {
  try {
    const port = await findAvailablePort(DEFAULT_PORT);
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      if (port !== DEFAULT_PORT) {
        console.log(`Note: Default port ${DEFAULT_PORT} was in use, automatically switched to port ${port}`);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Initialize server
startServer().catch(console.error); 