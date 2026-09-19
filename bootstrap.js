// Bind the button before fetching the emulator module. Startup failures must
// remain visible even when that module cannot load or evaluate.
(() => {
  const $ = id => document.getElementById(id);
  const diagnostic = {version:'0.1.3',state:'idle',renderer:'webgpu',errors:[],userAgent:navigator.userAgent};
  let busy = false;
  const status = message => {
    diagnostic.status = message;
    $('status').textContent = message;
    $('startup-message').textContent = message;
    if(busy && diagnostic.state !== 'error') $('start').textContent = message;
  };
  const fail = error => {
    if(diagnostic.state === 'error') return;
    diagnostic.state = 'error';
    diagnostic.errors.push(String(error?.stack || error));
    status(error?.message || String(error));
    $('cover').hidden = false;
    $('cover-title').textContent = 'Android could not start';
    $('startup-message').setAttribute('role','alert');
    $('start').disabled = false;
    $('start').textContent = 'Reload and retry';
    $('start').onclick = () => location.reload();
    $('diagnostics').textContent = JSON.stringify(diagnostic,null,2);
    window.webdroid.emulator?.stop();
  };
  const deadline = async (promise, milliseconds, message) => {
    let timer;
    try { return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),milliseconds);})]); }
    finally { clearTimeout(timer); }
  };
  window.webdroid = {diagnostic,status,fail,deadline};
  addEventListener('error',e=>fail(e.error || e.message));
  addEventListener('unhandledrejection',e=>fail(e.reason));
  $('start').disabled = false;
  $('start').textContent = 'Start Android ↗';
  $('start').onclick = async () => {
    if(busy) return;
    busy = true;
    diagnostic.state = 'preparing';
    $('start').disabled = true;
    $('cover-title').textContent = 'Starting Android';
    status('Loading emulator…');
    try {
      const app = await deadline(import('./app.js?v=0.1.3'),30000,'The emulator could not download. Check your connection and retry.');
      await app.start();
    } catch(error) { fail(error); }
  };
  if(new URLSearchParams(location.search).has('autostart')) $('start').click();
})();
