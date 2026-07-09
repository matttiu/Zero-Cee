import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle0' });
  
  // Scroll to footer
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  
  // Get footer element bounds
  const footer = await page.$('footer');
  const box = await footer.boundingBox();
  
  // Take screenshot of the entire footer
  await page.screenshot({ path: 'footer.png', clip: { x: 0, y: box.y, width: box.width, height: box.height } });
  
  console.log('Screenshot saved to footer.png');
  await browser.close();
})();
