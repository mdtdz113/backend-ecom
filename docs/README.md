# Tài liệu dự án E-commerce API

## Giới thiệu

Đây là tài liệu chi tiết cho dự án E-commerce API, một RESTful API được xây dựng bằng Node.js, Express và MongoDB. API này cung cấp các chức năng cơ bản cho một website thương mại điện tử, bao gồm quản lý người dùng, sản phẩm, giỏ hàng, đơn hàng và thanh toán.

## Nội dung

Tài liệu này bao gồm các phần sau:

1. [Tổng quan về dự án](./tong-quan.md)

   - Giới thiệu
   - Công nghệ sử dụng
   - Cấu trúc dự án
   - Luồng hoạt động
   - Các chức năng chính

2. [Hướng dẫn cài đặt](./huong-dan-cai-dat.md)

   - Yêu cầu hệ thống
   - Cài đặt
   - Cấu hình môi trường
   - Khởi động server
   - Sử dụng API
   - Triển khai
   - Xử lý lỗi thường gặp

3. [Cấu trúc dự án](./cau-truc-du-an.md)

   - Tổng quan về cấu trúc thư mục
   - Chi tiết các thành phần
   - Luồng xử lý request
   - Mô hình dữ liệu

4. [Tài liệu API](./api-reference.md)

   - Xác thực
   - Sản phẩm
   - Giỏ hàng
   - Người dùng
   - Đơn hàng
   - Thanh toán

5. [Hướng dẫn sử dụng chi tiết](./huong-dan-su-dung.md)
   - Quản lý người dùng
   - Quản lý sản phẩm
   - Quản lý giỏ hàng
   - Quản lý đơn hàng
   - Thanh toán
   - Bảo mật
   - Xử lý lỗi
   - Mở rộng

## Luồng hoạt động của dự án

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Đăng ký/   │     │  Xem danh   │     │  Thêm vào   │     │  Tạo đơn    │
│  Đăng nhập  │────▶│  sách sản   │────▶│  giỏ hàng   │────▶│  hàng       │
└─────────────┘     │  phẩm       │     └─────────────┘     └─────────────┘
                    └─────────────┘                                │
                                                                   │
                                                                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Cập nhật   │     │  Xử lý      │     │  Webhook    │     │  Thanh toán  │
│  trạng thái │◀────│  thanh toán │◀────│  SePay      │◀────│  đơn hàng   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```


