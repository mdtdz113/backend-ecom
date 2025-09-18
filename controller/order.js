// controller/order.js — clean rewrite (flash-sale aware)
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import PromotionCampaign from "../models/PromotionCampaign.js";

/* ----------------------------- Helpers (campaign) ----------------------------- */
const now = () => new Date();

/**
 * Tìm 1 campaign đang active, match productId (+size nếu có).
 * (Cơ bản: lấy 1 cái phù hợp. Nâng cao có thể chọn theo priority/% cao nhất.)
 */
async function findActiveCampaign(
    productId,
    size,
    channels = ["web"],
    session = null
) {
    const filter = {
        status: "active",
        channels: { $in: channels },
        startAt: { $lte: now() },
        endAt: { $gte: now() },
        "items.productId": String(productId),
    };
    if (size) filter["items.size"] = String(size);
    return PromotionCampaign.findOne(filter).session(session);
}

/**
 * Giữ quota remainingQty atomically bằng $inc + arrayFilters.
 * Trả về { usedQty, campaign } trong transaction session hiện tại.
 */
async function reserveCampaignQty({ productId, size, requestedQty, session }) {
    const campaign = await findActiveCampaign(
        productId,
        size,
        ["web"],
        session
    );
    if (!campaign) return { usedQty: 0, campaign: null };

    const ci = campaign.items.find(
        (x) =>
            String(x.productId) === String(productId) &&
            String(x.size ?? "") === String(size ?? "")
    );
    if (!ci || ci.remainingQty <= 0) return { usedQty: 0, campaign: null };

    const toUse = Math.min(Number(requestedQty), Number(ci.remainingQty));

    // Thử trừ đúng "toUse"
    const updated = await PromotionCampaign.findOneAndUpdate(
        {
            _id: campaign._id,
            status: "active",
            startAt: { $lte: now() },
            endAt: { $gte: now() },
            "items.productId": String(productId),
            ...(size ? { "items.size": String(size) } : {}),
            "items.remainingQty": { $gte: toUse },
        },
        { $inc: { "items.$[it].remainingQty": -toUse } },
        {
            new: true,
            session,
            arrayFilters: [
                {
                    "it.productId": String(productId),
                    ...(size ? { "it.size": String(size) } : {}),
                },
            ],
        }
    );

    if (!updated) {
        // Race: giữ phần còn lại nếu có
        const latest = await findActiveCampaign(
            productId,
            size,
            ["web"],
            session
        );
        if (!latest) return { usedQty: 0, campaign: null };
        const li = latest.items.find(
            (x) =>
                String(x.productId) === String(productId) &&
                String(x.size ?? "") === String(size ?? "")
        );
        const rest = Math.max(0, Number(li?.remainingQty || 0));
        if (rest === 0) return { usedQty: 0, campaign: null };

        const updated2 = await PromotionCampaign.findOneAndUpdate(
            {
                _id: latest._id,
                status: "active",
                startAt: { $lte: now() },
                endAt: { $gte: now() },
                "items.productId": String(productId),
                ...(size ? { "items.size": String(size) } : {}),
                "items.remainingQty": { $gte: rest },
            },
            { $inc: { "items.$[it].remainingQty": -rest } },
            {
                new: true,
                session,
                arrayFilters: [
                    {
                        "it.productId": String(productId),
                        ...(size ? { "it.size": String(size) } : {}),
                    },
                ],
            }
        );

        if (!updated2) return { usedQty: 0, campaign: null };
        return { usedQty: rest, campaign: updated2 };
    }

    return { usedQty: toUse, campaign: updated };
}

/* --------------------------------- Controllers --------------------------------- */

/**
 * POST /orders
 * - Tạo đơn trong transaction
 * - Áp dụng flash-sale (PromotionCampaign) nếu còn quota
 * - Tách dòng nếu 1 phần vượt quota
 * - Xoá cart sau khi tạo đơn thành công
 */
export const createOrder = async (req, res) => {
    const session = await mongoose.startSession();
    try {
        const userId = req.user?._id;
        if (!userId)
            return res
                .status(401)
                .json({ success: false, message: "Unauthorized" });

        const {
            firstName,
            lastName,
            companyName,
            country,
            street,
            apartment,
            cities,
            state,
            phone,
            zipCode,
            email,
            note,
            shippingFee = 0,
            paymentMethod = "cod",
        } = req.body;

        // Validate field bắt buộc (giữ tương tự bản cũ)
        const required = [
            firstName,
            lastName,
            country,
            street,
            cities,
            state,
            phone,
            zipCode,
            email,
        ];
        if (required.some((v) => !v)) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Vui lòng điền đầy đủ thông tin bắt buộc",
                });
        }

        // Lấy cart
        const cartItems = await Cart.find({ userId, deletedAt: null }).lean();
        if (!cartItems?.length) {
            return res
                .status(400)
                .json({ success: false, message: "Giỏ hàng trống" });
        }

        // Preload product map (giảm round-trips trong tx)
        const productIds = cartItems.map((it) => it.productId);
        const products = await Product.find({
            _id: { $in: productIds },
            deletedAt: null,
        }).lean();
        const pMap = new Map(products.map((p) => [String(p._id), p]));

        let orderDocArray = null;

        await session.withTransaction(async () => {
            let subtotal = 0;
            const orderItems = [];

            for (const it of cartItems) {
                const p = pMap.get(String(it.productId));
                if (!p)
                    throw new Error(
                        `Sản phẩm với ID ${it.productId} không tồn tại`
                    );

                const basePrice = Number(p.price) || 0;
                const qty = Number(it.quantity || 0);
                const sizeLabel = it.size ?? null;

                // Giữ quota campaign (atomic)
                const { usedQty, campaign } = await reserveCampaignQty({
                    productId: it.productId,
                    size: sizeLabel,
                    requestedQty: qty,
                    session,
                });

                if (usedQty <= 0) {
                    // Không có ưu đãi → giá thường
                    subtotal += basePrice * qty;
                    orderItems.push({
                        productId: it.productId,
                        quantity: qty,
                        size: sizeLabel,
                        price: basePrice,
                        promotion: null,
                    });
                } else if (usedQty >= qty) {
                    // Toàn bộ qty được giảm giá
                    const promoUnit = Math.round(
                        (basePrice * (100 - Number(campaign.percent))) / 100
                    );
                    subtotal += promoUnit * qty;
                    orderItems.push({
                        productId: it.productId,
                        quantity: qty,
                        size: sizeLabel,
                        price: promoUnit,
                        priceOriginal: basePrice,
                        promotion: {
                            campaignId: campaign._id,
                            name: campaign.name,
                            percent: campaign.percent,
                            usedQty: qty,
                        },
                    });
                } else {
                    // Một phần có khuyến mãi, phần còn lại giá thường → tách 2 dòng
                    const promoUnit = Math.round(
                        (basePrice * (100 - Number(campaign.percent))) / 100
                    );
                    const normalQty = qty - usedQty;

                    subtotal += promoUnit * usedQty + basePrice * normalQty;

                    // Dòng A: phần giảm
                    orderItems.push({
                        productId: it.productId,
                        quantity: usedQty,
                        size: sizeLabel,
                        price: promoUnit,
                        priceOriginal: basePrice,
                        promotion: {
                            campaignId: campaign._id,
                            name: campaign.name,
                            percent: campaign.percent,
                            usedQty,
                        },
                    });
                    // Dòng B: phần thường
                    orderItems.push({
                        productId: it.productId,
                        quantity: normalQty,
                        size: sizeLabel,
                        price: basePrice,
                        promotion: null,
                    });
                }
            }

            const totalAmount = subtotal + Number(shippingFee || 0);

            // Tạo Order (snapshot giá)
            orderDocArray = await Order.create(
                [
                    {
                        userId,
                        firstName,
                        lastName,
                        companyName: companyName || "",
                        country,
                        street,
                        apartment: apartment || "",
                        cities,
                        state,
                        phone,
                        zipCode,
                        email,
                        note: note || "",
                        items: orderItems,
                        subtotal,
                        shippingFee: Number(shippingFee || 0),
                        totalAmount,
                        status: "pending",
                        payment: {
                            method: paymentMethod,
                            status: "unpaid",
                            content: null,
                            paidAt: null,
                        },
                    },
                ],
                { session }
            );

            // Clear cart (soft)
            await Cart.updateMany(
                { userId, deletedAt: null },
                { deletedAt: new Date() },
                { session }
            );
        });

        return res.status(201).json({
            success: true,
            message: "Đơn hàng đã được tạo thành công",
            data: orderDocArray?.[0] || null,
        });
    } catch (error) {
        console.error("createOrder tx error:", error);
        return res
            .status(500)
            .json({
                success: false,
                message: error.message || "Lỗi server khi tạo đơn hàng",
            });
    } finally {
        session.endSession();
    }
};

/* ------------------------------ Query (không đổi) ------------------------------ */
export const getOrdersByUser = async (req, res) => {
    try {
        const userId = req.user._id;
        const orders = await Order.find({ userId, deletedAt: null }).sort({
            createdAt: -1,
        });
        res.status(200).json({ success: true, data: orders });
    } catch (error) {
        console.error("Error getting orders:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy danh sách đơn hàng",
            error: error.message,
        });
    }
};

export const getOrderById = async (req, res) => {
    try {
        const userId = req.user._id;
        const { orderId } = req.params;
        const order = await Order.findOne({
            _id: orderId,
            userId,
            deletedAt: null,
        });
        if (!order)
            return res
                .status(404)
                .json({ success: false, message: "Không tìm thấy đơn hàng" });
        res.status(200).json({ success: true, data: order });
    } catch (error) {
        console.error("Error getting order:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy thông tin đơn hàng",
            error: error.message,
        });
    }
};

/**
 * GET /orders/all?page=1&limit=20&status=processing&q=abc&from=2025-08-01&to=2025-08-18
 */
export const getAllOrders = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, from, to, q } = req.query;
        const filter = { deletedAt: null };

        if (status) filter.status = status;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from + "T00:00:00.000Z");
            if (to) filter.createdAt.$lte = new Date(to + "T23:59:59.999Z");
        }
        if (q) {
            filter.$or = [
                { email: { $regex: q, $options: "i" } },
                { phone: { $regex: q, $options: "i" } },
                { firstName: { $regex: q, $options: "i" } },
                { lastName: { $regex: q, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [orders, total] = await Promise.all([
            Order.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .select("-__v")
                .lean(),
            Order.countDocuments(filter),
        ]);

        return res.status(200).json({
            success: true,
            data: orders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        console.error("adminGetAllOrders error:", error);
        return res
            .status(500)
            .json({
                success: false,
                message: "Lỗi khi lấy danh sách đơn hàng",
            });
    }
};

export const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedOrder = await Order.findByIdAndDelete(id);
        if (!deletedOrder)
            return res.status(404).json({ message: "Order not found" });
        res.status(200).json({
            message: "Order deleted successfully",
            order: deletedOrder,
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete order",
            error: error.message,
        });
    }
};

/* --------------------------- Update status + stock --------------------------- */
export const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status: nextStatus } = req.body;
    if (!nextStatus)
        return res
            .status(400)
            .json({ success: false, message: "Thiếu status mới" });

    const flow = ["pending", "completed", "processing", "shipped", "delivered"];
    const terminals = ["cancelled"];

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const order = await Order.findById(id).session(session);
            if (!order) throw new Error("Order không tồn tại");

            const current = order.status;
            const forwardOK =
                flow.includes(nextStatus) &&
                flow.includes(current) &&
                flow.indexOf(nextStatus) >= flow.indexOf(current);
            const terminalOK = terminals.includes(nextStatus);
            if (!forwardOK && !terminalOK) {
                throw new Error(
                    `Chuyển trạng thái không hợp lệ từ "${current}" sang "${nextStatus}"`
                );
            }

            // Helpers: nhận diện size & trường số lượng trong biến thể
            const getSizeName = (obj) =>
                obj?.size ??
                obj?.name ??
                obj?.label ??
                obj?.value ??
                obj?.title;
            const getQtyField = (obj) => {
                for (const k of [
                    "quantity",
                    "qty",
                    "stock",
                    "amount",
                    "value",
                ]) {
                    if (typeof obj?.[k] === "number") return k;
                }
                return null;
            };

            // Trừ kho khi từ pending -> processing (lần đầu)
            if (current === "pending" && nextStatus === "processing") {
                for (const it of order.items) {
                    const product = await Product.findById(
                        it.productId
                    ).session(session);
                    if (!product)
                        throw new Error(
                            `Không tìm thấy sản phẩm ${it.productId}`
                        );
                    if (!Array.isArray(product.size))
                        throw new Error(
                            "Cấu trúc Product.size không phải mảng"
                        );

                    const sizeNeeded = (it.size ?? it?.variant?.size ?? "")
                        .toString()
                        .trim();
                    const idx = product.size.findIndex((sv) => {
                        const name = getSizeName(sv);
                        return (
                            name &&
                            name.toString().toLowerCase() ===
                                sizeNeeded.toLowerCase()
                        );
                    });
                    if (idx === -1) {
                        const available = product.size
                            .map((sv) => getSizeName(sv))
                            .filter(Boolean)
                            .join(", ");
                        throw new Error(
                            `Không tìm thấy size "${sizeNeeded}". Size có sẵn: ${available || "không có"}`
                        );
                    }

                    const slot = product.size[idx];
                    const qtyField = getQtyField(slot);
                    if (!qtyField)
                        throw new Error(
                            "Không thấy trường số lượng (quantity/qty/stock/amount/value) trong biến thể size"
                        );

                    const currentQty = Number(slot[qtyField] ?? 0);
                    const qtyNeeded = Number(it.quantity ?? it.qty);
                    if (currentQty < qtyNeeded)
                        throw new Error(
                            `Hết hàng size ${sizeNeeded}: cần ${qtyNeeded}, còn ${currentQty}`
                        );

                    product.size[idx][qtyField] = currentQty - qtyNeeded;
                    product.markModified("size");
                    await product.save({ session });
                }
            }

            // Hoàn kho nếu huỷ sau khi đã trừ (processing/shipped -> cancelled)
            if (
                nextStatus === "cancelled" &&
                ["processing", "shipped"].includes(current)
            ) {
                for (const it of order.items) {
                    const product = await Product.findById(
                        it.productId
                    ).session(session);
                    if (!product || !Array.isArray(product.size)) continue;

                    const sizeNeeded = (it.size ?? it?.variant?.size ?? "")
                        .toString()
                        .trim();
                    const idx = product.size.findIndex((sv) => {
                        const name = getSizeName(sv);
                        return (
                            name &&
                            name.toString().toLowerCase() ===
                                sizeNeeded.toLowerCase()
                        );
                    });
                    if (idx === -1) continue;

                    const qtyField = getQtyField(product.size[idx]);
                    if (!qtyField) continue;

                    product.size[idx][qtyField] =
                        Number(product.size[idx][qtyField] ?? 0) +
                        Number(it.quantity ?? it.qty ?? 0);
                    product.markModified("size");
                    await product.save({ session });
                }
            }

            order.status = nextStatus;
            await order.save({ session });
        });

        return res.json({
            success: true,
            message: "Cập nhật trạng thái thành công",
        });
    } catch (err) {
        console.error("updateOrderStatus error:", err);
        return res
            .status(400)
            .json({ success: false, message: err.message || "Update failed" });
    } finally {
        session.endSession();
    }
};

export const softDeleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        );
        if (!order)
            return res
                .status(404)
                .json({ success: false, message: "Không tìm thấy đơn" });
        res.json({
            success: true,
            message: "Đã xóa đơn (soft-delete)",
            data: order,
        });
    } catch (e) {
        res.status(500).json({ success: false, message: "Lỗi xoá đơn" });
    }
};
