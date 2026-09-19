// ISOLINUX configuration in the pinned Android-x86 ISO. Apply an in-memory
// overlay so boot arguments do not depend on simulated keyboard timing.
export const bootConfigOffset=246784000;
export const bootConfigSize=1138;
const config=new TextEncoder().encode(`default webdroid
prompt 0
timeout 1
label webdroid
kernel /kernel
append initrd=/initrd.img root=/dev/ram0 androidboot.hardware=android_x86 video=-16 quiet SRC= DATA= UVESA_MODE=480x960 DPI=160 console=ttyS0 androidboot.console=ttyS0
`.padEnd(bootConfigSize,'\n'));
export function patchBootRead(offset,data){
  const start=Math.max(offset,bootConfigOffset),end=Math.min(offset+data.length,bootConfigOffset+bootConfigSize);
  if(start>=end)return data;
  const copy=data.slice();
  copy.set(config.subarray(start-bootConfigOffset,end-bootConfigOffset),start-offset);
  return copy;
}
export function configureBootDisk(disk){
  const get=disk.get.bind(disk);
  disk.get=(offset,length,done,options)=>get(offset,length,data=>done(patchBootRead(offset,data)),options);
  return disk;
}
