import express from 'express';
import cors from 'cors';
import poseRouter from './routes/pose';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rectpose-vision-backend' });
});

app.use('/api/pose', poseRouter);

app.listen(PORT, () => {
  console.log(`[RectPose Vision Backend] Listening on port ${PORT}`);
});
