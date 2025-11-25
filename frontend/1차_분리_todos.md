# 1차 분리 및 리팩토링 세부 TODO

## 1. 타입, API 분리
- 1-1) App.tsx에 정의된 타입들을 src/types/isoApp.ts로 분리
- 1-2) App.tsx에서 isoApp.ts 타입 import로 교체
- 1-3) App.tsx 내 API fetch 로직을 src/api/isoChatApi.ts로 분리
- 1-4) App.tsx에서 isoChatApi 함수 import로 교체

## 2. GuidePanel 분리
- 2-1) App.tsx 내 GuidePanel 컴포넌트 전체를 src/components/guides/GuidePanel.tsx로 이동
- 2-2) GuidePanel props 타입 선언 및 적용
- 2-3) App.tsx에서 GuidePanel import 및 JSX 교체

## 3. 3개 패널 분리 (Sidebar, ChatPanel, Rightbar)
- 3-1) App.tsx 내 Sidebar JSX/로직을 src/components/layout/Sidebar.tsx로 이동
- 3-2) Sidebar props 타입 선언 및 적용
- 3-3) App.tsx에서 Sidebar import 및 JSX 교체
- 3-4) App.tsx 내 ChatPanel JSX/로직을 src/components/chat/ChatPanel.tsx로 이동
- 3-5) ChatPanel props 타입 선언 및 적용
- 3-6) App.tsx에서 ChatPanel import 및 JSX 교체
- 3-7) App.tsx 내 Rightbar JSX/로직을 src/components/layout/Rightbar.tsx로 이동
- 3-8) Rightbar props 타입 선언 및 적용
- 3-9) App.tsx에서 Rightbar import 및 JSX 교체

## 4. App.tsx 정리
- 4-1) 상태/핸들러/3개 패널 조립만 남도록 코드 정리
- 4-2) 불필요한 코드/주석/임시 변수 제거

## 5. 불필요 파일/폴더 정리
- 5-1) context/, hooks/, common/, chat/guides 내부 세부 컴포넌트 등 1차 분리 미포함 파일/폴더 삭제
- 5-2) 남길 파일/폴더 최종 확인 및 정리
