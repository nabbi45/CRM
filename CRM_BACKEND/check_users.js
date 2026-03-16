import mongoose from "mongoose";
import dotenv from "dotenv";
import { UserModel } from "./src/models/UserModel.js";

dotenv.config();

async function check() {
    await mongoose.connect(process.env.Mongo_URL);
    const users = await UserModel.find({});
    console.log("Users:", users);
    process.exit();
}
check();
