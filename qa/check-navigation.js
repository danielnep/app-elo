const {chromium}=require('/opt/horizon-romaneio-gptoss/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/opt/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://elo.hzsys.tech/',{waitUntil:'networkidle',timeout:20000});
 await page.waitForTimeout(1000);
 await page.mouse.click(196,606);
 await page.waitForTimeout(1500);
 await page.screenshot({path:'/opt/app-elo/artifacts/elo-onboarding-browser.png'});
 console.log(JSON.stringify({url:page.url(),errorCount:errors.length,errors,webTitle:await page.title(),body:await page.locator('body').count()}));
 await browser.close();
})().catch(e=>{console.error(e.message);process.exitCode=1});
