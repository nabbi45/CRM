import express from "express";
import nodemailer from "nodemailer";
import { CompanyProfileModel } from "../models/CompanyProfileModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";

const DocumentMailRoute = express.Router();

DocumentMailRoute.post("/send", authenticateUser, async (req, res) => {
    try {
        const {
            recipientEmail,
            ccEmails,
            subject,
            bodyHtml,
            documentDataUrl,
            documentFilename
        } = req.body;

        if (!recipientEmail || !documentDataUrl || !documentFilename) {
            return res.status(400).json({ message: "Missing required fields (recipient, document payload, or filename)." });
        }

        // Fetch company profile to get SMTP server creds
        const profile = await CompanyProfileModel.findOne();
        if (!profile || !profile.mail_host || !profile.mail_user) {
            return res.status(400).json({ message: "Company SMTP settings are not configured. Go to Company Profile → Email Dispatch Configuration." });
        }

        const smtpPort = parseInt(profile.mail_port) || 587;
        const isSecure = smtpPort === 465;

        // Optimized transporter for Hostinger/Zoho on cloud platforms like Render
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
                servername: profile.mail_host // Helps with ETIMEDOUT during handshake
            },
            connectionTimeout: 20000, // 20 seconds
            greetingTimeout: 20000,
            socketTimeout: 25000,
            debug: true,
            logger: true 
        });

        // Parse base64 document
        const base64Data = documentDataUrl.split(';base64,').pop();

        const mailOptions = {
            from: `"${profile.company_name}" <${profile.mail_user}>`,
            to: recipientEmail,
            cc: ccEmails || "",
            subject: subject || `Document from ${profile.company_name}`,
            html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            ${bodyHtml}
            <br/><br/>
            <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
            <table style="width: 100%; max-width: 600px;">
              <tr>
                ${profile.logo_url ? `<td style="width: 100px; padding-right: 20px;"><img src="${profile.logo_url}" alt="Logo" style="max-height: 80px; max-width: 100px;" /></td>` : ''}
                <td>
                  <p style="margin: 0; font-weight: bold; font-size: 16px; color: #1e3a8a;">${profile.company_name}</p>
                  <p style="margin: 5px 0 0 0; font-size: 12px; color: #555;">${profile.address}</p>
                  ${profile.contact_number ? `<p style="margin: 5px 0 0 0; font-size: 12px; color: #555;">Phone: ${profile.contact_number}</p>` : ''}
                  ${profile.email ? `<p style="margin: 5px 0 0 0; font-size: 12px; color: #555;">Email: ${profile.email}</p>` : ''}
                </td>
              </tr>
            </table>
        </div>
      `,
            attachments: [
                {
                    filename: documentFilename,
                    content: base64Data,
                    encoding: 'base64',
                    contentType: 'application/pdf'
                }
            ]
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: "Document sent successfully!" });
    } catch (error) {
        console.error("SERVER SMTP ERROR:", error);
        // Include the technical error directly in the message so the frontend shows it
        res.status(500).json({ 
            message: `SMTP Error: ${error.message} (Code: ${error.code || 'UNKNOWN'})`,
            technicalError: error.message,
            errorCode: error.code,
            command: error.command
        });
    }
});

export default DocumentMailRoute;
