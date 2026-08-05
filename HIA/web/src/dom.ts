export function byId<T extends HTMLElement>(id:string):T{const element=document.getElementById(id);if(!element)throw new Error(`Missing required element #${id}`);return element as T;}
export function all<T extends Element>(selector:string,root:ParentNode=document):T[]{return Array.from(root.querySelectorAll<T>(selector));}
export function inputValue(id:string):string{return byId<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(id).value;}
export function setInputValue(id:string,value:string):void{byId<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(id).value=value;}
export function setText(id:string,value:string):void{byId<HTMLElement>(id).textContent=value;}
