// Android's software-rendered RGBA framebuffer is uploaded directly to WebGPU.
// No Canvas2D or WebGL path is used for graphical frames.
export function clipLayer(l,width,height) {
  let dx=l.screen_x,dy=l.screen_y,sx=l.buffer_x,sy=l.buffer_y,w=l.buffer_width,h=l.buffer_height;
  // VGA scrolling can expose a layer with a negative destination origin.
  // Canvas2D clips it implicitly; WebGPU requires a valid unsigned rectangle.
  if(dx<0){sx-=dx;w+=dx;dx=0;}if(dy<0){sy-=dy;h+=dy;dy=0;}
  if(sx<0){dx-=sx;w+=sx;sx=0;}if(sy<0){dy-=sy;h+=sy;sy=0;}
  w=Math.min(w,width-dx,l.image_data.width-sx);h=Math.min(h,height-dy,l.image_data.height-sy);
  return w>0&&h>0?{dx,dy,sx,sy,w,h}:null;
}
export class GPUScreen {
  constructor(canvas, boot, device, context, format) {
    Object.assign(this, {canvas, boot, device, context, format});
    this.FLAG_BLINKING = 1; this.FLAG_FONT_PAGE_B = 2;
    this.cols = 80; this.rows = 25; this.text = Array(2000).fill(' ');
    this.frames = 0; this.graphical = false; this.paused = false;
    const shader = device.createShaderModule({code: `
      @group(0) @binding(0) var picture: texture_2d<f32>;
      struct Out { @builtin(position) position: vec4f, @location(0) uv: vec2f }
      @vertex fn vertex(@builtin(vertex_index) i: u32) -> Out {
        var p = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
        var o: Out; o.position=vec4f(p[i],0,1); o.uv=vec2f((p[i].x+1)*0.5,(1-p[i].y)*0.5); return o;
      }
      @fragment fn fragment(o: Out) -> @location(0) vec4f {
        let size=textureDimensions(picture);
        let xy=clamp(vec2i(o.uv*vec2f(size)),vec2i(0),vec2i(size)-1);
        return vec4f(textureLoad(picture,xy,0).rgb,1);
      }`});
    this.pipeline = device.createRenderPipeline({layout:'auto',vertex:{module:shader,entryPoint:'vertex'},fragment:{module:shader,entryPoint:'fragment',targets:[{format}]},primitive:{topology:'triangle-list'}});
    this.set_size_graphical(800,600);
    this.tick = () => {
      if (!this.paused) {
        this.fill?.();
        if (this.textDirty && !this.graphical) { this.boot.textContent = this.get_text_screen().join('\n'); this.textDirty = false; }
      }
      this.raf = requestAnimationFrame(this.tick);
    };
    this.raf = requestAnimationFrame(this.tick);
  }
  static async create(canvas, boot) {
    if (!navigator.gpu) throw Error('WebGPU is unavailable. Use Safari 26+ or a browser with WebGPU enabled.');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw Error('This browser could not create a WebGPU adapter.');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({device,format,alphaMode:'opaque'});
    return new GPUScreen(canvas,boot,device,context,format);
  }
  set_mode(graphical) { this.graphical=graphical; this.boot.hidden=graphical; }
  set_size_graphical(w,h) {
    if (w===this.width && h===this.height) return;
    this.width=w; this.height=h; this.canvas.width=w; this.canvas.height=h;
    this.canvas.parentElement.style.aspectRatio=`${w}/${h}`;
    this.texture?.destroy();
    this.texture=this.device.createTexture({size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
    this.bind=this.device.createBindGroup({layout:this.pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:this.texture.createView()}]});
  }
  update_buffer(layers) {
    for (const l of layers) {
      const r=clipLayer(l,this.width,this.height);if(!r)continue;
      this.device.queue.writeTexture({texture:this.texture,origin:[r.dx,r.dy]}, l.image_data.data,
        {offset:(r.sy*l.image_data.width+r.sx)*4,bytesPerRow:l.image_data.width*4}, [r.w,r.h]);
    }
    if (!layers.length) return;
    const encoder=this.device.createCommandEncoder();
    const pass=encoder.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}]});
    pass.setPipeline(this.pipeline);pass.setBindGroup(0,this.bind);pass.draw(3);pass.end();
    this.device.queue.submit([encoder.finish()]); this.frames++;
  }
  set_size_text(cols,rows) {this.cols=cols;this.rows=rows;this.text=Array(cols*rows).fill(' ');this.textDirty=true;}
  put_char(row,col,chr) {this.text[row*this.cols+col]=chr>=32&&chr<127?String.fromCharCode(chr):' ';this.textDirty=true;}
  get_text_row(row) {return this.text.slice(row*this.cols,(row+1)*this.cols).join('');}
  get_text_screen() {return Array.from({length:this.rows},(_,r)=>this.get_text_row(r));}
  pause(){this.paused=true;} continue(){this.paused=false;}
  destroy(){cancelAnimationFrame(this.raf);this.texture?.destroy();this.device.destroy();}
  clear_text_state(){this.text.fill(' ');this.textDirty=true;}
  clear_screen(){} set_font_bitmap(){} set_font_page(){} update_cursor_scanline(){} update_cursor(){} set_scale(){}
}
