// models/PromotionCampaign.js
import mongoose from "mongoose";
import BaseSchema from "./Base.js";

const CampaignItemSchema = new mongoose.Schema({
    productId: { type: String, required: true },
    // tuỳ mô hình tồn kho: nếu theo size thì yêu cầu truyền size
    size: { type: String, default: null },
    allocatedQty: { type: Number, required: true }, // đã rút từ kho gốc
    remainingQty: { type: Number, required: true }, // còn lại để bán promo
});

const PromotionCampaignSchema = new mongoose.Schema({
    name: { type: String, required: true }, 
    percent: { type: Number, min: 0, max: 100, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
        type: String,
        enum: ["draft", "active", "paused", "expired"],
        default: "draft",
    },
    items: [CampaignItemSchema],
    channels: [{ type: String, default: "web" }],
});

PromotionCampaignSchema.add(BaseSchema);
PromotionCampaignSchema.index({ status: 1, startAt: 1, endAt: 1 });
PromotionCampaignSchema.index({ "items.productId": 1 });

export default mongoose.model("PromotionCampaign", PromotionCampaignSchema);
