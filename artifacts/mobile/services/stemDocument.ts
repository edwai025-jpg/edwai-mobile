import { katexCss } from "../generated-artifacts/stem-assets.json";

// Only this trusted script can run. Answer HTML is produced by the local, non-raw Markdown pipeline.
export function stemDocument(id: string, payload: { html: string; css: string; revision: number }): string {
  const initial = JSON.stringify({ ...payload, id }).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src data:; style-src 'unsafe-inline'; script-src 'nonce-stem-bridge'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'">
  <style>${katexCss}</style><style id="answer-style"></style></head><body><div id="answer"></div>
  <script nonce="stem-bridge">
  (function(){
    var id=${JSON.stringify(id)}, revision=0, answer=document.getElementById('answer');
    function measure(){
      var height=Math.max(24,Math.ceil(answer.getBoundingClientRect().height));
      var message={type:'eduwai-answer-size',id:id,revision:revision,height:height};
      if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(message));
      else window.parent.postMessage(message,'*');
    }
    window.renderAnswer=function(value){
      if(!value||value.id!==id)return;
      revision=value.revision;
      document.getElementById('answer-style').textContent=value.css;
      answer.innerHTML=value.html;
      requestAnimationFrame(measure);
      if(document.fonts)document.fonts.ready.then(measure);
    };
    window.addEventListener('message',function(event){
      if(event.source===window.parent&&event.data&&event.data.type==='eduwai-answer-update')window.renderAnswer(event.data.payload);
    });
    if(window.ResizeObserver)new ResizeObserver(measure).observe(answer);
    window.addEventListener('resize',measure);
    window.renderAnswer(${initial});
  })();
  </script></body></html>`;
}
