import { isReceiptImage } from '../domain/expenses';
const allowed = new Set(['image/jpeg','image/png','image/webp']);
/** Re-encode locally to remove metadata and bound the resulting snapshot/backup size. */
export async function prepareReceiptImage(file:File):Promise<string> {
 if(!allowed.has(file.type))throw new Error('請選擇 JPEG、PNG 或 WebP 圖片。');
 if(file.size===0 || file.size>15*1024*1024)throw new Error('原始圖片需小於或等於 15 MB。');
 const objectUrl=URL.createObjectURL(file);
 try {
  const image=new Image();image.src=objectUrl;
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('無法讀取圖片，請確認檔案沒有損壞。'));});
  if(!image.naturalWidth || !image.naturalHeight || image.naturalWidth*image.naturalHeight>40_000_000)throw new Error('圖片尺寸過大，請先縮小圖片。');
  const ratio=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
  let width=Math.max(1,Math.round(image.naturalWidth*ratio)),height=Math.max(1,Math.round(image.naturalHeight*ratio));
  for(let attempt=0;attempt<4;attempt++){
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const context=canvas.getContext('2d');if(!context)throw new Error('無法處理圖片，請使用其他瀏覽器。');
   context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(image,0,0,width,height);
   for(const quality of [0.85,0.72,0.58]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=650_000 && isReceiptImage(data))return data;}
   width=Math.max(1,Math.round(width*0.75));height=Math.max(1,Math.round(height*0.75));
  }
  throw new Error('圖片壓縮後仍過大，請改用較小的圖片。');
 } finally {URL.revokeObjectURL(objectUrl);}
}
