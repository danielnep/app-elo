const {chromium}=require('/opt/horizon-romaneio-gptoss/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/opt/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push('PAGE:'+e.message));
 page.on('console',m=>{if(m.type()==='error') errors.push('CONSOLE:'+m.text().slice(0,200))});
 const r=await page.goto('https://elo.hzsys.tech/',{waitUntil:'domcontentloaded',timeout:20000});
 await page.waitForTimeout(4500);
 await page.screenshot({path:'/opt/app-elo/artifacts/elo-preview-mobile.png',fullPage:true});
 const info=await page.evaluate(()=>({
  title:document.title,
  viewport:{w:window.innerWidth,h:window.innerHeight},
  flutterGlassPane:!!document.querySelector('flt-glass-pane'),
  flutterView:document.querySelector('flutter-view')?.tagName,
  elementCount:document.querySelectorAll('*').length,
  canvasCount:document.querySelectorAll('canvas').length,
  semanticsText:document.querySelector('flt-semantics-host')?.innerText?.slice(0,300) || '',
 }));
 console.log(JSON.stringify({http:r?.status(),info,errors,shot:'/opt/app-elo/artifacts/elo-preview-mobile.png'}));
 await browser.close();
})().catch(e=>{console.error('FAIL',e.stack);process.exitCode=1});
