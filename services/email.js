require('dotenv').config();
const nodemailer = require('nodemailer');

let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: process.env.SMTP_SECURE === 'true' || true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendOtpEmail(email, code, type) {
  const isRegister = type === 'register';
  const subject = isRegister 
    ? `🐴 [JetJet Store] Mã xác thực tạo tài khoản: ${code}`
    : `🔑 [JetJet Store] Mã xác thực đổi mật khẩu: ${code}`;

  const title = isRegister ? 'Mã Xác Thực Đăng Ký Tài Khoản' : 'Mã Xác Thực Đổi Mật Khẩu';
  const actionText = isRegister 
    ? 'Cảm ơn quý dzị đã ghé ủng hộ tiệm tạp hóa AI miền Tây. Dưới đây là mã xác nhận để kích hoạt tài khoản:'
    : 'Tiệm nhận được yêu cầu đổi mật khẩu cho tài khoản này. Dưới đây là mã xác thực:';

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e5e5;border-radius:12px;background:#ffffff;">
      <div style="text-align:center;margin-bottom:20px;">
        <span style="font-size:28px;">🐴</span>
        <h2 style="color:#0a0a0a;margin:8px 0 0;font-size:20px;">JetJet Store — Tạp Hóa AI</h2>
      </div>
      <div style="background:#f9f9f9;padding:20px;border-radius:8px;text-align:center;">
        <h3 style="margin-top:0;color:#171717;">${title}</h3>
        <p style="color:#525252;font-size:14px;line-height:1.5;">${actionText}</p>
        <div style="margin:24px 0;">
          <span style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:6px;color:#0a0a0a;background:#ffffff;padding:12px 24px;border:2px dashed #0a0a0a;border-radius:8px;">${code}</span>
        </div>
        <p style="color:#737373;font-size:12px;margin-bottom:0;">Mã có hiệu lực trong <strong>5 phút</strong>. Quý dzị tuyệt đối hổng chia sẻ mã này cho ai nghen!</p>
      </div>
    </div>
  `;

  // Always log to terminal for seamless local dev & automated test suites
  console.log(`\n📬 [EMAIL OTP SERVICE] -> ${email} | Type: ${type} | CODE: ${code}\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"JetJet Store" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        html
      });
      console.log(`✅ Đã gửi email thực tế tới: ${email}`);
    } catch (err) {
      console.error('⚠️ Không thể gửi mail qua SMTP (fallback console log):', err.message);
    }
  } else {
    console.log('ℹ️ Chưa cấu hình SMTP_PASS trong .env -> Đã in mã ra console để test.');
  }

  return true;
}

async function sendOrderEmail(email, orderCode, type, extra = {}) {
  const isCreated = type === 'created';
  const subject = isCreated
    ? `[JetJet Store] Đơn hàng ${orderCode} đã được tạo`
    : `[JetJet Store] Đơn hàng ${orderCode} đã hoàn thành — Nhận tài khoản`;

  const title = isCreated ? 'Xác nhận đơn hàng' : 'Đơn hàng hoàn thành';
  const body = isCreated
    ? `Đơn hàng <strong>${orderCode}</strong> đã được tạo thành công. Vui lòng thanh toán qua mã QR để hoàn tất.`
    : `Đơn hàng <strong>${orderCode}</strong> đã được giao. ${extra.delivery_info ? '<br><br><strong>Thông tin tài khoản:</strong><br><pre style="background:#f4f4f5;padding:12px;border-radius:6px;font-size:13px;">' + extra.delivery_info + '</pre>' : ''}`;

  const html = `
    <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e5e5e5;border-radius:12px;background:#fff;">
      <div style="text-align:center;margin-bottom:16px;">
        <h2 style="color:#0a0a0a;font-size:18px;margin:0;">JetJet Store</h2>
      </div>
      <div style="background:#f9f9f9;padding:20px;border-radius:8px;">
        <h3 style="margin-top:0;color:#171717;">${title}</h3>
        <p style="color:#525252;font-size:14px;line-height:1.6;">${body}</p>
        <p style="color:#a3a3a3;font-size:11px;margin-bottom:0;">Mã tra cứu: <strong>${orderCode}</strong></p>
      </div>
    </div>`;

  console.log(`\n📧 [ORDER EMAIL] -> ${email} | ${type} | ${orderCode}\n`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"JetJet Store" <${process.env.SMTP_USER}>`,
        to: email,
        subject,
        html
      });
    } catch (err) {
      console.error('⚠️ Order email send failed:', err.message);
    }
  }
}

module.exports = { sendOtpEmail, sendOrderEmail };
