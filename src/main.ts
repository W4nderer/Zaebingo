import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { mountGenerator } from './ui/generator';

registerSW({ immediate: true });
mountGenerator(document.getElementById('app')!);
