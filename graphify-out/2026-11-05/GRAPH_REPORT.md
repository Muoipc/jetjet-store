# Graph Report - ai-account-store  (2026-11-05)

## Corpus Check
- 40 files · ~60,312 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 357 nodes · 385 edges · 17 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- admin.js
- Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store
- Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store
- package.json
- Kế Hoạch Tái Thiết Kế Nội Dung & Tinh Chỉnh Chức Năng Cửa Hàng Số JetJet (Plan)
- Hướng Dẫn Tích Hợp Casso Webhook & MB Bank Cho JetJet Store
- dependencies
- Phân Định Khách Vãng Lai & Tài Khoản Người Dùng Kèm Xác Thực OTP (Plan v2)
- JetJet Store — Bổ Sung Hoàn Chỉnh Các Chức Năng Còn Thiếu (Plan v1)
- orders.js
- database.js
- Tái Cấu Trúc Bố Cục Trang Cá Nhân (User Profile Modal Redesign)
- test_profile_redesign.js
- Kế Hoạch Chuyển Đổi Sang Mô Hình Sản Phẩm Số & Khóa Học AI (Plan)
- test_avatar_upload.js
- Kế hoạch Hoàn thiện & Nâng cấp Toàn diện Chức năng Giỏ hàng — JetJet Store
- express

## God Nodes (most connected - your core abstractions)
1. `Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store` - 13 edges
2. `Phase 6: Icon Thông báo (Notification Bell) — Backend + Frontend` - 12 edges
3. `Hướng Dẫn Tích Hợp Casso Webhook & MB Bank Cho JetJet Store` - 9 edges
4. `express` - 8 edges
5. `JetJet Store — Bổ Sung Hoàn Chỉnh Các Chức Năng Còn Thiếu (Plan v1)` - 8 edges
6. `Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store` - 8 edges
7. `Phân Định Khách Vãng Lai & Tài Khoản Người Dùng Kèm Xác Thực OTP (Plan v2)` - 7 edges
8. `Tái Cấu Trúc Bố Cục Trang Cá Nhân (User Profile Modal Redesign)` - 7 edges
9. `Kế hoạch Hoàn thiện & Nâng cấp Toàn diện Chức năng Giỏ hàng — JetJet Store` - 7 edges
10. `Kế Hoạch Chuyển Đổi Sang Mô Hình Sản Phẩm Số & Khóa Học AI (Plan)` - 7 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (17 total, 0 thin omitted)

### Community 0 - "admin.js"
Cohesion: 0.08
Nodes (22): requireAdmin(), avatarStorage, multer, path, storage, upload, uploadAvatar, multer (+14 more)

### Community 1 - "Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store"
Cohesion: 0.12
Nodes (16): Architecture & Proposed Approach, Current Context & Assumptions, Execution Estimate, Goal, Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store, Open Questions & Decisions, Phase 1: Nâng cấp Backend API (`routes/auth.js`), Phase 2: Thiết kế lại giao diện Profile Center (`public/index.html`) (+8 more)

### Community 2 - "Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store"
Cohesion: 0.05
Nodes (36): Architecture, Current Context, Execution, Goal, Mô tả, Open Questions, Phase 1: Backend — Profile, Change Password, Delete Account (routes/auth.js), Phase 2: Backend — Remember Me (server.js + routes/auth.js) (+28 more)

### Community 3 - "package.json"
Cohesion: 0.07
Nodes (30): globalLimiter, orderLimiter, rateLimit, author, description, keywords, license, main (+22 more)

### Community 4 - "Kế Hoạch Tái Thiết Kế Nội Dung & Tinh Chỉnh Chức Năng Cửa Hàng Số JetJet (Plan)"
Cohesion: 0.12
Nodes (16): 1. Automated Script Verification:, 1. Hiện trạng:, 2. Browser Visual QA:, 2. Định hướng phong cách (Style Constraints):, Architecture & Proposed Approach, Current Context & Assumptions, Goal, Kế Hoạch Tái Thiết Kế Nội Dung & Tinh Chỉnh Chức Năng Cửa Hàng Số JetJet (Plan) (+8 more)

### Community 5 - "Hướng Dẫn Tích Hợp Casso Webhook & MB Bank Cho JetJet Store"
Cohesion: 0.09
Nodes (20): 1. Nguyên Lý Hoạt Động, 2. Bước 1: Đăng Ký Tài Khoản Casso, 3. Bước 2: Liên Kết Tài Khoản MB Bank, 4. Bước 3: Public Localhost Ra Internet (Môi Trường Phát Triển), 5. Bước 4: Cấu Hình Webhook Trên Casso, 6. Bước 5: Cấu Hình Biến Môi Trường `.env`, 7. Bước 6: Chạy Script Test Tự Động, 8. Xử Lý Sự Cố Thường Gặp (Troubleshooting) (+12 more)

### Community 6 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, bcrypt, cookie-parser, cors, dotenv, express, express-rate-limit, express-session (+4 more)

### Community 7 - "Phân Định Khách Vãng Lai & Tài Khoản Người Dùng Kèm Xác Thực OTP (Plan v2)"
Cohesion: 0.08
Nodes (25): Architecture & Proposed Approach, Current Context & Assumptions, Giả định kiến trúc:, Goal, Hiện trạng:, Kịch bản kiểm thử:, Phase 1: Database Migration & Email Service Setup (15 phút), Phase 2: Backend Auth with OTP & Orders Association (35 phút) (+17 more)

### Community 8 - "JetJet Store — Bổ Sung Hoàn Chỉnh Các Chức Năng Còn Thiếu (Plan v1)"
Cohesion: 0.08
Nodes (24): Architecture & Proposed Approach, Current Context & Assumptions, File Tree Changes Summary, Goal, Hiện trạng hệ thống:, JetJet Store — Bổ Sung Hoàn Chỉnh Các Chức Năng Còn Thiếu (Plan v1), Kịch bản kiểm thử:, Phase 1: Database Migration — Bổ Sung Trường Bàn Giao Tài Khoản (10 phút) (+16 more)

### Community 9 - "orders.js"
Cohesion: 0.08
Nodes (21): sanitize(), requireUser(), nodemailer, bcrypt, db, express, router, { sanitize } (+13 more)

### Community 10 - "database.js"
Cohesion: 0.07
Nodes (19): mysql, pool, bcrypt, assert, bcrypt, db, extractCookie(), http (+11 more)

### Community 11 - "Tái Cấu Trúc Bố Cục Trang Cá Nhân (User Profile Modal Redesign)"
Cohesion: 0.14
Nodes (13): 1. Kiểm tra hiển thị qua Browser Harness & Vision Analyze:, 2. Kiểm tra tương tác:, Architecture & Proposed Approach, Current Context & Assumptions, Goal, Phân tích vấn đề hiện tại (từ ảnh thực tế):, Risks, Tradeoffs & Open Questions, Step-by-Step Tasks (+5 more)

### Community 12 - "test_profile_redesign.js"
Cohesion: 0.40
Nodes (3): fs, http, path

### Community 13 - "Kế Hoạch Chuyển Đổi Sang Mô Hình Sản Phẩm Số & Khóa Học AI (Plan)"
Cohesion: 0.09
Nodes (22): Architecture & Proposed Approach, Current Context & Assumptions, Giả định kiến trúc:, Goal, Hiện trạng hệ thống:, Kế Hoạch Chuyển Đổi Sang Mô Hình Sản Phẩm Số & Khóa Học AI (Plan), Kịch bản kiểm thử:, Phase 1: Database Migration — Thêm Trường Auto Delivery (10 phút) (+14 more)

### Community 14 - "test_avatar_upload.js"
Cohesion: 0.25
Nodes (3): fs, http, path

### Community 15 - "Kế hoạch Hoàn thiện & Nâng cấp Toàn diện Chức năng Giỏ hàng — JetJet Store"
Cohesion: 0.10
Nodes (19): Architecture & Proposed Approach, Current Context & Assumptions, Execution Estimate, Goal, Kế hoạch Hoàn thiện & Nâng cấp Toàn diện Chức năng Giỏ hàng — JetJet Store, Phase 1: Nâng cấp CSS & Animation cho Giỏ hàng (`public/index.html`), Phase 2: Cập nhật Cấu trúc HTML Giỏ hàng & Checkout Modal (`public/index.html`), Phase 3: Nâng cấp Toàn bộ Logic JavaScript Giỏ hàng (`public/index.html`) (+11 more)

### Community 16 - "express"
Cohesion: 0.20
Nodes (7): express, db, express, router, db, express, router

## Knowledge Gaps
- **228 isolated node(s):** `mysql`, `pool`, `rateLimit`, `multer`, `path` (+223 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 250 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `express` to `admin.js`, `orders.js`, `package.json`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `bcrypt` connect `database.js` to `admin.js`, `orders.js`, `package.json`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `mysql`, `pool`, `rateLimit` to the rest of the system?**
  _228 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admin.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08262108262108261 - nodes in this community are weakly interconnected._
- **Should `Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._