import express, {Application, Request, Response } from 'express';
import path from 'path';
import userRoutes from './routes/userRoutes';
import errorHandler from './middlewares/errorHandler';
import uploadRoutes from './routes/uploadRoutes';
import translationRoutes from './routes/translationRoutes';
import { config } from './config';

const cors=require('cors');

const app: Application = express();
const port: number = config.port;

// Basic request/response logging to trace the path from the frontend
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Configure CORS
app.use(cors({
  origin: config.corsOrigin, // Allow requests from this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed HTTP methods
  credentials: true // Allow cookies and credentials
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req: Request, res: Response) => {
  console.log("request received: ");
  res.send('Hello, World!');
});

app.use('/api', userRoutes);
app.use('/api', uploadRoutes); 
app.use('/api', translationRoutes);
app.use(errorHandler);

app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'))
);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
