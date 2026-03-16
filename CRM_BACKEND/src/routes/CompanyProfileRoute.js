import express from "express";
import { CompanyProfileModel } from "../models/CompanyProfileModel.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";

const CompanyProfileRoutes = express.Router();

// Get the single company profile
CompanyProfileRoutes.get("/", async (req, res) => {
    try {
        const profile = await CompanyProfileModel.findOne();
        if (!profile) {
            const defaultProfile = {
                company_name: "FARSIGHT PRIVATE LIMITED",
                address: "M-1 ARV PARK, office No.G-02, Noida, Uttar Pradesh, Sec-63 201301",
                contact_number: "+91 9810924009",
                email: "support@farsight.com",
                bank_name: "IDFC BANK",
                account_name: "Farsight Private Limited",
                account_number: "10239056265",
                ifsc_code: "IDFB0020151",
                gst_number: "N/A",
                pan_number: "N/A",
                logo_url: `${req.protocol}://${req.get('host')}/assets/logo.png`,
                seal_url: `${req.protocol}://${req.get('host')}/assets/stamp.jpg`
            };
            return res.status(200).send(defaultProfile);
        }

        const data = profile.toObject();

        // Ensure missing fields still gracefully fallback for UI mapping
        if (!data.logo_url) data.logo_url = `${req.protocol}://${req.get('host')}/assets/logo.png`;
        if (!data.seal_url) data.seal_url = `${req.protocol}://${req.get('host')}/assets/stamp.jpg`;
        if (!data.mail_host) data.mail_host = '';
        if (!data.mail_port) data.mail_port = '';
        if (!data.mail_user) data.mail_user = '';
        if (!data.mail_password) data.mail_password = '';
        if (!data.default_cc) data.default_cc = '';

        return res.status(200).send(data);
    } catch (error) {
        console.error("Error fetching company profile:", error);
        return res.status(500).send({ message: error.message });
    }
});

// Public route for login page branding (no auth required)
CompanyProfileRoutes.get("/public", async (req, res) => {
    try {
        const profile = await CompanyProfileModel.findOne();
        const fallbackLogo = `${req.protocol}://${req.get('host')}/assets/logo.png`;
        if (!profile) {
            return res.status(200).send({
                company_name: "FARSIGHT PRIVATE LIMITED",
                logo_url: fallbackLogo
            });
        }
        return res.status(200).send({
            company_name: profile.company_name || "My Company",
            logo_url: profile.logo_url || fallbackLogo
        });
    } catch (error) {
        return res.status(500).send({ message: error.message });
    }
});

// Update or Create the company profile
CompanyProfileRoutes.post("/update", authenticateUser, async (req, res) => {
    try {
        const userRole = req.headers["user-role"];
        if (userRole !== "admin" && userRole !== "srdev" && userRole !== "dev") {
            return res.status(403).send({ message: "Not authorized to update company profile." });
        }

        const data = req.body;
        data.updatedBy = req.user?.name || "Unknown";

        let profile = await CompanyProfileModel.findOne();

        if (profile) {
            // Update existing
            profile = await CompanyProfileModel.findByIdAndUpdate(profile._id, data, { new: true });
        } else {
            // Create new
            profile = await CompanyProfileModel.create(data);
        }

        return res.status(200).send({ message: "Company Profile Updated Successfully", profile });
    } catch (error) {
        console.error("Error updating company profile:", error);
        return res.status(500).send({ message: error.message });
    }
});

// Upload Company Logo
CompanyProfileRoutes.post('/upload-logo', authenticateUser, upload.single('logo'), async (req, res) => {
    try {
        const userRole = req.headers["user-role"];
        if (userRole !== "admin" && userRole !== "srdev" && userRole !== "dev") {
            return res.status(403).send({ message: "Not authorized to upload company logo." });
        }

        if (!req.file) {
            return res.status(400).send({ message: "No file uploaded" });
        }

        const logo_url = req.file.path; // Cloudinary URL

        let profile = await CompanyProfileModel.findOne();
        if (profile) {
            profile = await CompanyProfileModel.findByIdAndUpdate(profile._id, { logo_url }, { new: true });
        } else {
            profile = await CompanyProfileModel.create({ logo_url, company_name: "My Company", address: "Please update address" });
        }

        return res.status(200).send({ message: "Logo updated successfully", logo_url, profile });
    } catch (error) {
        console.error("Error uploading logo:", error);
        return res.status(500).send({ message: "Error uploading logo" });
    }
});

// Upload Company Seal
CompanyProfileRoutes.post('/upload-seal', authenticateUser, upload.single('seal'), async (req, res) => {
    try {
        const userRole = req.headers["user-role"];
        if (userRole !== "admin" && userRole !== "srdev" && userRole !== "dev") {
            return res.status(403).send({ message: "Not authorized to upload company seal." });
        }

        if (!req.file) {
            return res.status(400).send({ message: "No file uploaded" });
        }

        const seal_url = req.file.path; // Cloudinary URL

        let profile = await CompanyProfileModel.findOne();
        if (profile) {
            profile = await CompanyProfileModel.findByIdAndUpdate(profile._id, { seal_url }, { new: true });
        } else {
            profile = await CompanyProfileModel.create({ seal_url, company_name: "My Company", address: "Please update address" });
        }

        return res.status(200).send({ message: "Seal updated successfully", seal_url, profile });
    } catch (error) {
        console.error("Error uploading seal:", error);
        return res.status(500).send({ message: "Error uploading seal" });
    }
});

export default CompanyProfileRoutes;
