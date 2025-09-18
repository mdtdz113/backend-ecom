import express from "express";
import {
    createUserByAdmin,
    deleteUser,
    getAllUser,
    getInfoUser,
    lockUser,
    loginGoogle,
    updateUser,
} from "../controller/user.js";
import { authMiddleware } from "../middleware/middleware.js";
import { adminMiddleware } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/user/info/:userId", authMiddleware, getInfoUser);
router.delete("/user/:userId", authMiddleware, adminMiddleware, deleteUser);
router.get("/user/All", authMiddleware, adminMiddleware, getAllUser);
router.put("/user/:userId", authMiddleware, adminMiddleware, updateUser);
router.put("/user/:userId/lock", authMiddleware, adminMiddleware, lockUser);
router.post("/user/admin", authMiddleware, adminMiddleware, createUserByAdmin);
router.post("/user/google", loginGoogle);
export default router;
