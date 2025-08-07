import User from "../models/User.js";
import jwt from "jsonwebtoken";

const authMiddleware = async (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        return res.status(401).send({ error: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, "dunglv");
        const user = await User.findById(decoded.id);

        if (!user) {
            throw new Error();
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).send({ error: "Token is not valid or expired" });
    }
};

export { authMiddleware };
