'use strict';
const {spawn}=require('node:child_process'),path=require('node:path');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(require('electron'),[path.resolve(__dirname,'..')],{stdio:'inherit',env,windowsHide:true});
child.on('exit',code=>{process.exitCode=code||0;});
