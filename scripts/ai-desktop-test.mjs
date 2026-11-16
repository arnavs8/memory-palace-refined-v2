import {_electron as electron} from 'playwright';
import {mkdtemp,readFile,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const profile=await mkdtemp(path.join(os.tmpdir(),'palace-ai-contract-'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const desktop=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[path.resolve('.'),`--user-data-dir=${profile}`],env,timeout:60000});
try{
 await desktop.evaluate(()=>{
   const real=global.fetch;global.__aiCalls=0;
   global.fetch=async(url,options)=>{
    if(String(url)==='https://openrouter.ai/api/v1/models')return new Response(JSON.stringify({data:[{id:'openrouter/free',name:'Free Models Router',context_length:200000,pricing:{prompt:'0',completion:'0',request:'0'}}]}));
    if(String(url)==='https://openrouter.ai/api/v1/key')return new Response(JSON.stringify({data:{free_model_daily_requests:{remaining:48}}}));
    if(String(url)==='https://openrouter.ai/api/v1/chat/completions'){
     global.__aiCalls++;const req=JSON.parse(options.body);if(req.model!=='openrouter/free'||req.provider.max_price.prompt!==0)throw Error('Free-only protection missing');
     const prompt=req.messages[1].content;const result=prompt.includes('SOURCE EXCERPTS:')?{cards:[{title:'Photosynthesis',body:'Photosynthesis converts light energy into chemical energy.',question:'What energy conversion occurs during photosynthesis?',rationale:'A central biological energy transformation.',topic:'Plant metabolism',importance:'core',category:'energy',mnemonic:'Picture the lantern turning sunlight into sugar.',pageIndex:0,evidence:'Photosynthesis converts light energy into chemical energy.'}]}:{selectedIds:[JSON.parse(prompt.slice(prompt.indexOf('[{')))[0].id],coverage:'Core energy conversion; publisher metadata excluded.'};
     return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(result)},finish_reason:'stop'}]}));
    }return real(url,options);
   };
 });
 const page=await desktop.firstWindow();await page.locator('#nav-ai').waitFor();
 await page.locator('#nav-ai').click();await page.locator('#api-key').fill('sk-or-test-not-a-real-key-123456789');await page.locator('#save-ai').click();await page.getByText('Key verified and encrypted on this device.',{exact:false}).waitFor();
 const config=await readFile(path.join(profile,'ai-settings.json'),'utf8');if(config.includes('sk-or-test'))throw Error('Key stored as plaintext');
 await mkdir('verification',{recursive:true});await page.screenshot({path:'verification/ai-setup.png'});
 await page.locator('#modal-close').click();await page.locator('#new-palace').click();await page.locator('#palace-name').fill('AI verification');
 await page.locator('#pasted').fill('Photosynthesis converts light energy into chemical energy. Chlorophyll absorbs light in the chloroplast. Published by Example Press, 2025.');
 await page.locator('#objective').fill('Explain biological energy conversion.');await page.locator('#target-count').fill('4');await page.locator('#ai-consent').check();await page.locator('#extract').click();await page.locator('.concept-details').waitFor();
 if(await page.locator('.review-row').count()!==1)throw Error('Expected one curated concept');await page.screenshot({path:'verification/ai-review.png'});
 await page.locator('#choose-env').click();await page.locator('#build').click();await page.locator('#world-loading').waitFor({state:'detached',timeout:180000});
 await page.locator('[data-stop="0"]').click();await page.locator('#mark-seen').click();await page.locator('#test-mode').click();await page.locator('#interact-button').waitFor();await page.keyboard.press('e');await page.locator('.score').waitFor();if(!(await page.locator('.score').textContent()).includes('100'))throw Error('Physical recall placement scored incorrectly');
 await page.locator('#leave').click();await page.reload();await page.locator('.palace-card').waitFor();
 await page.locator('#nav-ai').click();await page.locator('#remove-ai').click();await page.getByText('Saved key removed from this device.').waitFor();
 console.log(JSON.stringify({contract:'PASS',inference:'mocked (no user API key supplied)',requests:await desktop.evaluate(()=>global.__aiCalls),encryptedKey:true,physicalRecall:'100%',keyRemoval:true}));
}finally{await desktop.close();}
