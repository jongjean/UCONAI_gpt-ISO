#!/bin/bash
set -e
cd /home/ucon/UCONAI_gpt-ISO/frontend
git pull origin main
npm install
npm run build
mkdir -p /var/www/html/iso/
rm -rf /var/www/html/iso/*
cp -r dist/* /var/www/html/iso/
echo "배포 완료"
