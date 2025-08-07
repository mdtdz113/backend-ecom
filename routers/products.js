import express from "express";
import {
    createProduct,
    getProduct,
    getDetailProduct,
    getRelatedProduct,
    deleteProduct,
    updateProduct,
} from "../controller/product.js";

const router = express.Router();

router.post("/product", createProduct);
router.get("/product/:productId", getDetailProduct);
router.get("/product", getProduct);
router.get("/related-products/:productId", getRelatedProduct);
router.delete("/product/:productId", deleteProduct);
router.put("/product/:productId", updateProduct);

export default router;
