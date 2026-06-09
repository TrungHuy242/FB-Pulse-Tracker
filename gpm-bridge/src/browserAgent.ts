import puppeteer, { Browser } from "puppeteer-core";

/**
 * Kết nối Puppeteer vào trình duyệt Chrome đang chạy qua debug port
 * @param debugPort - Cổng debug remote của trình duyệt Chrome GPM
 */
export async function connectToGpmChrome(debugPort: number): Promise<Browser> {
  console.log(`[Browser Agent] Đang kết nối Puppeteer vào localhost:${debugPort}...`);
  try {
    const browser = await puppeteer.connect({
      browserURL: `http://localhost:${debugPort}`,
      defaultViewport: null // Giữ nguyên kích thước cửa sổ của GPM thay vì ép viewport
    });
    console.log(`[Browser Agent] Kết nối Puppeteer thành công!`);
    return browser;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Browser Agent] Kết nối Puppeteer thất bại:`, message);
    throw err;
  }
}
