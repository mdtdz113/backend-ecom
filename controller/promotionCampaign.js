// controller/promotionCampaign.js
import mongoose from "mongoose";
import PromotionCampaign from "../models/PromotionCampaign.js";
import Product from "../models/Product.js";
import { adjustProductStockBySize } from "../lib/stockHelpers.js";

const now = () => new Date();
const within = (start, end) =>
    now() >= new Date(start) && now() <= new Date(end);

export async function createCampaign(req, res) {
    const session = await mongoose.startSession();
    try {
        const {
            name,
            percent,
            startAt,
            endAt,
            items,
            channels = ["web"],
        } = req.body;

        if (
            !name ||
            percent == null ||
            !startAt ||
            !endAt ||
            !Array.isArray(items) ||
            !items.length
        ) {
            return res.status(400).json({ message: "Thiếu dữ liệu bắt buộc" });
        }
        if (!(percent >= 0 && percent <= 100)) {
            return res.status(400).json({ message: "percent phải 0..100" });
        }
        if (new Date(startAt) >= new Date(endAt)) {
            return res.status(400).json({ message: "startAt phải < endAt" });
        }

        await session.withTransaction(async () => {
            // Rút tồn từng sản phẩm/size
            for (const it of items) {
                const { productId, size = null, qty } = it;
                if (!productId || !qty || qty <= 0)
                    throw new Error("Thiếu productId/qty hợp lệ");

                const product =
                    await Product.findById(productId).session(session);
                if (!product)
                    throw new Error(`Không tìm thấy sản phẩm ${productId}`);

                if (size) {
                    // RÚT tồn theo size
                    const ok = adjustProductStockBySize(product, size, -qty);
                    if (!ok)
                        throw new Error(
                            `Không thể trừ tồn size ${size} của ${product.name}`
                        );
                    await product.save({ session });
                } else {
                    // Nếu bạn có stock tổng, trừ ở đây. Nếu không có, bắt buộc dùng size.
                    if (typeof product.stock === "number") {
                        if (product.stock < qty)
                            throw new Error(`Tồn không đủ: ${product.name}`);
                        product.stock -= qty;
                        await product.save({ session });
                    } else {
                        throw new Error(
                            `Sản phẩm ${product.name} cần chỉ định size để rút kho`
                        );
                    }
                }
            }

            // Tạo campaign – remainingQty = allocatedQty
            const now = new Date();
            const status =
                now >= new Date(startAt) && now <= new Date(endAt)
                    ? "active"
                    : "draft";
            const campaign = await PromotionCampaign.create(
                [
                    {
                        name,
                        percent,
                        startAt,
                        endAt,
                        status,
                        items: items.map(({ productId, size = null, qty }) => ({
                            productId,
                            size,
                            allocatedQty: qty,
                            remainingQty: qty,
                        })),
                        channels,
                    },
                ],
                { session }
            );

            res.status(201).json({
                message: "Đã tạo chiến dịch",
                data: campaign[0],
            });
        });
    } catch (e) {
        res.status(400).json({ message: e.message });
    } finally {
        session.endSession();
    }
}

// Trả lại kho cho campaign hết hạn
async function releaseCampaignStock(campaign, session) {
    for (const it of campaign.items || []) {
        const { productId, size, remainingQty } = it;
        if (!remainingQty || remainingQty <= 0) continue;
        const product = await Product.findById(productId).session(session);
        if (!product) continue;

        if (size) {
            const ok = adjustProductStockBySize(product, size, +remainingQty);
            if (ok) await product.save({ session });
        } else if (typeof product.stock === "number") {
            product.stock += Number(remainingQty);
            await product.save({ session });
        }
        it.remainingQty = 0; // đã trả
    }
    campaign.status = "expired";
    await campaign.save({ session });
}

export async function listCampaigns(req, res) {
    try {
        // auto update trạng thái các campaign đã hết hạn
        const candidates = await PromotionCampaign.find({
            status: { $in: ["draft", "active"] },
        });
        for (const c of candidates) {
            if (now() > new Date(c.endAt)) {
                const session = await mongoose.startSession();
                await session.withTransaction(async () => {
                    await releaseCampaignStock(c, session);
                });
                session.endSession();
            } else if (within(c.startAt, c.endAt) && c.status !== "active") {
                c.status = "active";
                await c.save();
            }
        }

        const list = await PromotionCampaign.find().sort({ createdAt: -1 });
        res.json({ data: list });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

export async function getCampaign(req, res) {
    try {
        const { id } = req.params;
        const c = await PromotionCampaign.findById(id);
        if (!c)
            return res
                .status(404)
                .json({ message: "Không tìm thấy chiến dịch" });
        // đồng bộ trạng thái nếu cần
        if (now() > new Date(c.endAt) && c.status !== "expired") {
            const session = await mongoose.startSession();
            await session.withTransaction(async () => {
                await releaseCampaignStock(c, session);
            });
            session.endSession();
        } else if (within(c.startAt, c.endAt) && c.status !== "active") {
            c.status = "active";
            await c.save();
        }
        res.json({ data: c });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

export async function pauseCampaign(req, res) {
    try {
        const { id } = req.params;
        const c = await PromotionCampaign.findByIdAndUpdate(
            id,
            { $set: { status: "paused" } },
            { new: true }
        );
        if (!c) return res.status(404).json({ message: "Không tìm thấy" });
        res.json({ message: "Đã tạm dừng", data: c });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

export async function resumeCampaign(req, res) {
    try {
        const { id } = req.params;
        const c = await PromotionCampaign.findById(id);
        if (!c) return res.status(404).json({ message: "Không tìm thấy" });
        c.status = within(c.startAt, c.endAt) ? "active" : "draft";
        await c.save();
        res.json({ message: "Đã kích hoạt lại", data: c });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
}

export async function manualRelease(req, res) {
    const session = await mongoose.startSession();
    try {
        const { id } = req.params;
        const c = await PromotionCampaign.findById(id);
        if (!c) return res.status(404).json({ message: "Không tìm thấy" });

        await session.withTransaction(async () => {
            await releaseCampaignStock(c, session);
        });

        res.json({
            message: "Đã trả tồn còn lại & kết thúc chiến dịch",
            data: c,
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    } finally {
        session.endSession();
    }
}
