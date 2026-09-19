import { V86, AsyncXHRPartfileBuffer } from './v86.mjs?v=0.1.3';
import { configureBootDisk } from './boot-disk.js?v=0.1.3';
import { GPUScreen } from './gpu-screen.js?v=0.1.3';
import { AndroidGuest } from './guest.js?v=0.1.3';
const $=id=>document.getElementById(id);
const {diagnostic,status,fail,deadline}=window.webdroid;
let emulator,screen,guest,startedAt,resourceTimer;
export async function start(){
  $('start').disabled=true;status('Preparing WebGPU…');
  try{
    screen=await deadline(GPUScreen.create($('screen'),$('boot')),20000,'Safari did not finish preparing WebGPU. Close other emulator tabs, then reload.');
    screen.device.addEventListener('uncapturederror',e=>fail(e.error));
    screen.device.lost.then(info=>{if(info.reason!=='destroyed')fail(Error('GPU connection lost. Reload to restart Android.'));});
    status('Checking Android image…');
    const abort=new AbortController();
    try{
      await deadline((async()=>{
        const diskCheck=await fetch('https://i.copy.sh/android_x86_nonsse3_4.4r1_20140904/0-1048576.iso',{referrerPolicy:'no-referrer',signal:abort.signal});
        if(!diskCheck.ok)throw Error(`Android image host returned HTTP ${diskCheck.status}. Please try again later.`);
        if((await diskCheck.arrayBuffer()).byteLength!==1048576)throw Error('Android image download was incomplete. Please try again.');
      })(),30000,'The Android image download stalled. Check your connection and retry.');
    }finally{abort.abort();}
    if(diagnostic.state==='error')return;
    const touchBinary=await deadline(fetch('./touch.bin').then(r=>{if(!r.ok)throw Error('Touch driver download failed');return r.arrayBuffer();}).then(b=>new Uint8Array(b)),30000,'Touch driver download stalled. Reload and retry.');
    diagnostic.state='booting';startedAt=performance.now();
    status('Loading emulator files…');
    emulator=new V86({wasm_path:'v86.wasm',memory_size:512*1024*1024,vga_memory_size:8*1024*1024,
      bios:{url:'bios/seabios.bin'},vga_bios:{url:'bios/vgabios.bin?v=0.1.3'},
      cdrom:configureBootDisk(new AsyncXHRPartfileBuffer('https://i.copy.sh/android_x86_nonsse3_4.4r1_20140904/.iso',247463936,1048576)),
      screen_adapter:screen,disable_mouse:true,disable_keyboard:false,disable_speaker:true,autostart:true,acpi:false,
    });
    window.webdroid.emulator=emulator;window.webdroid.screen=screen;
    resourceTimer=setTimeout(()=>fail(Error('The emulator files did not finish loading. Reload and retry.')),60000);
    emulator.add_listener('download-error',()=>fail(Error('An emulator file failed to download. Reload and retry.')));
    emulator.add_listener('download-progress',progress=>{
      if(diagnostic.state==='error'||$('cover').hidden)return;
      const percent=progress.total?Math.round(progress.loaded/progress.total*100):null;
      status('Loading emulator files…'+(percent===null?'':` ${percent}%`));
    });
    guest=new AndroidGuest(emulator,()=>{
      if(diagnostic.state==='error')return;
      diagnostic.state='ready';status('Android is ready');
      for(const id of ['back','home','keyboard','pause'])$(id).disabled=false;
    },touchBinary);
    window.webdroid.guest=guest;
    screen.fill=()=>emulator.v86?.cpu?.devices?.vga?.screen_fill_buffer();
    emulator.add_listener('emulator-ready',()=>{
      clearTimeout(resourceTimer);
      if(diagnostic.state==='error'){emulator.stop();return;}
      $('cover').hidden=true;status('Booting Android…');
    });
    setInterval(()=>{
      if(diagnostic.state==='error')return;
      const cpu=emulator.v86?.cpu;
      diagnostic.frames=screen.frames;diagnostic.graphical=screen.graphical;diagnostic.resolution=[screen.width,screen.height];
      diagnostic.elapsedSeconds=Math.round((performance.now()-startedAt)/1000);
      diagnostic.instructions=cpu?.instruction_counter?.[0];
      diagnostic.bootText=screen.get_text_screen().join('\n');
      diagnostic.console=guest.output.slice(-1500);
      diagnostic.input=guest.directTouch?'virtual touchscreen':'Android input command';
      if(screen.graphical&&screen.width===480&&screen.height===960&&screen.frames>5&&diagnostic.state==='booting'){diagnostic.state='display-active';status('Android is starting…');}
      $('metrics').textContent=`${diagnostic.elapsedSeconds}s · ${screen.frames} frames · WebGPU`;
      $('diagnostics').textContent=JSON.stringify(diagnostic,null,2);
    },1000);
  }catch(e){clearTimeout(resourceTimer);fail(e);}
}
const key=c=>emulator?.keyboard_send_scancodes(c);
$('back').onclick=()=>guest?.key(4);
$('home').onclick=()=>guest?.key(3);
$('keyboard').onclick=()=>{$('typing').hidden=!$('typing').hidden;if(!$('typing').hidden)$('text').focus();};
$('send').onclick=()=>{guest?.text($('text').value);$('text').value='';};
$('enter').onclick=()=>guest?.key(66);$('delete').onclick=()=>guest?.key(67);
$('text').onkeydown=e=>{if(e.key==='Enter'){$('send').click();$('enter').click();}};
$('pause').onclick=async()=>{if(emulator.is_running()){await emulator.stop();$('pause').textContent='Resume';status('Paused');}else{emulator.run();$('pause').textContent='Pause';status('Android display active');}};
$('fullscreen').onclick=()=>{const m=document.querySelector('.machine');if(m.requestFullscreen)m.requestFullscreen().catch(fail);else{m.scrollIntoView();status('Rotate your phone for a larger display');}};
let pointer=null;
function position(e){const r=$('screen').getBoundingClientRect();const scale=Math.min(r.width/screen.width,r.height/screen.height);const w=scale*screen.width,h=scale*screen.height;return[Math.max(0,Math.min(screen.width,(e.clientX-r.left-(r.width-w)/2)/scale)),Math.max(0,Math.min(screen.height,(e.clientY-r.top-(r.height-h)/2)/scale))];}
$('screen').onpointerdown=e=>{if(!guest?.ready||pointer)return;e.preventDefault();$('screen').setPointerCapture(e.pointerId);const[x,y]=position(e);pointer={x,y,time:performance.now(),lastMove:0,id:e.pointerId};guest.pointer('D',x,y);};
$('screen').onpointermove=e=>{if(!pointer||e.pointerId!==pointer.id||!guest.directTouch)return;const now=performance.now();if(now-pointer.lastMove<33)return;pointer.lastMove=now;const[x,y]=position(e);guest.pointer('M',x,y);};
$('screen').onpointerup=e=>{
  if(!pointer||e.pointerId!==pointer.id)return;
  const[x,y]=position(e),p=pointer;pointer=null;
  if(guest.directTouch){guest.pointer('U',x,y);return;}
  const elapsed=performance.now()-p.time;
  if(Math.hypot(x-p.x,y-p.y)>6||elapsed>500)guest.swipe(p.x,p.y,x,y,elapsed);else guest.tap(x,y);
};
$('screen').onpointercancel=()=>{if(pointer)guest.pointer('U',pointer.x,pointer.y);pointer=null;};
