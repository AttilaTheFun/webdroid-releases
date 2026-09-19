// This console belongs to the emulated guest. Nothing is executed on the host.
export class AndroidGuest {
  constructor(emulator, onReady, touchBinary=null) {
    this.emulator=emulator;this.ready=false;this.booted=false;this.output='';this.directTouch=false;
    emulator.add_listener('serial0-output-byte',byte=>{
      this.output=(this.output+String.fromCharCode(byte)).slice(-8192);
      if(!this.booted && /[\r\n]WEBDROID_BOOT=1[\r\n]/.test(this.output)){
        this.booted=true;clearInterval(this.poll);
        if(touchBinary)this.installTouch(touchBinary).finally(()=>{this.ready=true;onReady();});
        else{this.ready=true;onReady();}
      }
    });
    this.poll=setInterval(()=>{
      if(emulator.is_running())this.command('echo WEBDROID_BOOT=$(getprop sys.boot_completed)');
    },5000);
  }
  async installTouch(binary){
    const base64=btoa(String.fromCharCode(...binary));
    this.command('mkdir -p /data/local/tmp; rm -f /data/local/tmp/webdroid-events; busybox mkfifo /data/local/tmp/webdroid-events; : > /data/local/tmp/touch.b64');
    for(let i=0;i<base64.length;i+=384){
      this.command("echo '"+base64.slice(i,i+384)+"' >> /data/local/tmp/touch.b64");
      await new Promise(r=>setTimeout(r,50));
    }
    this.command('busybox base64 -d /data/local/tmp/touch.b64 > /data/local/tmp/webdroid-touch; chmod 755 /data/local/tmp/webdroid-touch; /data/local/tmp/webdroid-touch &');
    for(let i=0;i<100;i++){
      await new Promise(r=>setTimeout(r,100));
      if(/[\r\n]WEBDROID_INPUT=1[\r\n]/.test(this.output)){this.directTouch=true;break;}
      if(/[\r\n]WEBDROID_INPUT=0[\r\n]/.test(this.output))break;
    }
    // These guest animations add work to the software renderer on every transition.
    this.command('settings put global window_animation_scale 0; settings put global transition_animation_scale 0; settings put global animator_duration_scale 0');
  }
  pointer(kind,x,y){
    if(!this.ready||!this.directTouch||!['D','M','U'].includes(kind))return;
    const px=Math.max(0,Math.min(479,Math.round(x))),py=Math.max(0,Math.min(959,Math.round(y)));
    this.command(`printf '${kind} ${px} ${py}\\n' > /data/local/tmp/webdroid-events`);
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
