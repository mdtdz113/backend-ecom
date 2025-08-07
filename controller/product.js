import Product from "../models/Product.js";
import mongoose from "mongoose";
const createProduct = async (req, res) => {
    const { name, price, description, type, size, material, images } = req.body;

    try {
        await Product.create({
            name,
            price,
            description,
            type,
            size,
            material,
            images,
        });

        return res.status(201).send("Add Product Successfully");
    } catch (error) {
        res.status(500).send(error);
    }
};

const getProduct = async (req, res) => {
    const { page = 1, limit, sortType = "0" } = req.query;

    const total = await Product.countDocuments();

    const pageNumber = parseInt(page, 10);
    const limitNumber = limit ? parseInt(limit, 10) : null;

    // Kiểm tra page phải là số nguyên dương
    if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
        return res.status(400).json({
            message: "Giá trị page không hợp lệ, phải là số nguyên dương",
        });
    }

    // Kiểm tra limit phải là số nguyên dương nếu nó tồn tại
    if (limit && (!Number.isInteger(limitNumber) || limitNumber <= 0)) {
        return res.status(400).json({
            message: "Giá trị limit không hợp lệ, phải là số nguyên dương",
        });
    }

    let sortCondition;

    switch (sortType) {
        case "0":
            sortCondition = { createdAt: 1 };
            break;
        case "3":
            sortCondition = { createdAt: -1 };
            break;
        case "4":
            sortCondition = { price: 1 };
            break;
        case "5":
            sortCondition = { price: -1 };
            break;
        default:
            sortCondition = { createdAt: 1 };
            break;
    }

    const pipeline = [
        { $sort: sortCondition },
        { $skip: (pageNumber - 1) * (limitNumber || 0) },
    ];

    if (limitNumber) {
        pipeline.push({ $limit: limitNumber });
    }

    const products = await Product.aggregate(pipeline);

    const datas = {
        contents: products,
        total,
        page,
        limit,
    };

    return res.send(datas);
};

const getDetailProduct = async (req, res) => {
    const product = await Product.findById(req.params.productId);

    if (!product) {
        return res.status(404).send("Product not found");
    }

    return res.send(product);
};

const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndDelete(req.params.productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error deleting product",
            error: error.message,
        });
    }
};

const getRelatedProduct = async (req, res) => {
    try {
        const { productId } = req.params;

        // Tìm sản phẩm hiện tại
        const currentProduct = await Product.findById(productId);
        if (!currentProduct) {
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        }

        // Tìm các sản phẩm cùng danh mục, loại bỏ chính nó
        const relatedProducts = await Product.find({
            type: currentProduct.type,
            _id: { $ne: productId }, // Loại trừ sản phẩm hiện tại
        }).limit(5); // Giới hạn 5 sản phẩm liên quan

        res.json({ relatedProducts });
    } catch (error) {
        console.error("Lỗi lấy sản phẩm liên quan:", error);
        res.status(500).json({ message: "Lỗi server" });
    }
};

const updateProduct = async (req, res) => {
    const { productId } = req.params;

    // Lọc các trường có giá trị từ req.body
    const updateData = {};
    for (const key in req.body) {
        // Kiểm tra xem trường đó có tồn tại và không phải là null/undefined không
        if (req.body[key] !== undefined) {
            updateData[key] = req.body[key];
        }
    }

    // Nếu không có dữ liệu để cập nhật
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
            success: false,
            message: "Không có dữ liệu để cập nhật.",
        });
    }

    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            { $set: updateData }, // Sử dụng $set để chỉ cập nhật các trường đã được cung cấp
            { new: true, runValidators: true } // Trả về tài liệu đã cập nhật và chạy validators
        );

        if (!updatedProduct) {
            return res.status(404).json({
                success: false,
                message: "Không tìm thấy sản phẩm để cập nhật.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cập nhật sản phẩm thành công",
            data: updatedProduct,
        });
    } catch (error) {
        // Xử lý lỗi validation của Mongoose
        if (error.name === "ValidationError") {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu cập nhật không hợp lệ.",
                error: error.message,
            });
        }

        // Xử lý các lỗi khác
        return res.status(500).json({
            success: false,
            message: "Lỗi trong quá trình cập nhật sản phẩm.",
            error: error.message,
        });
    }
};

export {
    createProduct,
    getProduct,
    getDetailProduct,
    getRelatedProduct,
    deleteProduct,
    updateProduct,
};
