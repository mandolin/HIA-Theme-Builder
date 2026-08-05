import{defineConfig}from'vite';
export default defineConfig({base:process.env.GITHUB_PAGES?'/HIA-Theme-Builder/':'./',build:{outDir:'dist',sourcemap:true}});
