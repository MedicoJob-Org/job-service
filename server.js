require('dotenv').config({ path: '../../.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
const jobRoutes = require('./routes/jobRoutes');
const jobController = require('./controllers/jobController');
const Job = require('./models/Job');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

jobController.setIo(io);

app.use('/jobs', jobRoutes);

// Cron job to auto-close expired jobs every hour
cron.schedule('0 * * * *', async () => {
  try {
    const result = await Job.updateMany(
      { status: 'open', expiryDate: { $lt: new Date() } },
      { $set: { status: 'closed' } }
    );
    console.log(`Auto-closed ${result.modifiedCount} expired jobs`);
  } catch (err) {
    console.error('Error auto-closing jobs:', err);
  }
});

mongoose.connect(process.env.MONGO_URI_JOB || process.env.MONGO_URI)
  .then(() => console.log('Job Service DB Connected'))
  .catch(err => console.error(err));

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => console.log(`Job Service running on port ${PORT}`));
