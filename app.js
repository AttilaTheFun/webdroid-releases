import { V86 } from './v86.mjs';
import { GPUScreen } from './gpu-screen.js';
const $=id=>document.getElementById(id);
const diagnostic={version:'0.1.0',state:'idle',renderer:'webgpu',errors:[],userAgent:navigator.userAgent};
window.webdroid={diagnostic};
function status(message){$('status').textContent=message;diagnostic.status=message;}
function fail(error){diagnostic.errors.push(String(error?.stack||error));status(String(error.message||error));$('diagnostics').textContent=JSON.stringify(diagnostic,null,2);}
addEventListener('error',e=>fail(e.error||e.message));
addEventListener('unhandledrejection',e=>fail(e.reason));
let emulator,screen,startedAt,bootEnter;
async function start(){
  $('start').disabled=true;status('Preparing WebGPU…');
  try{
    screen=await GPUScreen.create($('screen'),$('boot'));
    screen.device.addEventListener('uncapturederror',e=>fail(e.error));
    screen.device.lost.then(info=>{if(info.reason!=='destroyed')fail(Error('GPU connection lost. Reload to restart Android.'));});
    $('cover').hidden=true;diagnostic.state='booting';startedAt=performance.now();
    status('Booting Android…');
    emulator=new V86({wasm_path:'v86.wasm',memory_size:512*1024*1024,vga_memory_size:8*1024*1024,
      bios:{url:'bios/seabios.bin'},vga_bios:{url:'bios/vgabios.bin'},
      cdrom:{url:'https://i.copy.sh/android_x86_nonsse3_4.4r1_20140904/.iso',size:247463936,async:true,fixed_chunk_size:1048576,use_parts:true},
      screen_adapter:screen,disable_mouse:true,disable_keyboard:true,disable_speaker:true,autostart:true,acpi:false,
    });
    window.webdroid.emulator=emulator;window.webdroid.screen=screen;
    screen.fill=()=>emulator.v86?.cpu?.devices?.vga?.screen_fill_buffer();
    emulator.add_listener('emulator-ready',()=>{
      for(const id of ['back','home','keyboard','pause'])$(id).disabled=false;
      bootEnter=setInterval(()=>{
        if(screen.get_text_screen().join('\n').includes('Live CD')){emulator.keyboard_send_scancodes([0x1c,0x9c]);clearInterval(bootEnter);}
      },1000);
    });
    setInterval(()=>{
      const cpu=emulator.v86?.cpu;
      diagnostic.frames=screen.frames;diagnostic.graphical=screen.graphical;diagnostic.resolution=[screen.width,screen.height];
      diagnostic.elapsedSeconds=Math.round((performance.now()-startedAt)/1000);
      diagnostic.instructions=cpu?.instruction_counter?.[0];
      diagnostic.bootText=screen.get_text_screen().join('\n');
      if(screen.graphical&&screen.frames>5&&diagnostic.state==='booting'){diagnostic.state='running';status('Android display active');}
      $('metrics').textContent=`${diagnostic.elapsedSeconds}s · ${screen.frames} frames · WebGPU`;
      $('diagnostics').textContent=JSON.stringify(diagnostic,null,2);
    },1000);
  }catch(e){fail(e);$('start').disabled=false;}
}
$('start').onclick=start;
const key=c=>emulator?.keyboard_send_scancodes(c);
$('back').onclick=()=>key([0x01,0x81]);
$('home').onclick=()=>key([0xe0,0x5b,0xe0,0xdb]);
$('keyboard').onclick=()=>{$('typing').hidden=!$('typing').hidden;if(!$('typing').hidden)$('text').focus();};
$('send').onclick=()=>{emulator?.keyboard_send_text($('text').value);$('text').value='';};
$('enter').onclick=()=>key([0x1c,0x9c]);$('delete').onclick=()=>key([0x0e,0x8e]);
$('text').onkeydown=e=>{if(e.key==='Enter'){$('send').click();$('enter').click();}};
$('pause').onclick=async()=>{if(emulator.is_running()){await emulator.stop();$('pause').textContent='Resume';status('Paused');}else{emulator.run();$('pause').textContent='Pause';status('Android display active');}};
$('fullscreen').onclick=()=>{const m=document.querySelector('.machine');if(m.requestFullscreen)m.requestFullscreen().catch(fail);else{m.scrollIntoView();status('Rotate your phone for a larger display');}};
let pointer=null;
function position(e){const r=$('screen').getBoundingClientRect();const scale=Math.min(r.width/screen.width,r.height/screen.height);const w=scale*screen.width,h=scale*screen.height;return[Math.max(0,Math.min(screen.width,(e.clientX-r.left-(r.width-w)/2)/scale)),Math.max(0,Math.min(screen.height,(e.clientY-r.top-(r.height-h)/2)/scale))];}
function move(e){if(!emulator)return;const [x,y]=position(e);emulator.bus.send('mouse-absolute',[x,y,screen.width,screen.height]);if(pointer)emulator.bus.send('mouse-delta',[x-pointer.x,pointer.y-y]);pointer={x,y};}
$('screen').onpointerdown=e=>{if(!emulator)return;e.preventDefault();$('screen').setPointerCapture(e.pointerId);pointer=null;move(e);emulator.bus.send('mouse-click',[true,false,false]);};
$('screen').onpointermove=e=>{if(e.buttons||e.pointerType==='mouse')move(e);};
function up(e){if(!emulator)return;emulator.bus.send('mouse-click',[false,false,false]);pointer=null;}
$('screen').onpointerup=up;$('screen').onpointercancel=up;
if(new URLSearchParams(location.search).has('autostart'))start();
