// Core Node.js polyfills
import { Buffer } from 'buffer';
import process from 'process/browser';

// Browser polyfills
import 'url-polyfill';

// Additional Node.js polyfills
if (typeof window !== 'undefined') {
    window.Buffer = window.Buffer || Buffer;
    window.process = window.process || process;

    // Polyfill other Node.js globals that might be needed
    window.global = window;
    window.global.Buffer = window.Buffer;
    window.global.process = window.process;
}

// Import other necessary polyfills
import 'stream-browserify';
import 'util/';
import 'path-browserify';
import 'os-browserify/browser';
import 'crypto-browserify'; 