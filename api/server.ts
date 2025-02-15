import express from 'express';
import cors from 'cors';
import gazeRoutes from './routes/gaze';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', gazeRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 