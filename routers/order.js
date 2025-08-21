import express from "express";
import {
    createOrder,
    getOrdersByUser,
    getOrderById,
    getAllOrders,
    deleteOrder,
    updateOrderStatus,
} from "../controller/order.js";
import { authMiddleware } from "../middleware/middleware.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";
const router = express.Router();

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Tạo đơn hàng mới
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - country
 *               - street
 *               - cities
 *               - state
 *               - phone
 *               - zipCode
 *               - email
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "dung"
 *               lastName:
 *                 type: string
 *                 example: "le"
 *               companyName:
 *                 type: string
 *                 example: "cong ty a"
 *               country:
 *                 type: string
 *                 example: "Vietnam"
 *               street:
 *                 type: string
 *                 example: "hoang ngan"
 *               apartment:
 *                 type: string
 *                 example: "1"
 *               cities:
 *                 type: string
 *                 example: "thanh_pho_ha_noi"
 *               state:
 *                 type: string
 *                 example: "huyen_ung_hoa"
 *               phone:
 *                 type: string
 *                 example: "0366468863"
 *               zipCode:
 *                 type: string
 *                 example: "10000"
 *               email:
 *                 type: string
 *                 example: "dunglv@gmail.com"
 *     responses:
 *       201:
 *         description: Đơn hàng được tạo thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.post("/orders", authMiddleware, createOrder);

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Lấy danh sách đơn hàng của user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách đơn hàng
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get("/orders", authMiddleware, getOrdersByUser);

/**
 * @swagger
 * /api/v1/orders/{orderId}:
 *   get:
 *     summary: Lấy thông tin chi tiết đơn hàng
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của đơn hàng
 *     responses:
 *       200:
 *         description: Thông tin đơn hàng
 *       404:
 *         description: Không tìm thấy đơn hàng
 *       401:
 *         description: Không có quyền truy cập
 *       500:
 *         description: Lỗi server
 */
router.get("/orders/:orderId", authMiddleware, getOrderById);

router.delete("/order/:id", authMiddleware, deleteOrder);

//admin
router.get("/ordersAll", authMiddleware, adminMiddleware, getAllOrders);
router.post(
    "/orders/:id/status",
    authMiddleware,
    adminMiddleware,
    updateOrderStatus
);


export default router;
