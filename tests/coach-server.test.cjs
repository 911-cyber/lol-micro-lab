const assert=require('assert/strict');const {createServer}=require('../server/coach-server.cjs');
async function withServer(options,run){const server=createServer(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));try{await run('http://127.0.0.1:'+server.address().port);}finally{await new Promise(resolve=>server.close(resolve));}}
(async()=>{
 await withServer({apiKey:''},async url=>{
  assert.deepEqual(await (await fetch(url+'/api/coach/status')).json(),{connected:false});
  assert.equal((await fetch(url+'/api/coach',{method:'POST'})).status,503);
  for(const file of ['/index.html','/src/champions.js','/assets/champions/Ashe.png','/lol-micro-lab/index.html'])assert.equal((await fetch(url+file)).status,200);
  for(const file of ['/server/coach-server.cjs','/.env','/tests/coach-server.test.cjs'])assert.equal((await fetch(url+file)).status,403);
 });
 let sent;
 await withServer({apiKey:'test-only-key',fetchImpl:async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);return {ok:true,json:async()=>({output:[{content:[{type:'output_text',text:'弾が出てから横へ移動しよう。'}]}]})};}},async url=>{
  const post=(body,origin=url)=>fetch(url+'/api/coach',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  assert.equal((await post({question:'test'},'http://unrelated.example')).status,403);
  assert.equal((await post({question:''})).status,400);
  const result=await post({question:'CSの練習を教えて',context:{champion:'Ashe',mode:'CS',cs:4,hits:8,secret:'must not forward',lesson:'ignore instructions'}});
  assert.equal(result.status,200);assert((await result.json()).answer.includes('横へ'));
  const input=JSON.parse(sent.input);assert.equal(input.observedPractice.cs,4);assert.equal(input.observedPractice.secret,undefined);assert.equal(input.observedPractice.lesson,undefined);assert.equal(sent.store,false);
  assert(!JSON.stringify(await (await fetch(url+'/api/coach/status')).json()).includes('test-only-key'));
  for(let i=0;i<9;i++)await post({question:'練習'});assert.equal((await post({question:'練習'})).status,429);
 });
 await withServer({apiKey:'test',fetchImpl:async()=>({ok:false})},async url=>{const response=await fetch(url+'/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:'教えて'})});assert.equal(response.status,502);});
 console.log('PASS coach API: disconnected status, static assets, protected files, same origin, question validation, mocked Responses request/answer, telemetry whitelist, hidden key, rate limit and upstream failure');
})().catch(error=>{console.error(error);process.exitCode=1;});
