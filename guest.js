// This console belongs to the emulated guest. Nothing is executed on the host.
export class AndroidGuest {
  constructor(emulator, onReady) {
    this.emulator=emulator;this.ready=false;this.output='';
    emulator.add_listener('serial0-output-byte',byte=>{
      this.output=(this.output+String.fromCharCode(byte)).slice(-8192);
      if(!this.ready && /[\r\n]WEBDROID_BOOT=1[\r\n]/.test(this.output)){
        this.ready=true;clearInterval(this.poll);onReady();
      }
    });
    this.poll=setInterval(()=>{
      if(emulator.is_running())this.command('echo WEBDROID_BOOT=$(getprop sys.boot_completed)');
    },5000);
  }
  command(command){this.emulator.serial0_send(command+'\n');}
  tap(x,y){if(this.ready)this.command(`input tap ${Math.round(x)} ${Math.round(y)}`);}
  swipe(x,y,ex,ey,duration){if(this.ready)this.command(`input swipe ${Math.round(x)} ${Math.round(y)} ${Math.round(ex)} ${Math.round(ey)} ${Math.round(Math.max(100,Math.min(2000,duration)))}`);}
  key(code){if(this.ready)this.command(`input keyevent ${Number(code)|0}`);}
  text(value){
    // Android 4's input text utility accepts spaces as %s. Quote all shell metacharacters.
    const escaped=value.replace(/ /g,'%s').replace(/'/g,"'\\''");
    if(this.ready)this.command("input text '"+escaped+"'");
  }
}
