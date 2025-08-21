import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
export const createOrder = async (req, res) => {
    try {
        const userId = req.user._id; // Lấy từ middleware authentication
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
        } = req.body;

        // Validate required fields
        if (
            !firstName ||
            !lastName ||
            !country ||
            !street ||
            !cities ||
            !state ||
            !phone ||
            !zipCode ||
            !email
        ) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng điền đầy đủ thông tin bắt buộc",
            });
        }

        // Lấy tất cả items trong cart của user
        const cartItems = await Cart.find({ userId, deletedAt: null });

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Giỏ hàng trống",
            });
        }

        // Tính tổng tiền và chuẩn bị items cho order
        let totalAmount = 0;
        const orderItems = [];

        for (const cartItem of cartItems) {
            // Lấy thông tin sản phẩm để tính giá
            const product = await Product.findOne({
                _id: cartItem.productId,
                deletedAt: null,
            });

            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: `Sản phẩm với ID ${cartItem.productId} không tồn tại`,
                });
            }

            const itemTotal = product.price * cartItem.quantity;
            totalAmount += itemTotal;

            orderItems.push({
                productId: cartItem.productId,
                quantity: cartItem.quantity,
                size: cartItem.size,
                price: product.price,
            });
        }

        // Tạo order mới
        const newOrder = new Order({
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
            status: "pending",
            items: orderItems,
            totalAmount,
        });

        const savedOrder = await newOrder.save();

        // Xóa items khỏi cart sau khi tạo order thành công
        await Cart.updateMany(
            { userId, deletedAt: null },
            { deletedAt: new Date() }
        );

        res.status(201).json({
            success: true,
            message: "Đơn hàng đã được tạo thành công",
            data: savedOrder,
        });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi tạo đơn hàng",
            error: error.message,
        });
    }
};

export const getOrdersByUser = async (req, res) => {
    try {
        const userId = req.user._id;

        const orders = await Order.find({ userId, deletedAt: null }).sort({
            createdAt: -1,
        });

        res.status(200).json({
            success: true,
            data: orders,
        });
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

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy đơn hàng",
            });
        }

        res.status(200).json({
            success: true,
            data: order,
        });
    } catch (error) {
        console.error("Error getting order:", error);
        res.status(500).json({
            success: false,
            message: "Lỗi server khi lấy thông tin đơn hàng",
            error: error.message,
        });
    }
};
// GET /orders/all?page=1&pageSize=20&status=processing&q=abc&from=2025-08-01&to=2025-08-18
export const getAllOrders = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status, // pending | processing | shipped | delivered | cancelled
            from, // yyyy-mm-dd
            to, // yyyy-mm-dd
            q, // search theo tên/email/phone
        } = req.query;

        const filter = { deletedAt: null };

        if (status) filter.status = status;

        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
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
                .populate("userId", "firstName lastName email") // lấy thêm info user
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
        return res.status(500).json({
            success: false,
            message: "Lỗi khi lấy danh sách đơn hàng",
        });
    }
};

export const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedOrder = await Order.findByIdAndDelete(id);

        if (!deletedOrder) {
            return res.status(404).json({ message: "Order not found" });
        }

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

//admin

export const updateOrderStatus = async (req, res) => {
    const { id } = req.params;
    const { status: nextStatus } = req.body;

    if (!nextStatus) {
        return res
            .status(400)
            .json({ success: false, message: "Thiếu status mới" });
    }

    // chỉ cho phép tiến lên hoặc vào trạng thái kết thúc
    const flow = ["pending", "processing", "shipped", "delivered"];
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

            // Helpers: nhận diện tên size & field tồn kho
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

            // ===== Trừ kho khi pending -> processing =====
            if (current === "pending" && nextStatus === "processing") {
                for (const it of order.items) {
                    const productId = it.productId;
                    const qtyNeeded = Number(it.quantity ?? it.qty);
                    const sizeNeeded = (it.size ?? it?.variant?.size ?? "")
                        .toString()
                        .trim();

                    if (!productId || !sizeNeeded || !qtyNeeded) {
                        throw new Error(
                            "Thiếu productId/size/quantity trong order.items"
                        );
                    }

                    const product =
                        await Product.findById(productId).session(session);
                    if (!product)
                        throw new Error(`Không tìm thấy sản phẩm ${productId}`);

                    if (!Array.isArray(product.size)) {
                        throw new Error(
                            "Cấu trúc Product.size không phải mảng"
                        );
                    }

                    // tìm biến thể size (so sánh không phân biệt hoa thường)
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
                            `Không tìm thấy biến thể size "${sizeNeeded}". Size có sẵn: ${available || "không có"}`
                        );
                    }

                    const slot = product.size[idx];
                    const qtyField = getQtyField(slot);
                    if (!qtyField) {
                        throw new Error(
                            "Không tìm thấy trường số lượng trong biến thể size (cần quantity/qty/stock/amount/value)"
                        );
                    }

                    const currentQty = Number(slot[qtyField] ?? 0);
                    if (currentQty < qtyNeeded) {
                        throw new Error(
                            `Hết hàng size ${sizeNeeded}: cần ${qtyNeeded}, còn ${currentQty}`
                        );
                    }

                    // trừ tồn và lưu
                    product.size[idx][qtyField] = currentQty - qtyNeeded;
                    product.markModified("size");
                    await product.save({ session });
                }
            }

            // ===== (Tuỳ chọn) Hoàn kho nếu hủy sau khi đã trừ =====
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

            // Lưu trạng thái mới
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
