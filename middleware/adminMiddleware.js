const adminMiddleware = (req, res, next) => {
    // req.user đã được gán bởi authMiddleware
    // Bây giờ ta kiểm tra quyền hạn của người dùng này
    if (req.user && req.user.role === "admin") {
        next(); // Nếu là admin, cho phép tiếp tục
    } else {
        res.status(403).send({
            error: "Forbidden: You do not have admin access.",
        });
    }
};

export { adminMiddleware };
