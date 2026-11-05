# Graph Report - ai-account-store  (2026-11-04)

## Corpus Check
- 33 files · ~45,686 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 280 nodes · 311 edges · 13 communities
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- admin.js
- Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store
- Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store
- package.json
- test_account_features.js
- Hướng Dẫn Tích Hợp Casso Webhook & MB Bank Cho JetJet Store
- dependencies
- Phân Định Khách Vãng Lai & Tài Khoản Người Dùng Kèm Xác Thực OTP (Plan v2)
- JetJet Store — Bổ Sung Hoàn Chỉnh Các Chức Năng Còn Thiếu (Plan v1)
- orders.js
- database.js
- Tái Cấu Trúc Bố Cục Trang Cá Nhân (User Profile Modal Redesign)
- test_profile_redesign.js

## God Nodes (most connected - your core abstractions)
1. `Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store` - 13 edges
2. `Phase 6: Icon Thông báo (Notification Bell) — Backend + Frontend` - 12 edges
3. `Hướng Dẫn Tích Hợp Casso Webhook & MB Bank Cho JetJet Store` - 9 edges
4. `express` - 8 edges
5. `JetJet Store — Bổ Sung Hoàn Chỉnh Các Chức Năng Còn Thiếu (Plan v1)` - 8 edges
6. `Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store` - 8 edges
7. `Phân Định Khách Vãng Lai & Tài Khoản Người Dùng Kèm Xác Thực OTP (Plan v2)` - 7 edges
8. `Tái Cấu Trúc Bố Cục Trang Cá Nhân (User Profile Modal Redesign)` - 7 edges
9. `Phase 2: Backend Auth with OTP & Orders Association (35 phút)` - 6 edges
10. `Phase 3: Frontend Storefront (`public/index.html`) (45 phút)` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (13 total, 0 thin omitted)

### Community 0 - "admin.js"
Cohesion: 0.12
Nodes (14): requireAdmin(), multer, path, storage, upload, multer, bcrypt, { createNotification } (+6 more)

### Community 1 - "Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store"
Cohesion: 0.12
Nodes (16): Architecture & Proposed Approach, Current Context & Assumptions, Execution Estimate, Goal, Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store, Open Questions & Decisions, Phase 1: Nâng cấp Backend API (`routes/auth.js`), Phase 2: Thiết kế lại giao diện Profile Center (`public/index.html`) (+8 more)

### Community 2 - "Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store"
Cohesion: 0.05
Nodes (36): Architecture, Current Context, Execution, Goal, Mô tả, Open Questions, Phase 1: Backend — Profile, Change Password, Delete Account (routes/auth.js), Phase 2: Backend — Remember Me (server.js + routes/auth.js) (+28 more)

### Community 3 - "package.json"
Cohesion: 0.07
Nodes (30): globalLimiter, orderLimiter, rateLimit, author, description, keywords, license, main (+22 more)

### Community 4 - "test_account_features.js"
Cohesion: 0.19
Nodes (10): bcrypt, assert, bcrypt, db, extractCookie(), http, request(), run() (+2 more)

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
Cohesion: 0.09
Nodes (20): sanitize(), requireUser(), nodemailer, bcrypt, db, express, router, { sanitize } (+12 more)

### Community 10 - "database.js"
Cohesion: 0.08
Nodes (20): mysql, pool, express, db, express, router, db, express (+12 more)

### Community 11 - "Tái Cấu Trúc Bố Cục Trang Cá Nhân (User Profile Modal Redesign)"
Cohesion: 0.14
Nodes (13): 1. Kiểm tra hiển thị qua Browser Harness & Vision Analyze:, 2. Kiểm tra tương tác:, Architecture & Proposed Approach, Current Context & Assumptions, Goal, Phân tích vấn đề hiện tại (từ ảnh thực tế):, Risks, Tradeoffs & Open Questions, Step-by-Step Tasks (+5 more)

### Community 12 - "test_profile_redesign.js"
Cohesion: 0.40
Nodes (3): fs, http, path

## Knowledge Gaps
- **182 isolated node(s):** `mysql`, `pool`, `rateLimit`, `multer`, `path` (+177 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 195 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `express` connect `database.js` to `admin.js`, `orders.js`, `package.json`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `bcrypt` connect `test_account_features.js` to `admin.js`, `orders.js`, `package.json`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `mysql`, `pool`, `rateLimit` to the rest of the system?**
  _182 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admin.js` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Kế hoạch Thiết kế lại Trang Hồ sơ Cá nhân (Profile Center) — JetJet Store` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Plan: Nâng cấp tính năng tài khoản người dùng JetJet Store` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._