import { test, expect } from "@playwright/test";
import path from "path";

// Đường dẫn lưu trữ ảnh chụp màn hình trong thư mục artifact
const ARTIFACT_DIR = "C:/Users/Acer/.gemini/antigravity/brain/020f3ae8-bcea-46e8-98f3-31593eaa8406";

test("Automate import and capture pages", async ({ page }) => {
  // Lắng nghe console log và lỗi từ trình duyệt để dễ dàng debug
  page.on("console", (msg) => {
    console.log(`[Browser Console] [${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    console.error(`[Browser Page Error] ${err.message}`);
    if (err.stack) console.error(err.stack);
  });

  // Tăng timeout cho toàn bộ test case lên 3 phút vì import dữ liệu lớn có thể mất thời gian
  test.setTimeout(180000);

  console.log("1. Mở trang đăng nhập...");
  await page.goto("/login");
  await expect(page.getByText("FB Pulse Tracker")).toBeVisible();

  console.log("2. Thực hiện đăng ký tài khoản Admin mới ngẫu nhiên để test...");
  // Chuyển sang tab Đăng ký
  await page.click('.ant-tabs-tab-btn:has-text("Đăng ký")');
  await page.waitForTimeout(500); // Đợi tab active

  // Tạo email ngẫu nhiên chứa chữ "admin" để hệ thống tự cấp quyền Admin
  const testEmail = `admin_test_${Date.now()}@gmail.com`;
  console.log(`Tài khoản đăng ký test: ${testEmail}`);

  // Điền thông tin đăng ký
  await page.fill('input[placeholder="Email"]', testEmail);
  await page.fill('input[placeholder="Mật khẩu"]', "123456");
  
  // Submit đăng ký
  await page.click('button[type="submit"]');

  console.log("Chờ điều hướng sang trang chủ...");
  await page.waitForURL("**/", { timeout: 30000 });
  console.log("Đăng ký và đăng nhập thành công!");

  await expect(page.getByText("Tổng quan").first()).toBeVisible();

  // Chụp ảnh màn hình trang chủ trống (nếu chưa có data) hoặc có data cũ
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "1_homepage_before.png"), fullPage: true });
  console.log("Đã chụp ảnh màn hình trang chủ trước khi import.");

  console.log("3. Mở modal Import ZIP...");
  // Bấm nút Import trên thanh công cụ
  await page.click('button:has-text("Import")');
  
  // Đợi modal xuất hiện
  await page.waitForSelector('.ant-modal-title:has-text("Import ZIP dữ liệu Facebook")');

  console.log("4. Chọn file ZIP và upload lên client-side...");
  const zipPath = "D:\\TrungHuy\\TTTN\\Data_format\\27052026.zip";
  
  // Đặt file ZIP vào input file ẩn của Ant Design Upload
  await page.setInputFiles('input[type="file"]', zipPath);

  console.log("Đang giải nén và phân tích dữ liệu trên trình duyệt...");
  // Đợi nút OK (nút "Import") trong modal không còn bị disable (quá trình parse zip hoàn tất)
  const okButton = page.locator('.ant-modal-footer button.ant-btn-primary');
  await expect(okButton).not.toBeDisabled({ timeout: 60000 });
  
  console.log("Đọc file ZIP hoàn tất. Tiến hành import lên Firestore...");
  // Click nút xác nhận Import
  await okButton.click();

  console.log("5. Chờ quá trình upload chunks hoàn tất...");
  // Đợi modal đóng lại (tải hoàn tất 100% và finalize)
  await page.waitForSelector('.ant-modal-content', { state: 'detached', timeout: 120000 });
  console.log("Import thành công lên Firestore!");

  // Đợi 2 giây để giao diện cập nhật dữ liệu mới từ listener realtime
  await page.waitForTimeout(2000);

  // Chụp ảnh màn hình trang chủ với dữ liệu mới
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "2_homepage_after.png"), fullPage: true });
  console.log("Đã chụp ảnh màn hình Dashboard sau khi import.");

  console.log("6. Điều hướng sang trang Analytics (Phân tích)...");
  await page.goto("/analytics");
  // Đợi các biểu đồ tải xong
  await page.waitForSelector('.echarts-for-react', { timeout: 10000 });
  await page.waitForTimeout(2000); // Đợi biểu đồ vẽ xong hoàn toàn
  
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "3_analytics.png"), fullPage: true });
  console.log("Đã chụp ảnh màn hình trang Analytics.");

  console.log("7. Điều hướng sang trang Comments (Bình luận)...");
  await page.goto("/comments");
  // Đợi bảng bình luận xuất hiện
  await page.waitForSelector('.ant-table', { timeout: 10000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, "4_comments.png"), fullPage: true });
  console.log("Đã chụp ảnh màn hình trang Comments.");

  console.log("Kiểm thử tự động trên trình duyệt hoàn tất thành công!");
});
