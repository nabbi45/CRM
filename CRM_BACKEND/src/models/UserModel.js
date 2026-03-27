import mongoose from "mongoose";

const userSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    user_role: { type: String, required: true },
    profilePicture: { type: String, default: "" }, // Add profile picture field
    isActive: { type: Boolean, default: false },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
  },
  { 
    timestamps: false, 
    versionKey: false
  }
);


export const UserModel = mongoose.model("user", userSchema);
