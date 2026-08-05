import './style.css';
import{mountThemeManager}from'./app.js';
import{createAdaptivePlatform}from'./platform.js';
mountThemeManager(createAdaptivePlatform());
