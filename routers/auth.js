import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const router = express.Router();

const handleValidateReq = ({ username, password }, res) => {
    if (!username || !password) {
        return res.json({ message: "All fields are required" });
    }
};

router.post("/register", async (req, res) => {
    const { username, password } = req.body;

    const isValid = handleValidateReq({ username, password }, res);

    if (isValid) {
        return;
    }

    let user = await User.findOne({ username });

    if (user) {
        return res.status(400).json({ message: "User already exists" });
    }

    user = new User({ username, password });
    await user.save();

    res.status(201).json({ message: "User created successfully" });
});

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const isValid = handleValidateReq({ username, password }, res);

        if (isValid) {
            return;
        }

        const user = await User.findOne({ username });

        if (!user) {
            return res.status(400).json({ message: "User does not exist" });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id, username }, "dunglv", {
            expiresIn: "5m",
        });
        const refreshToken = jwt.sign({ id: user._id, username }, "dunglv", {
            expiresIn: "7d",
        });
        res.json({ token, refreshToken, id: user._id });
        console.log('da dang nhap')
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

const isValidRefreshToken = (refreshToken) => {
    try {
        const decoded = jwt.verify(refreshToken, "dunglv");
        return decoded;
    } catch (error) {
        return false;
    }
};

router.post("/refresh-token", (req, res) => {
    const { token: refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(403).json({ message: "No refresh token provided" });
    }

    const validRefreshToken = isValidRefreshToken(refreshToken);

    if (!validRefreshToken) {
        return res
            .status(403)
            .json({ message: "Invalid or expired refresh token" });
    }

    const newAccessToken = jwt.sign(
        { id: validRefreshToken.id, username: validRefreshToken.username },
        "dunglv",
        { expiresIn: "5m" }
    );

    res.json({ accessToken: newAccessToken });
});

export default router;
