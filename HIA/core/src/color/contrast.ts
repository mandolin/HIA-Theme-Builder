import{hexToRgb,srgbToLinear}from'./convert.js';
export function luminance(hex:string):number{const[r,g,b]=hexToRgb(hex).map(srgbToLinear)as[number,number,number];return.2126*r+.7152*g+.0722*b;}
export function contrast(a:string,b:string):number{const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(values[0]!+.05)/(values[1]!+.05);}
export function bestOnColor(hex:string):{hex:string;label:string;ratio:number}{const white=contrast(hex,'#FFFFFF'),dark=contrast(hex,'#0F172A');return white>=dark?{hex:'#FFFFFF',label:'白色文字',ratio:white}:{hex:'#0F172A',label:'深色文字',ratio:dark};}
