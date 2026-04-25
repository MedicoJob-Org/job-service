const Job = require('../models/Job');

let io;
exports.setIo = (socketIo) => {
  io = socketIo;
};

exports.createJob = async (req, res) => {
  try {
    const job = new Job({ ...req.body, hospitalId: req.user.id });
    await job.save();
    if (io) io.emit('jobCreated', job);
    res.status(201).json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getJobs = async (req, res) => {
  try {
    const { specialization, location, status } = req.query;
    const filter = {};
    if (specialization) filter.specialization = specialization;
    if (location) filter.location = new RegExp(location, 'i');
    if (status && status !== 'all') filter.status = status;
    
    const jobs = await Job.find(filter).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.applyForJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    // Check if already applied
    if (job.applications.some(a => a.doctorId === req.user.id)) {
      return res.status(400).json({ message: 'Already applied' });
    }

    job.applications.push({
      doctorId: req.user.id,
      applicantName: req.body.name || '',
      applicantEmail: req.body.email || '',
      applicantSpecialization: req.body.specialization || '',
      status: 'applied'
    });

    await job.save();
    if (io) io.emit('newApplication', { jobId: job._id, doctorId: req.user.id });
    res.json({ message: 'Applied successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMyApplications = async (req, res) => {
  try {
    const jobs = await Job.find({ 'applications.doctorId': req.user.id });
    const formatted = jobs.map(job => {
      const app = job.applications.find(a => a.doctorId === req.user.id);
      return {
        jobId: job._id,
        title: job.title,
        specialization: job.specialization,
        location: job.location,
        salary: job.salary,
        appliedAt: app.appliedAt,
        applicationStatus: app.status,
        rejectionReason: app.rejectionReason,
        nextStep: app.nextStep
      };
    });
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateApplicationStatus = async (req, res) => {
  try {
    const { jobId, doctorId } = req.params;
    const { status, rejectionReason, nextStep } = req.body;

    const job = await Job.findOne({ _id: jobId, hospitalId: req.user.id });
    if (!job) return res.status(404).json({ message: 'Job not found or unauthorized' });

    const application = job.applications.find(a => a.doctorId === doctorId);
    if (!application) return res.status(404).json({ message: 'Application not found' });

    application.status = status;
    if (status === 'rejected' && rejectionReason) application.rejectionReason = rejectionReason;
    if (status === 'shortlisted' && nextStep) application.nextStep = nextStep;

    await job.save();
    if (io) io.emit('applicationStatusUpdated', { jobId, doctorId, status });
    res.json({ message: 'Status updated', job });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteJob = async (req, res) => {
  console.log(`[JOB] Attempting to delete job: ${req.params.id} for hospital: ${req.user.id}`);
  try {
    const job = await Job.findOneAndDelete({ _id: req.params.id, hospitalId: req.user.id });
    if (!job) {
      console.warn(`[JOB] Delete Failed: Job not found or unauthorized. ID: ${req.params.id}, Hospital: ${req.user.id}`);
      return res.status(404).json({ message: 'Job not found or unauthorized' });
    }
    
    console.log(`[JOB] Job deleted successfully: ${req.params.id}`);
    if (io) io.emit('jobDeleted', req.params.id);
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error(`[JOB] Delete Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};
