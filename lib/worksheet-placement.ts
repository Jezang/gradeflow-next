export type Placement={x:number;y:number;width:number};
export function codeBox(pageWidth:number,pageHeight:number,aspect:number,p:Placement){
 if(![pageWidth,pageHeight,aspect,p.x,p.y,p.width].every(Number.isFinite)||pageWidth<=0||pageHeight<=0||aspect<=0||p.width<=0||p.width>1)throw Error('ตำแหน่งหรือขนาดไม่ถูกต้อง');
 const width=Math.min(pageWidth*p.width,pageHeight*aspect),height=width/aspect;
 const left=Math.max(0,Math.min(pageWidth-width,pageWidth*p.x)),top=Math.max(0,Math.min(pageHeight-height,pageHeight*p.y));
 return {left,top,width,height,y:pageHeight-top-height};
}
