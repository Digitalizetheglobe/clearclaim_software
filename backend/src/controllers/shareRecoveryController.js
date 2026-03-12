const nodemailer = require('nodemailer');
const { ShareRecovery } = require('../models');

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

async function sendShareRecoveryEmail(record) {
  const to = process.env.SHARE_RECOVERY_EMAIL_TO || process.env.INQUIRY_EMAIL_TO || process.env.SMTP_USER || 'sales.clearclaim@gmail.com';
  if (!to) return { sent: false, error: 'No SHARE_RECOVERY_EMAIL_TO / INQUIRY_EMAIL_TO / SMTP_USER set' };

  const transporter = getTransporter();
  if (!transporter) return { sent: false, error: 'SMTP not configured (SMTP_USER, SMTP_PASS)' };

  const html = `
    <h2>Recovery of Share – New Form Submission</h2>
    <p><strong>Name:</strong> ${record.name}</p>
    <p><strong>Email:</strong> ${record.email}</p>
    <p><strong>Subject:</strong> ${record.subject}</p>
    <p><strong>Message:</strong></p>
    <p>${(record.message || '').replace(/\n/g, '<br>')}</p>
    <hr>
    <p><em>Submitted at ${record.createdAt ? new Date(record.createdAt).toLocaleString() : ''}</em></p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `Recovery of Share: ${record.subject} – ${record.name}`,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('Share recovery email error:', err);
    return { sent: false, error: err.message };
  }
}

exports.list = async (req, res) => {
  try {
    const list = await ShareRecovery.findAll({
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'subject', 'message', 'createdAt']
    });
    res.json({ shareRecoveries: list });
  } catch (error) {
    console.error('List share recoveries error:', error);
    res.status(500).json({ error: 'Failed to fetch share recoveries' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'email', 'subject', 'message']
      });
    }

    const record = await ShareRecovery.create({
      name,
      email,
      subject,
      message
    });

    const emailResult = await sendShareRecoveryEmail(record);
    if (!emailResult.sent) {
      console.warn('Share recovery saved but email failed:', emailResult.error);
    }

    res.status(201).json({
      message: 'Recovery of share form submitted successfully',
      id: record.id,
      emailSent: emailResult.sent,
      ...(emailResult.error && { emailError: emailResult.error })
    });
  } catch (error) {
    console.error('Create share recovery error:', error);
    res.status(500).json({ error: 'Failed to submit recovery of share form' });
  }
};
