import express from "express";
import nodemailer from "nodemailer";
import { CompanyProfileModel } from "../models/CompanyProfileModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const welcomeRoutes = express.Router();

// Send welcome email (authenticated users only)
welcomeRoutes.post("/api/welcome", authenticateUser, async (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ message: "Client email and name are required." });
  }

  try {
    // Fetch company profile for SMTP config + branding
    const profile = await CompanyProfileModel.findOne();

    if (!profile || !profile.mail_host || !profile.mail_user) {
      return res.status(400).json({ message: "SMTP settings not configured in Company Profile." });
    }

    const companyName = profile.company_name || "Our Company";
    const companyEmail = profile.email || profile.mail_user;
    const companyPhone = profile.contact_number || "";
    const companyAddress = profile.address || "";
    const logoUrl = profile.logo_url || "";

    const smtpPort = parseInt(profile.mail_port) || 587;
    const isSecure = smtpPort === 465;

    const transporter = nodemailer.createTransport({
      host: profile.mail_host,
      port: smtpPort,
      secure: isSecure,
      auth: {
        user: profile.mail_user,
        pass: profile.mail_password,
      },
      tls: {
        rejectUnauthorized: false,
        servername: profile.mail_host
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 25000,
      debug: true,
      logger: true
    });

    const mailOptions = {
      to: email,
      from: `"${companyName}" <${profile.mail_user}>`,
      subject: `Warm Welcome to ${name} from ${companyName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #333; line-height: 1.8;">
          
          ${logoUrl ? `<div style="text-align: center; padding: 30px 0 20px;"><img src="${logoUrl}" alt="${companyName}" style="max-height: 80px; object-fit: contain;" /></div>` : ''}
          
          <div style="background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 25px 30px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">Welcome Aboard! 🎉</h1>
          </div>

          <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 12px 12px;">
            
            <p style="font-size: 15px;">Dear Sir/Madam,</p>

            <p style="font-size: 15px;">
              We are pleased to extend a warm welcome to <b>${name}</b> as a valued client of 
              <b>${companyName}</b>. We sincerely appreciate the trust you've placed in us and are 
              excited about the opportunity to collaborate and contribute to your success.
            </p>

            <p style="font-size: 15px;">
              At <b>${companyName}</b>, we are dedicated to offering high-quality, tailored services 
              designed to meet the unique needs of <b>${name}</b>. Our experienced team is committed to providing 
              expert support and guidance at every stage of our partnership to ensure a smooth and successful experience.
            </p>

            <p style="font-size: 15px;">
              To facilitate a seamless process, one of our dedicated representatives will be in touch shortly 
              to coordinate with you and gather any necessary information. Please don't hesitate to reach out 
              with any questions, concerns, or special requests. Your satisfaction is our highest priority, and 
              we are here to support you every step of the way.
            </p>

            <p style="font-size: 15px;">
              Thank you once again for choosing <b>${companyName}</b>. We look forward to a successful 
              and fruitful collaboration, and to helping <b>${name}</b> achieve its business objectives.
            </p>

            ${companyEmail ? `<p style="font-size: 14px;">For any queries kindly mail us at <a href="mailto:${companyEmail}" style="color: #2563eb;">${companyEmail}</a></p>` : ''}

            <p style="color: #999; font-size: 13px; margin-top: 25px; font-style: italic;">
              This is a system-generated email. Please do not reply to this email.
            </p>
          </div>

          <!-- Email Signature -->
          <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <table style="width: 100%;">
              <tr>
                ${logoUrl ? `<td style="width: 90px; vertical-align: top; padding-right: 15px;"><img src="${logoUrl}" alt="Logo" style="max-height: 60px; max-width: 80px; object-fit: contain;" /></td>` : ''}
                <td style="vertical-align: top;">
                  <p style="margin: 0; font-weight: bold; font-size: 15px; color: #1e3a8a;">${companyName}</p>
                  ${companyAddress ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${companyAddress}</p>` : ''}
                  ${companyPhone ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">Phone: ${companyPhone}</p>` : ''}
                  ${companyEmail ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">Email: ${companyEmail}</p>` : ''}
                </td>
              </tr>
            </table>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Welcome Mail Sent Successfully." });
  } catch (error) {
    console.error("SERVER WELCOME SMTP ERROR:", error);
    res.status(500).json({ 
        message: `Welcome Mail SMTP Error: ${error.message} (Code: ${error.code || 'UNKNOWN'})`,
        technicalError: error.message,
        errorCode: error.code
    });
  }
});

export default welcomeRoutes;
