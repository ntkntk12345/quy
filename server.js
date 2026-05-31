require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Phục vụ giao diện tĩnh từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));



// ==========================================
// 1. API AUTHENTICATION
// ==========================================

// Đăng ký tài khoản
app.post('/api/auth/register', (req, res) => {
  const { username, password, fullname, email, phone } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng cung cấp username và password!' });
  }

  const query = `INSERT INTO users (username, password, fullname, role, email, phone) VALUES (?, ?, ?, 'customer', ?, ?)`;
  db.run(query, [username, password, fullname, email, phone], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại!' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({
      success: true,
      user: { id: this.lastID, username, fullname, role: 'customer', email, phone }
    });
  });
});

// Đăng nhập
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đủ tài khoản và mật khẩu!' });
  }

  db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(401).json({ error: 'Sai tài khoản hoặc mật khẩu!' });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullname: user.fullname,
        role: user.role,
        email: user.email,
        phone: user.phone
      }
    });
  });
});


// ==========================================
// 2. API PRODUCTS
// ==========================================

// Lấy danh sách sản phẩm
app.get('/api/products', (req, res) => {
  const { brand, minPrice, maxPrice, search } = req.query;
  let query = `SELECT * FROM products WHERE 1=1`;
  const params = [];

  if (brand) {
    query += ` AND brand = ?`;
    params.push(brand);
  }
  if (minPrice) {
    query += ` AND price >= ?`;
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    query += ` AND price <= ?`;
    params.push(Number(maxPrice));
  }
  if (search) {
    query += ` AND (name LIKE ? OR brand LIKE ? OR description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Lấy chi tiết sản phẩm
app.get('/api/products/:id', (req, res) => {
  db.get(`SELECT * FROM products WHERE id = ?`, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Không tìm thấy sản phẩm!' });
    }
    res.json(row);
  });
});

// Thêm sản phẩm (Dành cho Admin)
app.post('/api/products', (req, res) => {
  const {
    name, brand, price, screen, cpu, ram, rom, battery, camera, image_url, image_url_hover, description, promotion,
    rating_performance, rating_camera, rating_battery, rating_price
  } = req.body;

  if (!name || !brand || !price) {
    return res.status(400).json({ error: 'Tên, thương hiệu và giá bán là bắt buộc!' });
  }

  const query = `
    INSERT INTO products (
      name, brand, price, screen, cpu, ram, rom, battery, camera, image_url, image_url_hover, description, promotion,
      rating_performance, rating_camera, rating_battery, rating_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    name, brand, Number(price), screen, cpu, ram, rom, battery, camera, image_url, image_url_hover, description, promotion,
    Number(rating_performance || 5), Number(rating_camera || 5), Number(rating_battery || 5), Number(rating_price || 5)
  ], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Cập nhật sản phẩm (Dành cho Admin)
app.put('/api/products/:id', (req, res) => {
  const {
    name, brand, price, screen, cpu, ram, rom, battery, camera, image_url, image_url_hover, description, promotion,
    rating_performance, rating_camera, rating_battery, rating_price
  } = req.body;

  const query = `
    UPDATE products SET
      name = ?, brand = ?, price = ?, screen = ?, cpu = ?, ram = ?, rom = ?, battery = ?, camera = ?, 
      image_url = ?, image_url_hover = ?, description = ?, promotion = ?, rating_performance = ?, rating_camera = ?, 
      rating_battery = ?, rating_price = ?
    WHERE id = ?
  `;

  db.run(query, [
    name, brand, Number(price), screen, cpu, ram, rom, battery, camera, image_url, image_url_hover, description, promotion,
    Number(rating_performance), Number(rating_camera), Number(rating_battery), Number(rating_price), req.params.id
  ], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// Xóa sản phẩm (Dành cho Admin)
app.delete('/api/products/:id', (req, res) => {
  db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});


// ==========================================
// 3. API ORDERS & LEADS
// ==========================================

// Tạo đơn hàng mới
app.post('/api/order', (req, res) => {
  const { user_id, fullname, phone, email, address, cart, total_price } = req.body;

  if (!fullname || !phone || !email || !address || !cart || cart.length === 0) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin thanh toán!' });
  }

  // Bắt đầu Transaction ghi đơn hàng
  db.serialize(() => {
    db.run("BEGIN TRANSACTION");

    const orderQuery = `INSERT INTO orders (user_id, fullname, phone, email, address, total_price, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`;
    db.run(orderQuery, [user_id || null, fullname, phone, email, address, total_price], function (err) {
      if (err) {
        db.run("ROLLBACK");
        return res.status(500).json({ error: err.message });
      }

      const orderId = this.lastID;
      const itemQuery = `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`;

      let errorOccurred = false;
      let completedRequests = 0;

      cart.forEach((item) => {
        db.run(itemQuery, [orderId, item.id, item.quantity, item.price], (itemErr) => {
          if (itemErr) {
            errorOccurred = true;
          }
          completedRequests++;

          if (completedRequests === cart.length) {
            if (errorOccurred) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: 'Lỗi khi lưu chi tiết đơn hàng.' });
            } else {
              db.run("COMMIT");

              // Webhook N8N đã bị loại bỏ theo yêu cầu
              console.log(`[Order API] Tạo đơn hàng #${orderId} thành công (Không dùng N8N)`);

              return res.json({ success: true, orderId: orderId });
            }
          }
        });
      });
    });
  });
});

// Lấy danh sách đơn hàng
app.get('/api/order/list', (req, res) => {
  const { user_id, role } = req.query;

  let query = `SELECT * FROM orders`;
  const params = [];

  if (role !== 'admin' && user_id) {
    query += ` WHERE user_id = ?`;
    params.push(user_id);
  }
  query += ` ORDER BY created_at DESC`;

  db.all(query, params, (err, orders) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (orders.length === 0) {
      return res.json([]);
    }

    // Lấy chi tiết của tất cả đơn hàng
    let completed = 0;
    const result = [];

    orders.forEach((order) => {
      const itemQuery = `
        SELECT oi.*, p.name as product_name, p.image_url 
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `;
      db.all(itemQuery, [order.id], (errItems, items) => {
        if (!errItems) {
          order.items = items;
        } else {
          order.items = [];
        }
        result.push(order);
        completed++;

        if (completed === orders.length) {
          // Trả về danh sách đơn hàng hoàn chỉnh
          result.sort((a, b) => b.id - a.id);
          res.json(result);
        }
      });
    });
  });
});

// Tạo Lead thông tin liên hệ
app.post('/api/lead', (req, res) => {
  const { email, phone, source } = req.body;
  if (!email && !phone) {
    return res.status(400).json({ error: 'Vui lòng cung cấp ít nhất Email hoặc Số điện thoại!' });
  }

  const query = `INSERT INTO leads (email, phone, source) VALUES (?, ?, ?)`;
  db.run(query, [email || null, phone || null, source || 'chat'], function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const leadId = this.lastID;
    // Webhook N8N đã bị loại bỏ theo yêu cầu
    console.log(`[Lead API] Đăng ký thông tin Lead #${leadId} thành công (Không dùng N8N)`);

    res.json({ success: true, leadId });
  });
});

// Lấy thống kê động cho Admin Dashboard
app.get('/api/admin/stats', (req, res) => {
  db.get("SELECT SUM(total_price) as revenue, COUNT(*) as ordersCount FROM orders", (err, row1) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get("SELECT COUNT(*) as productsCount FROM products", (err, row2) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get("SELECT COUNT(*) as leadsCount FROM leads", (err, row3) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({
          revenue: row1.revenue || 0,
          ordersCount: row1.ordersCount || 0,
          productsCount: row2.productsCount || 0,
          leadsCount: row3.leadsCount || 0
        });
      });
    });
  });
});

// Cập nhật trạng thái đơn hàng (Dành cho Admin)
app.put('/api/order/:id/status', (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Trạng thái là bắt buộc!' });

  db.run("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Lấy danh sách Leads (Dành cho Admin)
app.get('/api/lead/list', (req, res) => {
  db.all("SELECT * FROM leads ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Xóa Lead (Dành cho Admin)
app.delete('/api/lead/:id', (req, res) => {
  db.run("DELETE FROM leads WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});



// ==========================================
// 4. API AI CHATBOT (NVIDIA INTEGRATION)
// ==========================================

// Endpoint xử lý Chat AI
app.post('/api/chat', (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Tin nhắn không được để trống!' });
  }

  // 1. Truy xuất danh sách sản phẩm thực tế từ DB để nhúng vào prompt cho AI làm căn cứ ra quyết định
  db.all("SELECT * FROM products", async (err, products) => {
    if (err) {
      console.error('Lỗi khi truy vấn sản phẩm cho prompt AI:', err.message);
      return res.status(500).json({ error: 'Lỗi truy vấn sản phẩm.' });
    }

    // Định dạng danh sách sản phẩm thành text ngắn gọn để AI đọc hiểu dễ dàng
    const productContext = products.map((p, idx) => {
      return `${idx + 1}. ${p.name} (${p.brand})
   - Giá: ${p.price.toLocaleString('vi-VN')} đ
   - Cấu hình: Màn hình ${p.screen}, Chip ${p.cpu}, RAM ${p.ram}, Bộ nhớ ${p.rom}, Pin ${p.battery}, Camera ${p.camera}
   - Khuyến mãi: ${p.promotion}
   - Điểm đánh giá (thang điểm 1-10): Hiệu năng: ${p.rating_performance}, Camera: ${p.rating_camera}, Thời lượng Pin: ${p.rating_battery}, Giá/Hiệu năng (Điểm càng cao là giá càng tốt): ${p.rating_price}
   - Mô tả ngắn: ${p.description}`;
    }).join('\n\n');

    // 2. Dựng System Prompt cho hệ hỗ trợ ra quyết định (DSS)
    const systemPrompt = `Bạn là Trợ lý ảo AI - Chuyên gia tư vấn và hỗ trợ ra quyết định mua hàng chuyên nghiệp cho website bán điện thoại di động "QD Mobile".
Nhiệm vụ của bạn là tư vấn, giải đáp cấu hình, so sánh các dòng máy và giúp khách hàng lựa chọn sản phẩm phù hợp nhất dựa trên nhu cầu của họ.

Bạn chỉ được phép tư vấn dựa trên danh sách sản phẩm thực tế của cửa hàng dưới đây:
---
${productContext}
---

Quy trình hỗ trợ ra quyết định (DSS) bạn phải tuân thủ khi tư vấn:
1. Phân tích nhu cầu của khách hàng: Hỏi hoặc làm rõ Ngân sách, Thương hiệu ưu thích, Mục đích sử dụng chính (Chơi game, Chụp ảnh, Làm việc văn phòng, Học tập, Pin trâu cho tài xế...).
2. So sánh và Chấm điểm các sản phẩm phù hợp: Đưa ra 2-3 sản phẩm phù hợp và so sánh chúng theo các tiêu chí rõ ràng (Giá, Hiệu năng, Pin, Camera, Thương hiệu, Khuyến mãi).
3. Đề xuất sản phẩm tối ưu nhất: Đưa ra lựa chọn tốt nhất (Recommended) kèm theo giải thích lý do cụ thể vì sao nó phù hợp với khách hàng nhất.
4. Thông tin Khuyến mãi & Hướng dẫn: Nhắc nhở các ưu đãi đang áp dụng của sản phẩm đó và hướng dẫn khách bấm vào nút "Thêm vào giỏ hàng" hoặc "Đặt hàng" trực tiếp trên website để được hưởng ưu đãi.

Lưu ý quan trọng:
- Hãy trả lời ngắn gọn, chuyên nghiệp, cấu trúc rõ ràng (sử dụng bullet points hoặc in đậm để dễ đọc).
- Sử dụng tiếng Việt thân thiện, lịch sự.
- Nếu khách hỏi sản phẩm không có trong danh sách trên, hãy trả lời lịch sự rằng cửa hàng hiện chưa có dòng sản phẩm đó và chủ động gợi ý sản phẩm khác tương đương trong danh sách có sẵn.
- Nếu khách để lại email hoặc số điện thoại để đăng ký tư vấn/khuyến mãi, hãy xác nhận sẽ liên hệ lại sớm.`;

    // 3. Chuẩn bị Messages Payload gửi sang NVIDIA API
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Bổ sung lịch sử trò chuyện để AI hiểu ngữ cảnh cuộc thoại (nếu có)
    if (history && Array.isArray(history)) {
      history.slice(-8).forEach(msg => {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text
        });
      });
    }

    // Tin nhắn mới nhất của người dùng
    messages.push({ role: 'user', content: message });

    // 4. Gọi NVIDIA Chat Completions API
    const apiKey = process.env.NVIDIA_API_KEY;
    const model = process.env.NVIDIA_MODEL || 'moonshotai/kimi-k2.6';

    if (!apiKey || apiKey === 'nvapi-your-key-here') {
      console.warn('[AI Server] NVIDIA API Key chưa được cấu hình. Chạy chế độ Offline Rule-Based.');
      const resultObj = generateOfflineResponse(message, products);
      return res.json({ reply: resultObj.reply, showLeadForm: resultObj.showLeadForm });
    }

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.3,
          max_tokens: 800,
          stream: false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Server] NVIDIA API trả về mã lỗi ${response.status}:`, errorText);
        // Trả về offline response nếu lỗi kết nối API
        const resultObj = generateOfflineResponse(message, products);
        return res.json({ 
          reply: `[Chế độ Offline] Kết nối AI bị gián đoạn. Đây là tư vấn tự động:\n\n${resultObj.reply}`, 
          showLeadForm: resultObj.showLeadForm 
        });
      }

      const responseData = await response.json();
      const aiReply = responseData.choices[0].message.content;
      const lowercaseReply = aiReply.toLowerCase();
      const showLeadForm = lowercaseReply.includes('liên hệ') || 
                           lowercaseReply.includes('đăng ký') || 
                           lowercaseReply.includes('số điện thoại');
      res.json({ reply: aiReply, showLeadForm });

    } catch (apiError) {
      console.error('[AI Server] Lỗi mạng khi gọi NVIDIA API:', apiError.message);
      const resultObj = generateOfflineResponse(message, products);
      res.json({ 
        reply: `[Chế độ Offline] Lỗi kết nối mạng. Đây là gợi ý tự động:\n\n${resultObj.reply}`, 
        showLeadForm: resultObj.showLeadForm 
      });
    }
  });
});

// Hàm hỗ trợ tạo câu trả lời khi không kết nối được NVIDIA API (Rule-based DSS offline)
function generateOfflineResponse(message, products) {
  const msgLower = message.toLowerCase().trim();
  
  // 1. Kiểm tra lời chào hỏi thông thường
  const greetings = ['chào', 'hello', 'hi', 'alo', 'tư vấn', 'cho hỏi', 'xin chào', 'ad', 'admin'];
  const cleanMsg = msgLower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"").trim();
  
  const isGreeting = greetings.includes(cleanMsg) || 
                     cleanMsg === 'chào bạn' || 
                     cleanMsg === 'chào ad' || 
                     cleanMsg === 'chào shop' || 
                     cleanMsg === 'chào mày' ||
                     cleanMsg === 'tư vấn giúp' ||
                     cleanMsg === 'tư vấn giúp tôi';

  if (isGreeting) {
    const greetingText = `Chào bạn! Tôi là Trợ lý ảo AI của cửa hàng QD Mobile hỗ trợ ra quyết định mua sắm.

Tôi có thể hỗ trợ bạn các công việc sau:
1. 🔍 **Tìm kiếm điện thoại** theo ngân sách (ví dụ: 'dưới 10 triệu', 'dưới 5 triệu').
2. 🎮 **Gợi ý sản phẩm** theo nhu cầu sử dụng ('chơi game', 'chụp ảnh', 'pin trâu').
3. ⚔️ **So sánh cấu hình** chi tiết giữa các thiết bị di động.

Bạn đang quan tâm đến nhu cầu nào hoặc cần tôi tư vấn dòng máy nào ạ?`;
    return { reply: greetingText, showLeadForm: false };
  }

  // 2. Tìm kiếm so sánh nhiều sản phẩm trong tin nhắn
  let matchedList = [];
  for (const p of products) {
    const nameLower = p.name.toLowerCase();
    const brandLower = p.brand.toLowerCase();
    
    // Tìm các từ khóa đại diện cho sản phẩm
    let match = false;
    if (msgLower.includes(nameLower)) {
      match = true;
    } else {
      // Tách từ khóa quan trọng
      const words = nameLower.replace(/gb/g, '').split(' ');
      if (brandLower === 'apple' && msgLower.includes('iphone') && words.some(w => w.trim() && w !== 'iphone' && msgLower.includes(w))) {
        match = true;
      } else if (brandLower === 'samsung' && msgLower.includes('s24') && msgLower.includes('ultra')) {
        match = true;
      } else if (brandLower === 'xiaomi' && msgLower.includes('poco') && msgLower.includes('x6')) {
        match = true;
      } else if (brandLower === 'xiaomi' && msgLower.includes('redmi') && msgLower.includes('13')) {
        match = true;
      } else if (brandLower === 'oppo' && msgLower.includes('reno')) {
        match = true;
      } else if (brandLower === 'samsung' && msgLower.includes('a15')) {
        match = true;
      } else if (brandLower === 'apple' && msgLower.includes('iphone 13')) {
        match = true;
      }
    }

    if (match) {
      if (!matchedList.some(item => item.id === p.id)) {
        matchedList.push(p);
      }
    }
  }

  // Nếu tìm thấy từ 2 sản phẩm trở lên -> Tiến hành so sánh động trích xuất từ DB
  if (matchedList.length >= 2) {
    let compareReply = `Chào bạn! Dưới đây là bảng so sánh cấu hình chi tiết giữa các thiết bị được trích xuất trực tiếp từ cơ sở dữ liệu của chúng tôi:\n\n`;
    
    compareReply += `| Tiêu chí | ${matchedList.map(p => `**${p.name}**`).join(' | ')} |\n`;
    compareReply += `| :--- | ${matchedList.map(() => ':---').join(' | ')} |\n`;
    compareReply += `| **Hãng** | ${matchedList.map(p => p.brand).join(' | ')} |\n`;
    compareReply += `| **Giá bán** | ${matchedList.map(p => `**${p.price.toLocaleString('vi-VN')} đ**`).join(' | ')} |\n`;
    compareReply += `| **Màn hình** | ${matchedList.map(p => p.screen || 'Đang cập nhật').join(' | ')} |\n`;
    compareReply += `| **Bộ vi xử lý (CPU)** | ${matchedList.map(p => p.cpu || 'Đang cập nhật').join(' | ')} |\n`;
    compareReply += `| **RAM / ROM** | ${matchedList.map(p => `${p.ram || '8GB'} / ${p.rom || '256GB'}`).join(' | ')} |\n`;
    compareReply += `| **Pin & Sạc** | ${matchedList.map(p => p.battery || 'Đang cập nhật').join(' | ')} |\n`;
    compareReply += `| **Hệ thống Camera** | ${matchedList.map(p => p.camera || 'Đang cập nhật').join(' | ')} |\n`;
    compareReply += `| **Điểm Hiệu năng** | ${matchedList.map(p => `${p.rating_performance || 5}/10`).join(' | ')} |\n`;
    compareReply += `| **Điểm Camera** | ${matchedList.map(p => `${p.rating_camera || 5}/10`).join(' | ')} |\n`;
    compareReply += `| **Điểm Pin** | ${matchedList.map(p => `${p.rating_battery || 5}/10`).join(' | ')} |\n`;
    compareReply += `| **Khuyến mãi** | ${matchedList.map(p => p.promotion || 'Ốp lưng + Cường lực').join(' | ')} |\n`;
    
    compareReply += `\n**Nhận xét hỗ trợ ra quyết định (AI DSS):**\n`;
    
    const sortedPerf = [...matchedList].sort((a, b) => (b.rating_performance || 0) - (a.rating_performance || 0));
    compareReply += `- Về **Hiệu năng**: **${sortedPerf[0].name}** vượt trội nhất với chip \`${sortedPerf[0].cpu}\` (Đạt ${sortedPerf[0].rating_performance || 5}/10 điểm).\n`;
    
    const sortedCam = [...matchedList].sort((a, b) => (b.rating_camera || 0) - (a.rating_camera || 0));
    compareReply += `- Về **Chụp ảnh**: **${sortedCam[0].name}** đứng đầu với camera \`${sortedCam[0].camera}\` (Đạt ${sortedCam[0].rating_camera || 5}/10 điểm).\n`;
    
    const sortedPrice = [...matchedList].sort((a, b) => (b.rating_price || 0) - (a.rating_price || 0));
    compareReply += `- Về **Tối ưu kinh tế (Giá/Hiệu năng)**: **${sortedPrice[0].name}** là lựa chọn tiết kiệm và hợp lý nhất (Đạt ${sortedPrice[0].rating_price || 5}/10 điểm P/P).\n\n`;
    
    compareReply += `Hãy bấm nút **"Thêm vào giỏ hàng"** ở trang chi tiết sản phẩm bạn chọn để đặt hàng trực tiếp nhé!`;
    return { reply: compareReply, showLeadForm: false };
  }

  // 3. Nếu chỉ có 1 sản phẩm khớp -> Trích xuất trực tiếp thông tin chi tiết sản phẩm đó
  if (matchedList.length === 1) {
    const target = matchedList[0];
    const replyText = `Chào bạn! Dưới đây là thông tin chi tiết của **${target.name}** được trích xuất trực tiếp từ cơ sở dữ liệu:\n
* 📱 **Tên sản phẩm:** ${target.name}
* 🏷️ **Thương hiệu:** ${target.brand}
* 💰 **Giá bán lẻ:** ${target.price.toLocaleString('vi-VN')} đ
* ⚙️ **Thông số cấu hình:**
  - Màn hình: ${target.screen || 'Đang cập nhật'}
  - Vi xử lý (CPU): ${target.cpu || 'Đang cập nhật'}
  - RAM / Bộ nhớ trong: ${target.ram} / ${target.rom}
  - Pin & Sạc nhanh: ${target.battery || 'Đang cập nhật'}
  - Hệ thống Camera: ${target.camera || 'Đang cập nhật'}
* 📊 **Điểm chỉ số AI DSS (Hỗ trợ ra quyết định):**
  - Điểm Hiệu năng: **${target.rating_performance}/10**
  - Điểm Camera: **${target.rating_camera}/10**
  - Điểm Pin: **${target.rating_battery}/10**
  - Điểm Kinh tế (Giá/Hiệu năng): **${target.rating_price}/10**
* 🎁 **Khuyến mãi tặng kèm:** ${target.promotion || 'Khuyến mãi ốp lưng cao cấp và cường lực.'}
* 📝 **Mô tả ngắn:** ${target.description || 'Sản phẩm đang bán chạy.'}

Bạn có thể tìm kiếm sản phẩm này trên danh sách và bấm **"Thêm vào giỏ hàng"** để tiến hành đặt mua ngay nhé!`;

    return { reply: replyText, showLeadForm: false };
  }

  // 4. Phân tích từ khóa tầm giá thông thường nếu không khớp tên máy cụ thể
  let maxPrice = Infinity;
  let budgetText = '';
  if (msgLower.includes('dưới 10 triệu') || msgLower.includes('dưới 10tr') || msgLower.includes('8 triệu') || msgLower.includes('8tr') || msgLower.includes('7 triệu')) {
    maxPrice = 10000000;
    budgetText = 'dưới 10 triệu đồng';
  } else if (msgLower.includes('dưới 5 triệu') || msgLower.includes('dưới 5tr')) {
    maxPrice = 5000000;
    budgetText = 'dưới 5 triệu đồng';
  } else if (msgLower.includes('dưới 15 triệu') || msgLower.includes('dưới 15tr')) {
    maxPrice = 15000000;
    budgetText = 'dưới 15 triệu đồng';
  }

  // Lọc sản phẩm phù hợp ngân sách
  let filtered = products.filter(p => p.price <= maxPrice);

  // Phân tích nhu cầu sử dụng
  let filterReason = '';
  if (msgLower.includes('chơi game') || msgLower.includes('gaming') || msgLower.includes('hiệu năng')) {
    filtered.sort((a, b) => b.rating_performance - a.rating_performance);
    filterReason = 'chơi game mượt mà và hiệu năng mạnh mẽ';
  } else if (msgLower.includes('chụp ảnh') || msgLower.includes('chụp hình') || msgLower.includes('camera')) {
    filtered.sort((a, b) => b.rating_camera - a.rating_camera);
    filterReason = 'chụp ảnh sắc nét, camera chuyên nghiệp';
  } else if (msgLower.includes('pin trâu') || msgLower.includes('pin khoẻ') || msgLower.includes('dung lượng pin')) {
    filtered.sort((a, b) => b.rating_battery - a.rating_battery);
    filterReason = 'dung lượng pin lớn và thời lượng sử dụng dài lâu';
  } else {
    // Sắp xếp theo hiệu năng và giá kết hợp
    filtered.sort((a, b) => b.rating_performance - a.rating_performance);
    filterReason = 'đa nhiệm mượt mà, cấu hình tốt trong tầm giá';
  }

  if (filtered.length === 0) {
    return {
      reply: `Hiện tại cửa hàng chưa có dòng điện thoại nào phù hợp chính xác với yêu cầu của bạn. 
Tuy nhiên bạn có thể tham khảo **Samsung Galaxy A15** chỉ với **${(4290000).toLocaleString('vi-VN')} đ** - một lựa chọn cực kỳ tiết kiệm với pin 5000mAh.`,
      showLeadForm: false
    };
  }

  const bestChoice = filtered[0];
  const compareText = filtered.slice(1, 3).map(p => {
    return `- **${p.name}** (${p.price.toLocaleString('vi-VN')}đ): ${p.cpu}, Pin ${p.battery}.`;
  }).join('\n');

  const recommendationText = `Chào bạn! Tôi đã phân tích yêu cầu của bạn về một chiếc điện thoại ${budgetText ? budgetText + ' ' : ''}đáp ứng nhu cầu **${filterReason}**. 

Dưới đây là phân tích và tư vấn hỗ trợ ra quyết định:

### 1. Đề xuất tốt nhất (Best Choice)
Bạn nên chọn **${bestChoice.name}**
* **Giá bán:** ${bestChoice.price.toLocaleString('vi-VN')} đ
* **Khuyến mãi:** ${bestChoice.promotion}
* **Lý do đề xuất:** Máy sở hữu chip **${bestChoice.cpu}**, RAM **${bestChoice.ram}**, ROM **${bestChoice.rom}**. Trên thang điểm hệ thống, máy đạt điểm hiệu năng **${bestChoice.rating_performance}/10**, điểm pin **${bestChoice.rating_battery}/10**, cực kỳ phù hợp với nhu cầu của bạn.

${compareText ? `### 2. Các phương án so sánh thêm\n${compareText}` : ''}

### 3. Hướng dẫn mua hàng
Bạn có thể bấm trực tiếp nút **"Thêm vào giỏ hàng"** ở trang sản phẩm tương ứng và thực hiện đặt hàng trực tuyến để nhận ưu đãi khuyến mãi đi kèm!`;

  return { reply: recommendationText, showLeadForm: true };
}


// Khởi chạy server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Server bán điện thoại AI đang chạy tại: http://localhost:${PORT}`);
  console.log(`Cơ sở dữ liệu SQLite đã được kết nối.`);
  console.log(`=======================================================`);
});
