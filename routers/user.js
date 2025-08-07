import express from "express";
import { deleteUser, getAllUser, getInfoUser } from "../controller/user.js";
import { authMiddleware } from "../middleware/middleware.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/user/info/:userId", authMiddleware, getInfoUser);
router.delete("/user/:userId", authMiddleware, adminMiddleware, deleteUser);
router.get("/user/All", authMiddleware, adminMiddleware, getAllUser);

export default router;
