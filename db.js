const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Tạo thư mục data nếu chưa tồn tại
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. Tạo bảng Users
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullname TEXT,
      role TEXT DEFAULT 'customer',
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Tạo bảng Products
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      brand TEXT NOT NULL,
      price REAL NOT NULL,
      screen TEXT,
      cpu TEXT,
      ram TEXT,
      rom TEXT,
      battery TEXT,
      camera TEXT,
      image_url TEXT,
      description TEXT,
      promotion TEXT,
      rating_performance REAL,
      rating_camera REAL,
      rating_battery REAL,
      rating_price REAL
    )
  `);

  // 3. Tạo bảng Orders
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      fullname TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  // 4. Tạo bảng Order Items
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      price REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  // 5. Tạo bảng Leads
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      phone TEXT,
      source TEXT DEFAULT 'chat',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Chèn tài khoản mẫu nếu chưa tồn tại
  db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
    if (err) return console.error(err.message);
    if (row.count === 0) {
      // Mật khẩu dạng plain text cho dự án môn học (có thể hash nếu cần, ở đây dùng đơn giản để dễ đăng nhập demo)
      db.run("INSERT INTO users (username, password, fullname, role, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
        ['admin', 'admin123', 'Quản trị viên', 'admin', 'admin@dienthoai-ai.vn', '0912345678']);
      db.run("INSERT INTO users (username, password, fullname, role, email, phone) VALUES (?, ?, ?, ?, ?, ?)",
        ['customer', '123456', 'Nguyễn Văn A', 'customer', 'customerA@gmail.com', '0987654321']);
      console.log('Đã tạo tài khoản mẫu: admin/admin123 và customer/123456');
    }
  });

  // Chèn dữ liệu sản phẩm mẫu nếu chưa có
  db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
    if (err) return console.error(err.message);
    if (row.count === 0) {
      const sampleProducts = [
        {
          name: 'iPhone 15 Pro Max 256GB',
          brand: 'Apple',
          price: 29990000,
          screen: '6.7 inches, Super Retina XDR OLED, 120Hz',
          cpu: 'Apple A17 Pro (3nm)',
          ram: '8GB',
          rom: '256GB',
          battery: '4441 mAh, Sạc nhanh 20W',
          camera: '48MP chính + 12MP siêu rộng + 12MP Tele 5x',
          image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&auto=format&fit=crop&q=60',
          description: 'Siêu phẩm đỉnh cao của Apple năm 2023 với khung Titan siêu nhẹ, nút Action mới và chip A17 Pro cực mạnh.',
          promotion: 'Giảm ngay 1.000.000đ khi thanh toán qua VNPAY, tặng củ sạc nhanh 20W chính hãng và miễn phí bảo hành VIP 12 tháng.',
          rating_performance: 9.8,
          rating_camera: 9.7,
          rating_battery: 8.8,
          rating_price: 5.0
        },
        {
          name: 'Samsung Galaxy S24 Ultra 256GB',
          brand: 'Samsung',
          price: 27990000,
          screen: '6.8 inches, Dynamic AMOLED 2X, 120Hz, Gorilla Armor',
          cpu: 'Snapdragon 8 Gen 3 for Galaxy',
          ram: '12GB',
          rom: '256GB',
          battery: '5000 mAh, Sạc nhanh 45W',
          camera: '200MP chính + 50MP Tele 5x + 12MP siêu rộng + 10MP Tele 3x',
          image_url: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&auto=format&fit=crop&q=60',
          description: 'Trải nghiệm đỉnh cao công nghệ AI (Galaxy AI) tích hợp bút S-Pen tiện lợi, camera zoom siêu khủng và độ bền vượt trội.',
          promotion: 'Tặng Voucher mua phụ kiện trị giá 1.500.000đ, miễn phí ốp lưng chính hãng và phòng chờ sân bay hạng thương gia.',
          rating_performance: 9.7,
          rating_camera: 9.8,
          rating_battery: 9.0,
          rating_price: 5.5
        },
        {
          name: 'Xiaomi Redmi Note 13 Pro 5G',
          brand: 'Xiaomi',
          price: 7290000,
          screen: '6.67 inches, AMOLED 1.5K, 120Hz',
          cpu: 'Snapdragon 7s Gen 2',
          ram: '8GB',
          rom: '256GB',
          battery: '5100 mAh, Sạc siêu nhanh 67W',
          camera: '200MP chính (OIS) + 8MP siêu rộng + 2MP macro',
          image_url: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=60',
          description: 'Định nghĩa lại phân khúc tầm trung với camera độ phân giải khủng 200MP, màn hình 1.5K siêu nét và sạc nhanh ấn tượng.',
          promotion: 'Tặng tai nghe Redmi Buds 5 trị giá 790.000đ, hỗ trợ trả góp 0% lãi suất qua thẻ tín dụng.',
          rating_performance: 7.5,
          rating_camera: 8.0,
          rating_battery: 8.5,
          rating_price: 8.5
        },
        {
          name: 'Oppo Reno11 F 5G 256GB',
          brand: 'Oppo',
          price: 8490000,
          screen: '6.7 inches, AMOLED FHD+, 120Hz',
          cpu: 'MediaTek Dimensity 7050',
          ram: '8GB',
          rom: '256GB',
          battery: '5000 mAh, Sạc nhanh SuperVOOC 67W',
          camera: '64MP chính + 8MP siêu rộng + 2MP macro',
          image_url: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=600&auto=format&fit=crop&q=60',
          description: 'Chuyên gia chân dung với thiết kế vân kim sa lấp lánh thời thượng, khả năng kháng nước IP65 và hiệu năng ổn định.',
          promotion: 'Tặng 1 năm gói bảo hiểm rơi vỡ màn hình và hỗ trợ thu cũ đổi mới trợ giá lên đến 500.000đ.',
          rating_performance: 7.2,
          rating_camera: 8.3,
          rating_battery: 8.2,
          rating_price: 8.0
        },
        {
          name: 'Xiaomi Poco X6 Pro 5G',
          brand: 'Xiaomi',
          price: 8990000,
          screen: '6.67 inches, AMOLED 1.5K, 120Hz, 1800 nits',
          cpu: 'MediaTek Dimensity 8300-Ultra',
          ram: '8GB',
          rom: '256GB',
          battery: '5000 mAh, Sạc nhanh 67W Turbo Charge',
          camera: '64MP chính (OIS) + 8MP siêu rộng + 2MP macro',
          image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=60',
          description: 'Vua gaming phân khúc cận cao cấp. Chip Dimensity 8300-Ultra cho hiệu năng chơi game mượt mà sánh ngang các Flagship.',
          promotion: 'Giảm trực tiếp 500.000đ vào giá bán (giá gốc 9.490.000đ), tặng kèm miếng dán cường lực cao cấp.',
          rating_performance: 9.0,
          rating_camera: 7.0,
          rating_battery: 8.5,
          rating_price: 8.8
        },
        {
          name: 'Samsung Galaxy A15 LTE',
          brand: 'Samsung',
          price: 4290000,
          screen: '6.5 inches, Super AMOLED, 90Hz',
          cpu: 'MediaTek Helio G99',
          ram: '8GB',
          rom: '128GB',
          battery: '5000 mAh, Sạc nhanh 25W',
          camera: '50MP chính + 5MP siêu rộng + 2MP macro',
          image_url: 'https://images.unsplash.com/photo-1565630916779-e303be97b6f5?w=600&auto=format&fit=crop&q=60',
          description: 'Lựa chọn tiết kiệm hàng đầu của Samsung sở hữu màn hình Super AMOLED rực rỡ, thời lượng pin cả ngày dài và cấu hình bền bỉ.',
          promotion: 'Tặng củ sạc nhanh Samsung 25W chính hãng trị giá 450.000đ.',
          rating_performance: 6.0,
          rating_camera: 6.5,
          rating_battery: 8.5,
          rating_price: 9.5
        },
        {
          name: 'iPhone 13 128GB',
          brand: 'Apple',
          price: 13490000,
          screen: '6.1 inches, Super Retina XDR OLED',
          cpu: 'Apple A15 Bionic (5nm)',
          ram: '4GB',
          rom: '128GB',
          battery: '3240 mAh, Sạc nhanh 20W',
          camera: '12MP chính + 12MP siêu rộng',
          image_url: 'https://images.unsplash.com/photo-1632661672496-648c6ef98f90?w=600&auto=format&fit=crop&q=60',
          description: 'Thiết kế bền vững thời trang, hiệu năng mượt mà vượt thời gian từ chip Apple A15 Bionic và giá thành cực tốt hiện nay.',
          promotion: 'Tặng gói dán cường lực và ốp lưng chống sốc cao cấp Kingbull trị giá 400.000đ.',
          rating_performance: 8.0,
          rating_camera: 8.0,
          rating_battery: 7.5,
          rating_price: 7.5
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO products (
          name, brand, price, screen, cpu, ram, rom, battery, camera, image_url, description, promotion,
          rating_performance, rating_camera, rating_battery, rating_price
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sampleProducts.forEach((p) => {
        stmt.run([
          p.name, p.brand, p.price, p.screen, p.cpu, p.ram, p.rom, p.battery, p.camera, p.image_url, p.description, p.promotion,
          p.rating_performance, p.rating_camera, p.rating_battery, p.rating_price
        ]);
      });
      stmt.finalize();
      console.log('Đã tạo thành công dữ liệu sản phẩm mẫu!');
    }
  });
});

module.exports = db;
