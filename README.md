# UCONAI_gpt-ISO

ISO/IEC JTC 1 SC 36 분야 국제 표준 작업(설계, 작성, 검토)을 지원하는
UCONAI 전용 ISO Expert 시스템 프로젝트.

## 목적

- ISO/IEC TR 25468, PWI 26255, 메타버스 LET 등 관련 표준 작업을 위한 전용 AI 엔진 구축
- OpenAI API + 전용 SYSTEM 프롬프트를 활용한 ISO 전문가 챗봇 제공
- 모든 대화/작업 로그를 서버(DB)에 영구 저장
- PC/모바일 어디서나 접근 가능한 웹 UI 제공
- 향후 공구반장, 랜툴박스 등 다른 UCONAI 서비스와 통합 가능한 구조 확보

## 구조

- backend  : ISO Expert API 서버 (Node.js + OpenAI)
- frontend : ISO Expert Web UI (React/Vite)
- infra    : Docker 및 배포/네트워크 설정
- docs     : 아키텍처/설계 문서

## 마일스톤

- M0: Project Initialization (구조/문서/프롬프트 정의)
- M1: ISO Expert API Core (/api/iso-chat)
- M2: Database Integration (PostgreSQL, 대화 로그 저장)
- M3: Web UI v0 (React 채팅 화면)
- M4: Docker Integration & 배포
- M5: Multi-AI Architecture 지원
- M6: ISO 특화 기능 (Outline, Draft, Review)
- M7: 운영 안정화 (백업/모니터링/보안)
