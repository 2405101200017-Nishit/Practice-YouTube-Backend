import mongoose from "mongoose";
import { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // One who is subscribing
        ref: "User"
    },
    channel: {
        type: Schema.Types.ObjectId, // One to whom the subscriber is subscribing to
        ref: "User"
    }
},{timestamps: true})

export const Subscription = mongoose.model("Sunscription", subscriptionSchema)