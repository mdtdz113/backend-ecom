import mongoose from 'mongoose';
import BaseSchema from './Base.js';

const OrderSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  companyName: {
    type: String,
    default: '',
  },
  country: {
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  apartment: {
    type: String,
    default: '',
  },
  cities: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  zipCode: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  items: [
    {
      productId: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      size: {
        type: String,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
    },
  ],
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentInfo: {
    sepayTransactionId: {
      type: Number,
      default: null,
    },
    gateway: {
      type: String,
      default: null,
    },
    transactionDate: {
      type: String,
      default: null,
    },
    accountNumber: {
      type: String,
      default: null,
    },
    transferAmount: {
      type: Number,
      default: null,
    },
    referenceCode: {
      type: String,
      default: null,
    },
    content: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
});

OrderSchema.add(BaseSchema);

export default mongoose.model('Order', OrderSchema);
