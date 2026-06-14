import puppeteer, { Browser } from "puppeteer-core";

export interface FacebookInfo {
  fbUid?: string;
  fbName?: string;
  fbAvatar?: string;
  fbUrl?: string;
  isLoggedIn: boolean;
}

/**
 * Cào thông tin tài khoản Facebook từ một cổng Chrome debug đang mở
 * @param debugPort - Cổng debug remote của trình duyệt Chrome GPM
 */
export async function scrapeFacebookInfo(debugPort: number): Promise<FacebookInfo | null> {
  console.log(`[FB Scraper] Đang kết nối Puppeteer tới port ${debugPort}...`);
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.connect({
      browserURL: `http://localhost:${debugPort}`,
      defaultViewport: null
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    // 1. Kiểm tra cookie 'c_user' để xác định đăng nhập
    const cookies = await page.cookies();
    const cUserCookie = cookies.find(c => c.name === "c_user");
    if (!cUserCookie) {
      console.log("[FB Scraper] Không tìm thấy cookie 'c_user'. Chưa đăng nhập Facebook.");
      return { isLoggedIn: false };
    }

    const fbUid = cUserCookie.value;
    console.log(`[FB Scraper] Phát hiện tài khoản Facebook đã đăng nhập, UID: ${fbUid}`);

    // 2. Mở tab phụ để cào thông tin qua mbasic (nhẹ, nhanh và không ảnh hưởng tab chính)
    const scrapePage = await browser.newPage();
    try {
      console.log("[FB Scraper] Đang truy cập mbasic.facebook.com/me để lấy profile info...");
      // Timeout cào chỉ tối đa 12s để tránh treo request lâu
      await scrapePage.goto("https://mbasic.facebook.com/me", { 
        waitUntil: "domcontentloaded", 
        timeout: 12000 
      });

      const info = await scrapePage.evaluate(() => {
        const title = document.title || "";
        let name = title.replace(/\s*\|.*$/, "").trim();

        // Tìm tên hiển thị trên mobile
        const nameHeader = document.querySelector("strong.cx, h1, title");
        if (nameHeader && nameHeader.textContent) {
          name = nameHeader.textContent.trim();
        }

        // Tìm ảnh đại diện
        let avatar = "";
        const imgEl = document.querySelector("img.profpic, img[src*='fbcdn']");
        if (imgEl) {
          avatar = imgEl.getAttribute("src") || "";
        }

        return { name, avatar };
      });

      console.log(`[FB Scraper] Đã lấy thông tin: Name="${info.name}", AvatarURL="${info.avatar}"`);

      return {
        fbUid,
        fbName: info.name || "Facebook User",
        fbAvatar: info.avatar || "",
        fbUrl: `https://www.facebook.com/${fbUid}`,
        isLoggedIn: true
      };
    } finally {
      // Luôn đóng tab phụ cào thông tin
      await scrapePage.close().catch(() => {});
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[FB Scraper] Lỗi khi cào thông tin Facebook từ port ${debugPort}:`, msg);
    return null;
  } finally {
    if (browser) {
      try {
        await browser.disconnect();
      } catch {
        // ignore
      }
    }
  }
}
