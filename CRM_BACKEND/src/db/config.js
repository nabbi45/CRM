import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

export const PORT = process.env.PORT || 8000 ;

export const connection = async () => {
  try {
    
    const conn = await mongoose.connect(process.env.Mongo_URL, {
      maxPoolSize: 30,
      maxConnecting: 4,
      serverSelectionTimeoutMS: 10000,
      waitQueueTimeoutMS: 10000,
      // Atlas supports built-in zlib; financial projections contain many repeated
      // field names/default term objects and compress substantially on the wire.
      compressors: ['zlib'],
      zlibCompressionLevel: 3,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log({ msg: "cannot connect to db", error: error.message });
    process.exit(1);
  }
};
