const nodemailer = require('nodemailer');
const { Inquiry } = require('../models');

// Create transporter from env (e.g. SMTP or Gmail)
// Required env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, INQUIRY_EMAIL_TO (where to send)
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendInquiryEmail(inquiry) {
  const to = process.env.INQUIRY_EMAIL_TO || process.env.SMTP_USER || 'sales.clearclaim@gmail.com';
  if (!to) return { sent: false, error: 'No INQUIRY_EMAIL_TO or SMTP_USER set' };

  const transporter = getTransporter();
  if (!transporter) return { sent: false, error: 'SMTP not configured (SMTP_USER, SMTP_PASS)' };

  const html = `
    <h2>New Unclaimed Investments Inquiry</h2>
    <p><strong>Name:</strong> ${inquiry.name}</p>
    <p><strong>Country of Residence:</strong> ${inquiry.country_of_residence}</p>
    <p><strong>WhatsApp:</strong> ${inquiry.whatsapp_number}</p>
    <p><strong>Email:</strong> ${inquiry.email}</p>
    <p><strong>Type of Unclaimed Investments:</strong> ${inquiry.type_of_unclaimed_investments}</p>
    <p><strong>Preferred Callback Time (IST):</strong> ${inquiry.preferred_callback_time}</p>
    <hr>
    <p><em>Submitted at ${inquiry.createdAt ? new Date(inquiry.createdAt).toLocaleString() : ''}</em></p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: `ClearClaim Inquiry: ${inquiry.type_of_unclaimed_investments} - ${inquiry.name}`,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('Nodemailer error:', err);
    return { sent: false, error: err.message };
  }
}

exports.create = async (req, res) => {
  try {
    const { name, country_of_residence, whatsapp_number, email, type_of_unclaimed_investments, preferred_callback_time } = req.body;

    if (!name || !country_of_residence || !whatsapp_number || !email || !type_of_unclaimed_investments || !preferred_callback_time) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'country_of_residence', 'whatsapp_number', 'email', 'type_of_unclaimed_investments', 'preferred_callback_time']
      });
    }

    const inquiry = await Inquiry.create({
      name,
      country_of_residence,
      whatsapp_number,
      email,
      type_of_unclaimed_investments,
      preferred_callback_time
    });

    const emailResult = await sendInquiryEmail(inquiry);
    if (!emailResult.sent) {
      console.warn('Inquiry saved but email failed:', emailResult.error);
    }

    res.status(201).json({
      message: 'Inquiry submitted successfully',
      id: inquiry.id,
      emailSent: emailResult.sent,
      ...(emailResult.error && { emailError: emailResult.error })
    });
  } catch (error) {
    console.error('Create inquiry error:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
};

exports.list = async (req, res) => {
  try {
    const inquiries = await Inquiry.findAll({
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'country_of_residence', 'whatsapp_number', 'email', 'type_of_unclaimed_investments', 'preferred_callback_time', 'createdAt']
    });
    res.json({ inquiries });
  } catch (error) {
    console.error('List inquiries error:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
};

exports.getOptions = (req, res) => {
  res.json({
    investmentTypes: Inquiry.INVESTMENT_TYPES,
    callbackTimeSlots: Inquiry.CALLBACK_TIME_SLOTS
  });
};
