import mongoose from "mongoose";

export const getUserJoinDate = (userId) => {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return new Date(0);
  }
  return new mongoose.Types.ObjectId(userId).getTimestamp();
};
