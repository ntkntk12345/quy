# 📱 QD Mobile - Website Bán Điện Thoại Tích Hợp Chatbot AI Hỗ Trợ Quyết Định

Dự án website thương mại điện tử bán điện thoại di động tích hợp Trợ lý ảo AI (NVIDIA API) hỗ trợ ra quyết định mua sắm (Decision Support System - DSS).

---

## 🛠️ Yêu Cầu Hệ Thống

Để chạy dự án này trên máy tính của bạn, cần cài đặt sẵn:
- **Node.js** (Phiên bản v18.0.0 trở lên)
- Trình duyệt web hiện đại (Chrome, Edge, Firefox, Safari)

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local)

### Bước 1: Cấu hình biến môi trường
1. Nhân bản tệp `.env.example` thành tệp `.env`.
2. Mở tệp `.env` bằng trình soạn thảo văn bản và cấu hình các thông số:
   - `NVIDIA_API_KEY`: Khóa API NVIDIA của bạn (Lấy miễn phí tại [NVIDIA Build](https://build.nvidia.com/)).
   - `NVIDIA_MODEL`: Model AI sử dụng (mặc định là `moonshotai/kimi-k2.6` hoặc `meta/llama-3.1-405b-instruct`).

### Bước 2: Cài đặt các thư viện phụ thuộc
Mở terminal tại thư mục dự án và chạy lệnh sau:
```bash
npm install
```

### Bước 3: Chạy khởi động Server
Khởi hành backend server và giao diện frontend:
```bash
npm start
```
*Lưu ý: Bạn cũng có thể dùng lệnh `npm run dev` để chạy chế độ tự động tải lại (hot reload) khi thay đổi code.*

### Bước 4: Truy cập ứng dụng
Mở trình duyệt và truy cập vào đường dẫn:
```text
http://localhost:5000
```
*Mẹo: Nếu bạn mở trực tiếp tệp `public/index.html` bằng cách nhấp đúp (protocol `file://`), ứng dụng vẫn hoạt động tốt nhờ cơ chế tự động định tuyến kết nối chéo đến server backend chạy trên cổng 5000.*

---

## 👥 Tài Khoản Thử Nghiệm (Demo Accounts)

Hệ thống đã tự động tạo sẵn 2 tài khoản mẫu trong cơ sở dữ liệu để bạn kiểm thử các chức năng:

1. **Tài khoản Khách hàng (Customer):**
   - **Tên đăng nhập:** `customer`
   - **Mật khẩu:** `123456`
   *(Dùng để thử nghiệm giỏ hàng, điền thông tin và thanh toán đơn hàng).*

2. **Tài khoản Quản trị viên (Admin):**
   - **Tên đăng nhập:** `admin`
   - **Mật khẩu:** `admin123`
   *(Dùng để quản lý sản phẩm: Thêm mới, chỉnh sửa thông tin, thang điểm DSS, mô tả, ảnh và duyệt danh sách đơn hàng).*

---

## 📂 Danh Mục Thư Mục Dự Án

```text
├── public/                 # Thư mục chứa giao diện Frontend tĩnh
│   ├── css/
│   │   └── style.css       # File style chính (Thiết kế sang trọng, Responsive)
│   ├── js/
│   │   └── app.js          # Logic điều khiển Frontend SPA & Chatbot AI
│   └── index.html          # Khung giao diện chính Single Page App
├── data/
│   └── database.sqlite     # Cơ sở dữ liệu SQLite tự động tạo khi chạy server
├── db.js                   # Kết nối SQLite & Chèn dữ liệu sản phẩm mẫu
├── server.js               # Mã nguồn Backend Express chính & NVIDIA API Call
├── package.json            # Cài đặt thư viện Node.js
├── BaoCaoMonHoc.md         # Báo cáo học tập bài tập lớn
└── README.md               # Tài liệu hướng dẫn sử dụng này
```
