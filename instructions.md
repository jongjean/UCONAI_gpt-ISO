이 문서는 프로젝트 가이드라인 및 지침이다. instructions.md

## 프로젝트의 목적과 구조
자체 리눅스 서버시스템을 개발하는 목적은
1. 10가지 이상의 프로젝트를 하나의 자체서버 리눅스 도커 시스템으로 통합관리
2. 총괄 프로젝트명은 UCONAI이며 (root/home/ucon/UCNOAI)폴더가 랜딩 페이지
3. UCONAI총괄 관리 아래 iso, gonggu, rentool, ucon, iuci, esg, legal 등이 각 프로젝트로 계속 개발된다.
4. 프로젝트 개발폴더는 root/home/ucon/ 디렉토리 아래에 동등한 레벨의 각각의 프로젝트 명으로 개별 디렉토리를 만들어 위치한다.
5. 백엔드는 전체 프로젝트를 통합운영하기 위해 통합프로젝트관리 프로젝트인root/home/ucon/UCNOAI에 위치해서 전체 백엔드 지원을 한다.
6. 배포용 웹디렉토리는 root/var/www/ 아래에 /gonggu, /iso, /ucon, /esg, /legal 등의 폴더명으로 구분되어 있고 /landding 폴더가 UCONAI 프로젝트의 배포폴더이다.
7. Docker는 root/run/ 아래에 위치한다.


## 2025-11-30 (폴더 구조 및 백엔드 서버 현황)

- UCONAI/ (상위 관제/공통 백엔드 위치)
   - backend/ (공통 백엔드, Node.js, 포트 4400)
   - UCONAI_gpt-ISO/ (프론트엔드만 존재, 상위 backend를 사용)
   - [다른 프로젝트들]/ (각각 프론트엔드만 존재, 상위 backend를 사용)


## 포트 배정 정책

리눅스 서버 (172.30.1.150)
외부 포트	내부 IP	내부 포트	프로토콜	용도
80	172.30.1.150	80	TCP	HTTP (Caddy)
443	172.30.1.150	443	TCP	HTTPS (Caddy)
22220	172.30.1.150	22	TCP	SSH/SFTP
9020	172.30.1.150	80	TCP	WebDAV HTTP (필요시)
9443	172.30.1.150	443	TCP	WebDAV HTTPS (필요시)
21210	172.30.1.150	21	TCP	FTP (옵션)



## 매우 중요한 원칙 <준수의무사항>
1. 자체 리눅스 서버를 구축하는 핵심 목적이 모든 데이터를 자체서버와 나스 백업으로 영구보존하는데 있다. 따라서 모든 프로젝트 앱에서 발생하는 입력 텍스트, 업로드 파일 등 사용자가 입력하는 <!!!모든 데이터를 빠짐없이 서버와 백업나스에 영구저장하도록 코딩과 프로그래밍 하는것!!!>이 필수 의무이다.
2. 통합 프로젝트 진행을 위한 마일스톤 관리를 철저히 해서 작업의 순서와 프레임이 변질 되지 않도록 상시 관리한다. 마일스톤 1단원이 끝날 때 마다 마일스톤 도표를 보여줘서 완료 진행중 예정 표시를 업데이트 한다.
3. 



# 기타 작업 및 운영 지침

- 백엔드 서버는 /home/ucon/UCONAI/backend에서 npm run dev로 구동하며, 포트 4400에서 서비스됨.

- 모든 프론트엔드 프로젝트는 http://localhost:4400을 통해 공통 백엔드 API를 사용함.

예시:
cd /home/ucon/UCONAI/backend
npm install # 최초 1회
npm run dev # 또는 npm run start

백엔드 서버 로그:
UCONAI_gpt-ISO backend listening on port 4400

이 구조와 포트 기준으로 프론트엔드-백엔드 연동, 배포, 환경설정 등을 진행한다.


빌드시 체크포인트 : 항상 빌드 전에는 아래 원칙을 반드시 지킨다.

1. cd frontend && cp [백업대상파일] src/[백업대상파일].날짜_시간.bak && npm run build
   형식으로, 한 번에 실행한다.

2. 백업 대상 파일은 다음을 모두 포함해야 한다.
   - (1) 수정·변경된 모든 파일 (예: App.tsx, GuidePanel.tsx 등)
   - (2) 새로 생성된 모든 파일 (예: Sidebar.tsx, MainChat.tsx 등)
   - (3) 위 파일들은 반드시 백업 리스트에 포함되어야 하며, 하나라도 누락되면 안 된다.
   - (4) 새로 생성된 파일은 최초 버전을 별도로 백업해둔다.

3. 백업 파일명은 src/파일명.날짜_시간.bak (예: src/App.tsx.20251124_01.bak) 형식으로 한다.

4. 빌드 전 반드시 위 백업을 선행한다.

5. 백업 - 빌드 - 배포 일괄처리
예시: cd ../home/ucon/UCONAI_gpt-ISO/frontend && cp App.tsx src/App.tsx.날짜_시간.bak && cp components/Sidebar.tsx src/components/Sidebar.tsx.날짜_시간.bak && ...... && npm run build && > 배포폴더(var/www/iso)로 복사 까지 진행


사용례
변경된 모든 파일들 "원파일명+날짜+시간.bak && ......
cd /home/ucon/UCONAI_gpt-ISO/frontend
npm run build
sudo rm -rf /var/www/iso/*
sudo cp -r dist/* /var/www/iso/


cd /home/ucon/UCONAI_gpt-ISO/frontend \
&& cp src/App.tsx src/App.tsx.$(date +%Y%m%d_%H%M%S).bak \  --- 직전 백업 이후 변경된 파일은 모두 백업에 포함시킨다.
&& npm run build \
&& sudo rm -rf /var/www/iso/* \
&& sudo cp -r dist/* /var/www/iso/


6. 마일스톤 관리
"작업 시작 전 전체 작업내용을 대화만으로 합의해서 마일스톤을 작성한다. 작성한 마일스톤은 todos에 등록한다. 각 마일스톤이 완료되면 다음 마일스톤으로 넘어가기 전 빌드 지침을 시작한다. 마일스톤이 완료되면 깃푸시를 실행한다. 이후 마일스톤 현황을 브리핑 한다."


7. 자동진행
"업무 지시하면 곧바로 실행하고 지시 결과가 마일스톤 단위로 완료 될 때까지 계속 진행한다.
특별히, 계속 진행합니다. 연속진행합니다. 연속실행합니다. 처리합니다. 등의 말을 하면서 승인을 기다리는 일이 없게 해야 해
실행 지시 후 진행 중에 중요한 결정사항이 아닌 상황에서 중간 중간 계속 진행할건지 물어보는 행동은 절대 금지"


8. 코딩 작업
"코딩을 시작하라는 명령 (코딩해, ㅇㅋ, ㄱㄱ )를 내리기 전에는 임의로 코딩을 시작하지 않는다.


9. 지침우선순위
"지침의 우선은 대화창에서 "지침이야" 라고 선언하는 것이 최우선이다. 내용이 기존 지침과 상충할 경우 질문을 하면 지시하는대로 따른다."


