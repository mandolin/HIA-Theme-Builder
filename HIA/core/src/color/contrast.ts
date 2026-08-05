import{hexToRgb,srgbToLinear}from'./convert.js';

// 计算相对亮度（WCAG 定义的线性光加权和，范围约 0..1）。
// <lang zh-CN>用于对比度计算；权重对应人眼对 RGB 的敏感度。</lang>
// <lang en>Used by contrast; weights reflect human eye sensitivity to RGB channels.</lang>
export function luminance(hex:string):number{
  const[r,g,b]=hexToRgb(hex).map(srgbToLinear)as[number,number,number];
  // 线性光按 Rec.709 系数加权，得到感知亮度。
  // <lang zh-CN>0.2126/0.7152/0.0722 为 sRGB 亮度标准权重。</lang>
  // <lang en>0.2126/0.7152/0.0722 are the standard sRGB luminance weights.</lang>
  return.2126*r+.7152*g+.0722*b;
}

// 计算两色 WCAG 对比度（亮者比暗者，含 0.05 补偿）。
// <lang zh-CN>结果越大越易读；排序后取高/低，符合 WCAG 公式。</lang>
// <lang en>Larger means more legible; sorts then divides high/low per the WCAG formula.</lang>
export function contrast(a:string,b:string):number{
  const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);
  return(values[0]!+.05)/(values[1]!+.05);
}

// 自动选取在某色上可读的前景色（白或深色），返回色值、标签与对比度。
// <lang zh-CN>比较白色与深蓝(#0F172A)的对比度，取较大者；用于角色色上的文字。</lang>
// <lang en>Compares white vs dark navy (#0F172A) contrast and picks the larger; used for text on a role color.</lang>
export function bestOnColor(hex:string):{hex:string;label:string;ratio:number}{
  const white=contrast(hex,'#FFFFFF'),
    dark=contrast(hex,'#0F172A');
  // 白色对比更高则用白字，否则用深色字，并记录对应比例。
  // <lang zh-CN>ratio 供 UI 展示可达性指标。</lang>
  // <lang en>ratio is exposed so the UI can show accessibility metrics.</lang>
  return white>=dark?{hex:'#FFFFFF',label:'白色文字',ratio:white}:{hex:'#0F172A',label:'深色文字',ratio:dark};
}
