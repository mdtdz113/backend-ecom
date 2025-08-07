import User from "../models/User.js";

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
export { getInfoUser, deleteUser, getAllUser };
