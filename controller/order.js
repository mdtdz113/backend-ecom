import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id; // Lấy từ middleware authentication
    const {
      firstName,
      lastName,
      companyName,
      country,
      street,
      apartment,
      cities,
      state,
      phone,
      zipCode,
      email,
    } = req.body;

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !country ||
      !street ||
      !cities ||
      !state ||
      !phone ||
      !zipCode ||
      !email
    ) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc',
      });
    }

    // Lấy tất cả items trong cart của user
    const cartItems = await Cart.find({ userId, deletedAt: null });

    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Giỏ hàng trống',
      });
    }

    // Tính tổng tiền và chuẩn bị items cho order
    let totalAmount = 0;
    const orderItems = [];

    for (const cartItem of cartItems) {
      // Lấy thông tin sản phẩm để tính giá
      const product = await Product.findOne({
        _id: cartItem.productId,
        deletedAt: null,
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Sản phẩm với ID ${cartItem.productId} không tồn tại`,
        });
      }

      const itemTotal = product.price * cartItem.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: cartItem.productId,
        quantity: cartItem.quantity,
        size: cartItem.size,
        price: product.price,
      });
    }

    // Tạo order mới
    const newOrder = new Order({
      userId,
      firstName,
      lastName,
      companyName: companyName || '',
      country,
      street,
      apartment: apartment || '',
      cities,
      state,
      phone,
      zipCode,
      email,
      status: 'pending',
      items: orderItems,
      totalAmount,
    });

    const savedOrder = await newOrder.save();

    // Xóa items khỏi cart sau khi tạo order thành công
    await Cart.updateMany(
      { userId, deletedAt: null },
      { deletedAt: new Date() }
    );

    res.status(201).json({
      success: true,
      message: 'Đơn hàng đã được tạo thành công',
      data: savedOrder,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo đơn hàng',
      error: error.message,
    });
  }
};

export const getOrdersByUser = async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Order.find({ userId, deletedAt: null }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy danh sách đơn hàng',
      error: error.message,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;

    const order = await Order.findOne({
      _id: orderId,
      userId,
      deletedAt: null,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng',
      });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thông tin đơn hàng',
      error: error.message,
    });
  }
};
