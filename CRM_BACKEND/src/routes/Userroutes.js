import express from "express";
import { UserModel } from "../models/UserModel.js";
import { BookingModel } from "../models/bookingModel.js";
import crypto from 'crypto';  // Used to generate random tokens
import nodemailer from 'nodemailer';  // Used to send emails
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { authenticateUser, authorizeDevRole } from '../middlewares/authMiddleware.js';
dotenv.config()
const saltRounds = 5;

const UserRoutes = express.Router();

//Creating User
UserRoutes.post("/adduser",authenticateUser, authorizeDevRole, async (req, res) => {
  try {
    const { name, email, password, user_role } = req.body;
    // Check if all required fields are provided
    if (!name || !email || !password) {
      return res.status(400).send({
        message: "send all required fields: name, email, password",
      });
    }

    // Convert email to lowercase
    const normalizedEmail = email.toLowerCase();

    // Check if the email is already registered
    const existingUser = await UserModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).send({ message: "Email is already registered" });
    }

    // Hash the password before saving the user
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user with hashed password
    const new_user = {
      name,
      email: normalizedEmail,
      password: hashedPassword,
      user_role
    };

    const User = await UserModel.create(new_user);
    return res.status(201).send(User);

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

//edit user
UserRoutes.patch('/edituser/:id', authenticateUser, authorizeDevRole,async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Ensure there are fields to update
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).send({ message: 'No fields provided for update' });
    }

    // Normalize email if it's being updated
    if (updates.email) {
      updates.email = updates.email.toLowerCase();

      // Check if the new email is already registered
      const existingUser = await UserModel.findOne({ email: updates.email, _id: { $ne: id } });
      if (existingUser) {
        return res.status(409).send({ message: 'Email is already registered' });
      }
    }

    // Hash the password if it's being updated
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, saltRounds);
    }

    // Update user by ID
    const updatedUser = await UserModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true } // Return updated user and validate fields
    );

    if (!updatedUser) {
      return res.status(404).send({ message: 'User not found' });
    }

    return res.status(200).send({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({ message: error.message });
  }
});


// Deleting User
UserRoutes.delete("/deleteuser/:id",authenticateUser, authorizeDevRole ,async (req, res) => {
  try {
    const { id } = req.params; // Assuming you are using a unique ID for the user

    // Check if the user exists
    const existingUser = await UserModel.findById(id);
    if (!existingUser) {
      return res.status(404).send({ message: "User not found" });
    }

    // Delete the user
    await UserModel.findByIdAndDelete(id);

    return res.status(200).send({ message: "User deleted successfully" });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});
//listing all users
UserRoutes.get('/all', authenticateUser, authorizeDevRole, async (req, res) => {
  try {
    const Users = await UserModel.find({}).select("-password");
    if (Users.length === 0) {
      return res.status(404).send({
        message: "No Users found",
      });
    }
    const no_of_users = Users.length;
    // console.log(no_of_users);

    res.status(200).send({ Users })
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
})

// Assuming you already have the user object after login
export const generateToken = (user) => {
  return jwt.sign({ userId: user._id, user_role: user.user_role }, process.env.JWT_SECRET, {
    expiresIn: '24h', // Set token expiration time
  });
};
//login
UserRoutes.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).send({
        message: "Please provide both email and password.",
      });
    }

    // Find the user by email
    const user = await UserModel.findOneAndUpdate({ email },{isActive:true});
    

    if (!user) {
      return res.status(404).send({
        message: "User not found.",
      });
    }

    // Compare the provided password with the stored hashed password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).send({
        message: "Invalid email or password.",
      });
    }
    const token = generateToken(user); // Generate JWT token

    // If credentials are valid, send a success response
    res.status(200).send({
     token,user
    });

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

//logout
UserRoutes.patch('/logout/:id',async(req,res)=>{
  const {id}= req.params
  try {
    const user = await UserModel.findByIdAndUpdate(id,{isActive:false})
    
    if (!user) {
      return res.status(404).send({
        message: "User not found.",
      });
    }
    res.send(user)
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});



//getting all the bookings for specific user

UserRoutes.get('/bookings/:id', authenticateUser,async (req, res) => {
  const id = req.params.id;
  try {
    if (!req.params.id) {
      return res.status(400).send({
        message: "Not A VALID USER",
      });
    }
    const Bookings = await BookingModel.find({ user_id: id });
    //  console.log(Bookings)
    if (Bookings.length === 0) {
      return res.status(404).send({
        message: "No bookings found for this user",
      });
    }
    res.status(200).send(Bookings)

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
})

//unified search 
UserRoutes.get('/:id?', authenticateUser,async (req, res) => {
  const booking_id = req.params.id; // This may be undefined if no id is provided
  const searchPattern = req.query.pattern; // Search pattern from the query parameter
  const userRole = req.query.userRole; // Assuming user's role is stored in req.user
  const userId = req.query.userId; // Assuming user's ID is stored in req.user
// console.log(userRole,userId);
let contactNo=parseInt(searchPattern)

  try {
    let Booking;

    if (booking_id) {
      // If an ID is provided, search by the booking ID
      if (['dev', 'admin', 'senior admin', 'srdev'].includes(userRole)) {
        Booking = await BookingModel.find({ _id: booking_id });
      } else {
        // If the user is not dev, admin, or senior admin, search only within their bookings
        Booking = await BookingModel.find({ _id: booking_id, user_id: userId });
      }

      if (Booking.length === 0) {
        return res.status(404).send({
          message: "No bookings found with this id",
        });
      }
    } else if (searchPattern) {
      // Combine search for both company_name and contact_person under the same pattern
      const searchQuery = {
        $or: [
          { company_name: { $regex: searchPattern, $options: 'i' } },
          { contact_person: { $regex: searchPattern, $options: 'i' } },
          { email: { $regex: searchPattern, $options: 'i' } },
          { pan: { $regex: searchPattern, $options: 'i' } },
          { gst: { $regex: searchPattern, $options: 'i' } },
          { services: { $regex: searchPattern, $options: 'i' } },
          { bdm: { $regex: searchPattern, $options: 'i' } },
          { $expr: { $regexMatch: { input: { $toString: "$contact_no" }, regex: searchPattern } } }
        ]
      };

      if (['dev', 'admin', 'senior admin', 'srdev'].includes(userRole)) {
        Booking = await BookingModel.find(searchQuery);
      } else {
        // Search within user's bookings only if not dev, admin, or senior admin
        Booking = await BookingModel.find({
          ...searchQuery,
          user_id: userId // Ensure the user only gets their own bookings
        });
      }

      if (Booking.length === 0) {
        return res.status(404).send({
          message: "No bookings found matching the pattern",
        });
      }
    } else {
      // If neither an ID nor a search pattern is provided, return an error
      return res.status(400).send({
        message: "Either id or pattern query parameter is required",
      });
    }    
    res.status(200).send(Booking);

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

//check user is a valid or not 
UserRoutes.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    if (!req.params.id) {
      return res.status(400).send({
        message: "Not A VALID USER",
      });
    }
    const User = await UserModel.find({ _id: id });
    //  console.log(Bookings)
    if (User.length === 0) {
      return res.status(404).send({
        message: "No User found with this id",
        status: false
      });
    }
    res.status(200).send({ message: "VALID USER", status: true })

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
})

//
UserRoutes.put('/password-reset', async (req, res) => {
  const { password, email } = req.body;

  // Validate if email and password are provided
  if (!email || !password) {
    return res.status(400).send({
      message: "Please provide both email and new password",
    });
  }

  // Convert email to lowercase
  const normalizedEmail = email.toLowerCase();

  try {
    // Find the user by email
    const user = await UserModel.findOne({ email: normalizedEmail });

    // If no user is found, send an error response
    if (!user) {
      return res.status(404).send({ message: "User not found with this email" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    // Send success response
    return res.status(200).send({ message: "Password updated successfully" });

  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

// Route to request password reset
UserRoutes.post('/request-reset-password', async (req, res) => {
  const { email } = req.body;

  try {
    // Find the user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    // console.log(user);

    // Generate a reset token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Token expires in 1 hour
    const resetPasswordExpires = Date.now() + 3600000;

    // Save the token and expiration to the user's document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetPasswordExpires;
    await user.save();

    // Create a reset URL with the token
    const resetUrl = `http://localhost:5353/user/reset-password/${resetToken}`;

    // Send an email with the reset link (setup `nodemailer` transport)
    const transporter = nodemailer.createTransport({
      host: "smtp.hostinger.com",
      port: 465,
      secure: true, // true for port 465, false for other ports
      auth: {
        user: "siteadmin@enego.co.in",
        pass: "Siteadmin@enego@321",
      },
    });

    const mailOptions = {
      to: user.email,
      from: 'siteadmin@enego.co.in',
      subject: 'Password Reset Request',
      text: `You are receiving this email because you (or someone else) have requested to reset the password for your account.\n\n
      Please click the following link, or paste it into your browser to complete the process:\n\n
      ${resetUrl}\n\n
      If you did not request this, please ignore this email and your password will remain unchanged.`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

//password reset route
UserRoutes.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
    // Find the user by reset token and check if the token is still valid
    const user = await UserModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }  // Check if token has not expired
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(5);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Save the new password and clear the reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default UserRoutes;