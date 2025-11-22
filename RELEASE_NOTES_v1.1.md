UCONAI gpt-ISO Expert — Release Notes v1.1

Date: 2025-11-22
Author: UCONCREATIVE / ISO Digital Standardization Lab

1. 개요 (Overview)
v1.1은 v1.0 구조를 유지하면서 지침/가이드 시스템, 파일 업로드 기반 ISO 작업환경, 모델·실행 방식 전환 기능, 다중 대화 세션 관리, UX 정리 및 안정화 패치가 포함된 첫 번째 실질적 기능 업데이트입니다.

본 업데이트는 ISO/IEC JTC1 SC36 분야 WD·CD·TR 개발을 지원하기 위한 “ISO Expert 전용 작업 환경”을 고도화하며, 향후 v1.2~v1.5의 “지식 지속성/메모리/어시스턴트 자동화” 기능 확장을 위한 기반을 마련했습니다.

2. 주요 업데이트 항목 (Key Features)
2.1 모델 선택 기능 추가
- 프론트에서 모델 직접 선택 가능 (gpt-5.1, gpt-4.1, gpt-4.1-mini)
- 실제 API 호출 파라미터로 반영되는 구조 정리 완료
- 향후 모델 리스트 자동 업데이트 가능하도록 구조 확장

2.2 실행 방식 2종 지원 (Chat API / Responses API)
- 일반 실행(Chat API): 추론 지연이 낮고 일반적 ISO 문답에 적합
- 고급 실행(Responses API): 파일 해석·고급 reasoning · structured JSON 응답 대비
- 선택 가능한 UI 구성과 백엔드 분기처리 구조 정리 완료

2.3 다중 대화 세션 기능 정비
- 좌측 패널에 대화 세션 목록 표시
- 세션별 고유 title, 생성일, 메시지 수 노출
- 세션 선택 시 해당 기록 즉시 로딩
- 제목 편집 기능 추가 (더블클릭 또는 아이콘)
- 1.1에서는 메모리 영속성(localStorage 기반)이 적용됨
- 차기 1.2에서 DB(recording) 저장 예정

2.4 지침/가이드 시스템 기본 골격 구축
- 프로젝트 공통 지침/가이드 (Global Guides)
- 대화방별 지침/가이드 (Conversation Guides)
- 지침/가이드 관리 패널 (Floating Panel) 완성: 생성/수정/삭제, 탭 전환, 제목·내용 편집
- 첨부파일 구조, GuideFile 인터페이스, 패널 레이아웃 구축 완료 (파일 업로드는 1.2 예정)

2.5 첨부파일 업로드 구조 준비
- /api/iso-chat이 파일을 받을 수 있도록 백엔드 로직 구조화
- 프론트는 드래그&드롭·카메라/갤러리 선택 기능을 고려한 UI 자리 구성
- 업로드 중 상태/실패/성공 알림 UI 예정 공간 확보
- 파일 업로드 기능은 v1.2에서 본격 제공(이미지·PDF·문서·동영상 등)

2.6 전체 UI 구조 재정렬
- App.css 기반으로 전체 레이아웃을 UI/UX 명세대로 복구
- 사이드바(대화 목록 / 지침 패널)와 메인 카드형 UI 정상화
- 메시지 렌더링 안정화
- 새 디자인 기준(모노톤 + 보라/핑크 그라디언트 버튼) 완전 반영

2.7 버그 수정
- Responses API에서 빈 응답 (reply length: 0) 발생했던 문제 구조 진단 및 로그 확장
- <App /> 중복 선언 오류 해결
- F5 새로고침 시 전체 초기화되던 문제 개선 (localStorage 저장 적용)
- Vite Dev Server 환경 오류 수정
- 불필요한 useState 중복 선언 정리

3. 기술적 변경 사항 (Technical Changes)
3.1 Frontend
- App.tsx 전면 재작성
- 대화·지침·첨부파일 상태 정의 정돈
- 전체 컴포넌트 구조적 재배치
- useState → useRef / localStorage 활용 일부 변경
- Guide Panel 컴포넌트 독립 구현
- 기본 router-less SPA 유지

3.2 Backend
- Chat / Responses API 분기 로직 추가
- 모델/파일 파이프라인 확장 구조 확립
- System Prompt 자동 로딩
- ISO Expert 스타일 가이드를 안정적으로 inject하도록 개선
- 로그에 의도/메서드/모델/파일Preview까지 출력하도록 확장

3.3 Infra
- 포트 정책 4400 확정 (ISO Expert 백엔드)
- 향후 Caddy reverse proxy 매핑 예시 제시
- 프론트 배포용 dist 라우팅 준칙 준비

4. 향후 로드맵 (1.2~1.5)
v1.2 – 파일 업로드/첨부 완성
- 이미지/PDF/문서/동영상 업로드
- 파일 미리보기
- 파일 기반 분석 → Responses API 실제 반영
- 지침/가이드 파일 첨부 기능 완성

v1.3 – DB 연결 + 대화·지침 영구 저장
- PostgreSQL + Prisma
- 대화 전체 서버 저장
- JSON 기반 ISO 작업 로그 구조화 저장
- 지침/참조파일 DB 관리

v1.4 – ISO 문서 자동 생성 엔진
- WD, CD, TR 문서 자동 작성
- Clause 자동구조화
- Annex 자동생성
- xAPI/Caliper alignment 자동검토

v1.5 – 멀티모달 / 웹검색 / 데이터크롤링
- 웹사이트·PDF·이미지 분석 기능
- 플러그인 확장
- 사용자 제공 링크 자동스캔

5. 요약 (Executive Summary)
UCONAI gpt-ISO Expert v1.1은 실제 ISO/IEC 표준 개발 업무 흐름에 맞춘 전문 에디터 환경을 갖추기 위한 첫 번째 본격 업데이트입니다.
- 모델 선택
- 실행 모드 선택
- 다중 대화 세션
- 프로젝트/세션별 지침 시스템
- 향후 파일 기반 Reasoning 확장을 위한 기반
- 전면 UI 복원 및 안정화
