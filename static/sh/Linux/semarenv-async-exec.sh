#!/bin/bash

#ENV#

cd "#CWD#"
nohup "#BIN#" #ARGS# > "#OUTLOG#" 2>"#ERRLOG#" &
echo "##SemarEnv-Process-ID$!SemarEnv-Process-ID##"
