import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import nodemailer from 'nodemailer';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensuring we use absolute path
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    console.log('📝 Generating filename for:', file.originalname);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB limit
});

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(cors());
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ extended: true, limit: '200mb' }));

  // Serve uploads statically
  app.use('/uploads', express.static(uploadsDir));

  // Upload API Route
  app.post('/api/upload', (req, res, next) => {
    console.log('📬 Upload request received', req.headers['content-type'], 'Size:', req.headers['content-length']);
    next();
  }, upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
      console.error('❌ No file in request. Body:', req.body);
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log('✅ File uploaded successfully:', req.file.path, 'Size:', req.file.size);
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  });

  // Email API Route
  app.post('/api/book-call', async (req: Request, res: Response) => {
    console.log('🚀 Received booking request:', req.body.name);
    const { name, country, whatsapp, cart, total, interest, type } = req.body;

    // Check if email env vars are set
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ SMTP settings not configured.');
      return res.status(200).json({ success: true, message: 'Simulated success' });
    }

    try {
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpPort === 465, // Only true for 465 (SMTPS), false for 587 (STARTTLS)
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
        tls: {
          rejectUnauthorized: false
        }
      });

      const isVideoCall = type === 'video-call';
      const subject = isVideoCall ? `NEW BOOKING: ${name} from ${country}` : `NEW INQUIRY: ${name} from ${country}`;
      
      let itemsHtml = "";
      if (cart && Array.isArray(cart) && cart.length > 0) {
        itemsHtml = cart.map((item: any) => `
          <div style="border-bottom: 1px solid #f1f1f1; padding: 10px 0; display: flex; align-items: center;">
            <img src="${item.image}" style="width: 50px; height: 50px; object-fit: cover; margin-right: 15px; border-radius: 4px;" onerror="this.style.display='none'" />
            <div>
              <div style="font-weight: bold; color: #333;">${item.name || 'Bespoke Selection'}</div>
              <div style="font-size: 11px; color: #888;">${item.subcategory || item.category || 'Collection Piece'}</div>
              ${item.price ? `<div style="font-weight: bold; color: #D4AF37;">$${item.price.toLocaleString()}</div>` : '<div style="font-size: 10px; color: #D4AF37; font-style: italic;">Injected Interest</div>'}
            </div>
          </div>
        `).join('');
      } else {
        itemsHtml = "<p style='color: #888; font-style: italic;'>No specific designs selected.</p>";
      }

      const htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital@1&family=Inter:wght@400;700&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 40px; background-color: #fdfcf9; font-family: 'Inter', sans-serif; color: #111;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2d1b3; padding: 60px; box-shadow: 0 20px 40px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 40px;">
              <h1 style="font-family: 'Bodoni Moda', serif; font-style: italic; color: #D4AF37; font-size: 32px; letter-spacing: 0.1em; margin: 0; text-transform: uppercase;">Pakizaah Boutique</h1>
              <p style="text-transform: uppercase; letter-spacing: 0.3em; font-size: 10px; color: #888; margin-top: 10px;">${isVideoCall ? 'Priority Video Call Request' : 'Bespoke Collection Inquiry'}</p>
            </div>

            <div style="background-color: #fdfcf9; padding: 30px; border-radius: 8px; margin-bottom: 40px; border: 1px dashed #D4AF37;">
              <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid #e2d1b3; padding-bottom: 15px; margin-bottom: 20px; color: #D4AF37;">Customer Profile</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; color: #888; font-size: 13px; width: 120px;">Name:</td>
                  <td style="padding: 10px 0; font-weight: bold; font-size: 15px;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #888; font-size: 13px;">Country:</td>
                  <td style="padding: 10px 0; font-weight: bold;">${country}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #888; font-size: 13px;">WhatsApp/Tel:</td>
                  <td style="padding: 10px 0; font-weight: bold; color: #10B981;">${whatsapp}</td>
                </tr>
                ${interest ? `
                <tr>
                  <td style="padding: 10px 0; color: #888; font-size: 13px;">Interest/Email:</td>
                  <td style="padding: 10px 0; font-weight: bold;">${interest}</td>
                </tr>` : ''}
              </table>
            </div>

            <div style="margin-bottom: 40px;">
              <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; color: #333;">Requested Masterpieces:</h2>
              ${itemsHtml}
              ${total && total !== '0' ? `<div style="text-align: right; margin-top: 20px; font-weight: bold; font-size: 18px; color: #D4AF37;">Total Est: ${total}</div>` : ''}
            </div>

            <div style="text-align: center; border-top: 1px solid #e2d1b3; padding-top: 30px;">
              <p style="font-size: 10px; color: #888; letter-spacing: 0.1em; text-transform: uppercase;">Sent from Pakizaah Boutique Digital Atelier</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const recipient = process.env.BOOKING_EMAIL || 'hello@pakizaah.com';
      const mailOptions = {
        from: `"Pakizaah Boutique" <${process.env.SMTP_USER}>`,
        to: recipient,
        replyTo: interest && interest.includes('@') ? interest : undefined,
        subject: subject,
        html: htmlBody,
      };

      console.log('✉️ Attempting to send email to:', recipient);
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error('❌ Email error:', error);
      res.status(500).json({ success: false, error: 'Failed to send' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the dist folder
    app.use(express.static(path.join(__dirname, 'dist')));

    // Handle SPA routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(port), "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
  });
}

startServer().catch(err => {
  console.error("🔥 Server failed to start:", err);
  process.exit(1);
});
