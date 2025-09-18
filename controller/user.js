import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const getInfoUser = async (req, res) => {
    const user = await User.findById(req.params.userId);

    if (!user) {
        return res.status(404).send("User not found");
    }

    const amountCart = await User.aggregate([
        { $match: { _id: user._id } },
        {
            $lookup: {
                from: "carts",
                localField: "_id",
                foreignField: "userId",
                as: "carts",
            },
        },
        { $unwind: "$carts" },
        {
            $group: {
                _id: "$_id",
                amountCart: { $sum: "$carts.quantity" },
            },
        },
    ]);

    console.log(amountCart);

    if (amountCart.length > 0) {
        user.amountCart = amountCart[0].amountCart;
    }

    const data = {
        username: user.username,
        id: user._id,
        deletedAt: user.deletedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        amountCart: user.amountCart,
    };

    return res.send({
        msg: "Get info user successfully",
        data,
    });
};

const deleteUser = async (req, res) => {
    try {
        const userModel = await User.findByIdAndDelete(req.params.userId);

        if (!userModel) {
            res.status(401).send({
                success: false,
                message: "No userId",
            });
        }

        res.status(200).send({
            success: true,
            message: "User Deleted Successfully",
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error in Delete User API",
            error,
        });
    }
};

const getAllUser = async (req, res) => {
    try {
        const users = await User.find();

        if (!users || users.length === 0) {
            return res.status(404).send({
                success: false,
                message: "No users found",
            });
        }

        res.status(200).send({
            success: true,
            message: "Users fetched successfully",
            data: users, // Thêm dòng này để gửi danh sách người dùng
        });
    } catch (error) {
        console.log(error);
        res.status(500).send({
            success: false,
            message: "Error in Get All Users API",
            error,
        });
    }
};
const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, password, role } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Không cho tự hạ quyền chính mình (tuỳ chọn, an toàn hơn)
        if (
            String(req.user._id) === String(userId) &&
            role &&
            role !== user.role
        ) {
            return res
                .status(400)
                .json({ message: "Không thể đổi vai trò của chính mình" });
        }

        if (typeof username === "string" && username.trim())
            user.username = username.trim();
        if (typeof role === "string")
            user.role = role === "admin" ? "admin" : "user";
        if (typeof password === "string" && password.trim())
            user.password = password.trim(); // sẽ được hash ở pre('save')

        await user.save();
        res.json({ message: "Updated successfully" });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};

const lockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isLocked } = req.body; // true = khóa, false = mở khóa

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        user.isLocked = isLocked;
        await user.save();

        return res.status(200).json({
            success: true,
            message: `User ${isLocked ? "locked" : "unlocked"} successfully`,
            data: user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Error in Lock User API",
            error: error.message,
        });
    }
};
const createUserByAdmin = async (req, res) => {
    try {
        const { username, password, role = "user" } = req.body;

        if (!username || !password) {
            return res
                .status(400)
                .json({ message: "username và password là bắt buộc" });
        }

        const existed = await User.findOne({ username });
        if (existed) {
            return res.status(409).json({ message: "Username đã tồn tại" });
        }

        const user = new User({
            username: username.trim(),
            password: password.trim(),
            role: role === "admin" ? "admin" : "user",
        });
        await user.save();

        return res.status(201).json({
            success: true,
            message: "Tạo user thành công",
            data: {
                _id: user._id,
                username: user.username,
                role: user.role,
                isLocked: user.isLocked,
            },
        });
    } catch (e) {
        return res.status(500).json({ message: e.message });
    }
};

const loginGoogle = async (req, res) => {
    try {
        const { tokenGoogle } = req.body;
        if (!tokenGoogle) {
            return res.status(400).json({ message: "Thiếu tokenGoogle" });
        }

        // 1) Verify ID token với Google (an toàn hơn jwt-decode)
        const ticket = await googleClient.verifyIdToken({
            idToken: tokenGoogle,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload(); // email, name, picture, sub...
        const { email, name, picture, sub } = payload || {};

        if (!email) {
            return res
                .status(400)
                .json({ message: "Token Google không có email" });
        }

        // 2) Tìm hoặc tạo user tương ứng (dùng email làm username)
        let user = await User.findOne({ username: email });
        if (!user) {
            user = new User({
                username: email,
                // không dùng password local cho Google, có thể lưu tạm sub/random
                password: sub || Math.random().toString(36).slice(2),
                role: "user",
                avatar: picture || null,
                displayName: name || email,
            });
            await user.save();
        }

        // 3) Chặn user bị khóa (giống flow login tay)
        if (user.isLocked) {
            return res.status(403).json({ message: "Tài khoản đã bị khóa" });
        }

        // 4) Ký JWT giống hệt login tay (để FE dùng chung)
        const token = jwt.sign(
            { id: user._id, username: user.username },
            "dunglv", // giữ nguyên như /login thủ công :contentReference[oaicite:3]{index=3}
            { expiresIn: "5m" }
        );
        const refreshToken = jwt.sign(
            { id: user._id, username: user.username },
            "dunglv",
            { expiresIn: "7d" }
        );

        // 5) (tuỳ chọn) Nếu bạn vẫn muốn set cookie như ảnh, mở comment dưới:
        // const isProd = process.env.NODE_ENV === "production";
        // const secureFlag = isProd ? " Secure;" : "";
        // res.setHeader("Set-Cookie", [
        //   `accessToken=${token}; HttpOnly;${secureFlag} Max-Age=86400; Path=/; SameSite=Strict`,
        //   `refreshToken=${refreshToken}; HttpOnly;${secureFlag} Max-Age=604800; Path=/; SameSite=Strict`,
        //   `logged=true; Max-Age=86400; Path=/; SameSite=Lax`,
        // ]);

        // 6) QUAN TRỌNG: trả về JSON y hệt login tay
        return res.json({
            token,
            refreshToken,
            id: user._id,
            role: user.role,
            username: user.username, // thêm để FE đọc trực tiếp nếu cần
        });
    } catch (err) {
        console.error(err);
        return res
            .status(500)
            .json({ message: "Lỗi đăng nhập Google", error: err.message });
    }
};

export {
    getInfoUser,
    deleteUser,
    getAllUser,
    updateUser,
    lockUser,
    createUserByAdmin,
    loginGoogle,
};
