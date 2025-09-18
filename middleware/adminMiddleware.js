const adminMiddleware = (req, res, next) => {
  
    if (req.user && req.user.role === "admin") {
        next(); 
    } else {
        res.status(403).send({
            error: "Forbidden: You do not have admin access.",
        });
    }
};

export { adminMiddleware };
