import { Browser, Page } from "puppeteer-core";

export interface SeedingTaskPayload {
  id: string;
  action: "like" | "comment" | "share";
  postUrl: string;
  commentText?: string;
  profileId: string;
}

/**
 * Trễ ngẫu nhiên mô phỏng hành vi con người
 */
async function delay(seconds: number) {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function randomDelay(min: number, max: number) {
  const secs = Math.floor(Math.random() * (max - min + 1) + min);
  console.log(`[Task Runner] Đang trễ ngẫu nhiên ${secs} giây để giả lập người dùng...`);
  await delay(secs);
}

/**
 * Quét trang và thử click vào các phần tử khớp với danh sách selectors
 */
async function clickFirstMatch(page: Page, selectors: string[], actionName: string): Promise<boolean> {
  for (const selector of selectors) {
    try {
      console.log(`[Task Runner] Thử tìm selector ${actionName}: ${selector}`);
      const element = await page.$(selector);
      if (element) {
        console.log(`[Task Runner] Tìm thấy! Đang click vào ${selector}...`);
        await element.click();
        return true;
      }
    } catch {
      // Bỏ qua lỗi selector không hợp lệ hoặc lỗi tìm kiếm.
    }
  }
  return false;
}

/**
 * Tìm kiếm phần tử theo Text nội dung bên trong
 */
async function clickByText(page: Page, textList: string[], tag: string = "div"): Promise<boolean> {
  for (const text of textList) {
    try {
      console.log(`[Task Runner] Thử tìm nút có chữ "${text}"...`);
      // Thử dùng XPath hoặc query selector evaluate
      const clicked = await page.evaluate((txt, tagName) => {
        const elements = Array.from(document.querySelectorAll(tagName));
        const match = elements.find((el) => 
          el.textContent?.trim().toLowerCase() === txt.toLowerCase() || 
          el.getAttribute("aria-label")?.trim().toLowerCase() === txt.toLowerCase()
        );
        if (match) {
          (match as HTMLElement).click();
          return true;
        }
        return false;
      }, text, tag);

      if (clicked) {
        console.log(`[Task Runner] Tìm thấy và click bằng chữ thành công: "${text}"`);
        return true;
      }
    } catch {
      // Bỏ qua lỗi evaluate.
    }
  }
  return false;
}

/**
 * Thực thi một Seeding Task trên Chrome profile
 */
export async function runSeedingTask(
  browser: Browser,
  task: SeedingTaskPayload,
  minDelay: number = 5,
  maxDelay: number = 20
): Promise<void> {
  const page = await browser.newPage();
  
  // Thiết lập User Agent và kích thước màn hình ngẫu nhiên/chuẩn để tránh phát hiện bot
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  try {
    console.log(`[Task Runner] Bắt đầu truy cập URL bài viết: ${task.postUrl}`);
    await page.goto(task.postUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    
    // Đợi 3-5 giây cho trang ổn định và tải các thành phần động
    await delay(4);

    if (task.action === "like") {
      console.log("[Task Runner] Đang chạy tác vụ LIKE/THÍCH...");
      
      // Danh sách selectors phổ biến cho nút Thích của Facebook
      const likeSelectors = [
        '[aria-label="Thích"]',
        '[aria-label="Like"]',
        '[aria-label="Bày tỏ cảm xúc"]',
        'div[role="button"]::title(Thích)',
        'div[role="button"]::title(Like)'
      ];

      let success = await clickFirstMatch(page, likeSelectors, "Like");
      
      if (!success) {
        // Dự phòng: Tìm bằng text tiếng Việt và tiếng Anh
        success = await clickByText(page, ["Thích", "Like"], "span");
      }
      if (!success) {
        success = await clickByText(page, ["Thích", "Like"], "div");
      }

      if (!success) {
        throw new Error("Không thể tìm thấy nút Thích (Like) trên trang Facebook.");
      }

      console.log("[Task Runner] Đã click nút THÍCH thành công!");
      await randomDelay(minDelay, maxDelay);

    } else if (task.action === "comment") {
      console.log("[Task Runner] Đang chạy tác vụ VIẾT BÌNH LUẬN...");
      if (!task.commentText) {
        throw new Error("Nội dung bình luận trống.");
      }

      // 1. Tìm và click vào ô nhập bình luận
      const commentInputSelectors = [
        'div[role="textbox"][aria-label="Viết bình luận..."]',
        'div[role="textbox"][aria-label="Viết bình luận bằng tiếng Việt..."]',
        'div[role="textbox"][aria-label="Write a comment..."]',
        'div[role="textbox"][aria-label="Viết phản hồi..."]',
        'div[role="textbox"]',
        '.x1ed107z' // Facebook comment textbox class phổ biến
      ];

      let inputFound = false;
      for (const selector of commentInputSelectors) {
        try {
          const el = await page.$(selector);
          if (el) {
            await el.focus();
            await el.click();
            inputFound = true;
            console.log(`[Task Runner] Đã click và focus thành công vào ô nhập: ${selector}`);
            break;
          }
        } catch {
          // Bỏ qua selector lỗi, thử selector tiếp theo.
        }
      }

      if (!inputFound) {
        throw new Error("Không thể tìm thấy ô nhập bình luận (comment textbox) trên trang Facebook.");
      }

      await delay(1.5);

      // 2. Gõ nội dung comment
      console.log(`[Task Runner] Đang gõ nội dung: "${task.commentText}"`);
      await page.keyboard.type(task.commentText, { delay: 100 }); // delay 100ms mỗi ký tự để giả lập gõ tay

      await delay(1);

      // 3. Nhấn Enter để gửi comment
      console.log("[Task Runner] Đang nhấn Enter để gửi bình luận...");
      await page.keyboard.press("Enter");
      
      // Chờ 3 giây để Facebook xử lý gửi bình luận
      await delay(3);
      console.log("[Task Runner] Đã gửi bình luận thành công!");
      await randomDelay(minDelay, maxDelay);

    } else if (task.action === "share") {
      console.log("[Task Runner] Đang chạy tác vụ CHIA SẺ...");

      // 1. Tìm nút Chia sẻ (Share) chính
      const shareSelectors = [
        '[aria-label="Chia sẻ"]',
        '[aria-label="Share"]',
        'div[role="button"]::title(Chia sẻ)',
        'div[role="button"]::title(Share)'
      ];

      let shareBtnClicked = await clickFirstMatch(page, shareSelectors, "Share");
      if (!shareBtnClicked) {
        shareBtnClicked = await clickByText(page, ["Chia sẻ", "Share"], "span");
      }
      if (!shareBtnClicked) {
        shareBtnClicked = await clickByText(page, ["Chia sẻ", "Share"], "div");
      }

      if (!shareBtnClicked) {
        throw new Error("Không thể tìm thấy nút Chia sẻ (Share) trên bài viết.");
      }

      await delay(2);

      // 2. Click nút "Chia sẻ ngay" trong menu xuất hiện
      console.log("[Task Runner] Đang tìm nút Chia sẻ ngay (Share Now) trong menu...");
      const shareNowSelectors = [
        '[aria-label="Chia sẻ ngay (Công khai)"]',
        '[aria-label="Chia sẻ ngay"]',
        '[aria-label="Share now (Public)"]',
        '[aria-label="Share now"]'
      ];

      let shareNowClicked = await clickFirstMatch(page, shareNowSelectors, "Share Now");
      if (!shareNowClicked) {
        shareNowClicked = await clickByText(page, ["Chia sẻ ngay", "Chia sẻ ngay (Công khai)", "Share now", "Share now (Public)"], "span");
      }
      if (!shareNowClicked) {
        shareNowClicked = await clickByText(page, ["Chia sẻ ngay", "Share now"], "div");
      }

      if (!shareNowClicked) {
        throw new Error("Không thể tìm thấy tùy chọn 'Chia sẻ ngay' trong menu chia sẻ.");
      }

      // Đợi Facebook lưu bài chia sẻ
      await delay(4);
      console.log("[Task Runner] Đã chia sẻ bài viết thành công!");
      await randomDelay(minDelay, maxDelay);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Task Runner] Lỗi trong lúc thực thi task:`, message);
    throw err;
  } finally {
    try {
      console.log("[Task Runner] Đang đóng tab điều khiển...");
      await page.close();
    } catch {
      // Ignore tab close errors.
    }
  }
}
