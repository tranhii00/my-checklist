# Checklist Cá Nhân 24/7 Cloud PWA

> Ứng dụng Quản lý Công việc & Lên Kế hoạch Kỷ luật Cá nhân Hàng Ngày, Hoạt động Độc lập & Đồng bộ Đám mây 24/7 qua GitHub Gist. Hỗ trợ PWA cài đặt trực tiếp trên iPhone Safari và Android Chrome.

---

## 🌟 Điểm Nổi Bật & Trải Nghiệm Người Dùng

1. **Giao diện Trọng tâm Theo Ngày (Date-Centric UX)**:
   - Mở ứng dụng là thấy ngay danh sách công việc của ngày hôm nay (VD: *Thứ Bảy, ngày 15/11/2026*).
   - Thanh chọn ngày trực quan 1-click: `[◀ Hôm qua]` `[Hôm nay]` `[Ngày mai]` `[+2 ngày]` `[+3 ngày]` `[📅 Lịch]`. Bấm ngày nào hiển thị chính xác checklist ngày đó.

2. **Quản lý Công việc Thông minh**:
   - **Nhóm "Cần làm"**: Checkbox lớn 24x24px dễ bấm trên điện thoại, hỗ trợ giờ hẹn `⏰`, ghi chú chi tiết `📝`, nút `Dời sang mai` (1-click chuyển task sang ngày mai), nút Sửa và Xóa.
   - **Nhóm "Đã hoàn thành"**: Tự động gạch ngang và chuyển xuống dưới kèm mốc thời gian hoàn thành (VD: `✓ Xong lúc 14:35`), âm thanh hoàn thành (Chime synthesizer) sảng khoái, bấm lại để bỏ tick nếu nhầm.
   - **Nút "Dời tất cả sang mai"**: Tiện lợi khi kết thúc ngày để chuyển toàn bộ việc chưa xong sang ngày hôm sau.

3. **📜 Nhật ký Lịch sử & Chuỗi Kỷ luật (Streak)**:
   - Theo dõi tỷ lệ hoàn thành từng ngày trong quá khứ (VD: `5/5 việc - 100%`).
   - Đếm chuỗi ngày kỷ luật (Streak) để duy trì thói quen tích cực.
   - Tổng kết toàn bộ công việc trọn đời đã hoàn thành.

4. **Đồng bộ Đám mây 24/7 & Offline 0ms**:
   - Lưu trữ tự động 2 chiều lên GitHub Gist (`a94667ab688b60688f27c695ae1871ed`).
   - Lưu cache trong `localStorage` giúp mở ứng dụng ngay tức thì 0ms trên điện thoại kể cả khi không có mạng hoặc bật chế độ máy bay.
   - Tự động đồng bộ ngay khi có mạng trở lại.

5. **Cài đặt như Ứng dụng Nguyên bản (PWA)**:
   - Đầy đủ `manifest.json`, `sw.js` (Service Worker) và icon sắc nét.
   - Trên iPhone Safari: Bấm nút **Chia sẻ (Share)** -> **Thêm vào MH chính (Add to Home Screen)**.
   - Trên Android Chrome: Bấm menu 3 chấm -> **Cài đặt ứng dụng (Install App)**.

---

## 🚀 Đường Dẫn Đăng Nhập 1-Click Tự Động (One-Click Cloud URL)

Người dùng chỉ cần mở đường link sau trên điện thoại hoặc máy tính, app sẽ **tự động kết nối Đám mây 24/7** mà không cần nhập thủ công bất kỳ mã token nào:

👉 **`https://tranhii00.github.io/my-checklist/#gist=a94667ab688b60688f27c695ae1871ed&token=<TOKEN>`**

*(Hệ thống sẽ tự động lưu cấu hình bảo mật vào LocalStorage và tự động làm sạch URL sau khi mở).*

---

## 🛠️ Cấu trúc Thư mục

```text
my-checklist-web/
├── index.html        # Giao diện responsive 100%, Dark Theme cao cấp
├── app.js            # Engine xử lý dữ liệu, logic ngày, âm thanh & Gist Cloud Sync
├── manifest.json     # Cấu hình PWA Web App Manifest
├── sw.js             # Service Worker bộ nhớ đệm Offline 0ms
├── icons/            # Bộ icon PWA 192x192, 512x512, Apple touch icon
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── apple-touch-icon.png
│   └── favicon.png
└── README.md         # Hướng dẫn chi tiết
```
