import express, {Application, Request, Response } from 'express';
import userRoutes from './routes/userRoutes';
import errorHandler from './middlewares/errorHandler';
import uploadRoutes from './routes/uploadRoutes';
import path from 'path';

const cors=require('cors');

const app: Application = express();
const port: number = 3000;

// Configure CORS
app.use(cors({
  origin: 'http://localhost:4200', // Allow requests from this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed HTTP methods
  credentials: true // Allow cookies and credentials
}));

app.get('/', (req: Request, res: Response) => {
  console.log("request received: ");
  res.send('Hello, World!');
});

app.use('/api', userRoutes);
app.use('/api', uploadRoutes); 
app.use(errorHandler);

app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'))
);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});