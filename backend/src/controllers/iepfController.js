const nodemailer = require('nodemailer');
const { Iepf } = require('../models');

function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendIepfEmail(record) {
  const to = process.env.IEPF_EMAIL_TO || process.env.INQUIRY_EMAIL_TO || process.env.SMTP_USER || 'sales.clearclaim@gmail.com';
  if (!to) return { sent: false, error: 'No IEPF_EMAIL_TO / INQUIRY_EMAIL_TO / SMTP_USER set' };

  const transporter = getTransporter();
  if (!transporter) return { sent: false, error: 'SMTP not configured (SMTP_USER, SMTP_PASS)' };

  const html = `
    <h2>IEPF – New Form Submission</h2>
    <p><strong>Name:</strong> ${record.name}</p>
    <p><strong>Mobile number:</strong> ${record.mobileNumber}</p>
    <p><strong>Email:</strong> ${record.email}</p>
    <p><strong>City:</strong> ${record.city}</p>
    <hr>
    <p><em>Submitted at ${record.createdAt ? new Date(record.createdAt).toLocaleString() : ''}</em></p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `IEPF form – ${record.name}`,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('IEPF email error:', err);
    return { sent: false, error: err.message };
  }
}

exports.list = async (req, res) => {
  try {
    const list = await Iepf.findAll({
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'mobileNumber', 'email', 'city', 'createdAt']
    });
    res.json({ iepfForms: list });
  } catch (error) {
    console.error('List IEPF forms error:', error);
    res.status(500).json({ error: 'Failed to fetch IEPF forms' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, mobileNumber, email, city } = req.body;

    if (!name || !mobileNumber || !email || !city) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'mobileNumber', 'email', 'city']
      });
    }

    const record = await Iepf.create({
      name,
      mobileNumber,
      email,
      city
    });

    const emailResult = await sendIepfEmail(record);
    if (!emailResult.sent) {
      console.warn('IEPF form saved but email failed:', emailResult.error);
    }

    res.status(201).json({
      message: 'IEPF form submitted successfully',
      id: record.id,
      emailSent: emailResult.sent,
      ...(emailResult.error && { emailError: emailResult.error })
    });
  } catch (error) {
    console.error('Create IEPF form error:', error);
    res.status(500).json({ error: 'Failed to submit IEPF form' });
  }
};
