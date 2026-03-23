# lu-diverse

WebGL 게임을 업로드하고 플레이할 수 있는 플랫폼입니다.

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 |
| Storage | AWS S3 |
| 인증 | JWT (bcrypt) |
| 배포 | K3s + ArgoCD (GitOps) |
| CI/CD | GitHub Actions + GHCR |

## 프로젝트 구조

```
van/
├── frontend/          # React 앱
├── backend/           # Express API 서버
├── k8s/               # Kubernetes 매니페스트 (ArgoCD GitOps)
├── .github/workflows/ # GitHub Actions CI/CD
├── docker-compose.yml         # 프로덕션 빌드 로컬 실행용
└── docker-compose.dev.yml     # 개발 환경 (핫 리로드)
```

## 로컬 개발 환경 설정

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 AWS 자격증명과 S3 버킷 이름을 입력합니다:

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
S3_BUCKET=your_s3_bucket_name
AWS_REGION=ap-northeast-2
JWT_SECRET=your_long_random_secret
```

### 2-A. 개발 모드 실행 (백엔드 핫 리로드 + 프론트엔드 Vite dev server)

DB와 백엔드를 컨테이너로 실행하고, 프론트엔드는 로컬에서 실행합니다:

```bash
# DB + 백엔드 컨테이너 시작
docker compose -f docker-compose.dev.yml up -d

# 프론트엔드 로컬 실행 (별도 터미널)
cd frontend
npm install
npm run dev
```

- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:4100
- PostgreSQL: localhost:5432

### 2-B. 프로덕션 빌드로 로컬 실행

```bash
docker compose up --build
```

- 앱: http://localhost:3000
- 백엔드 API: http://localhost:4000

### 3. 데이터베이스 초기화

앱 최초 실행 시 백엔드가 자동으로 `schema.sql`을 실행하여 테이블을 생성합니다.

수동으로 DB에 접속하려면:

```bash
docker exec -it ludiverse-postgres-dev psql -U ludiverse -d ludiverse
```

## 배포 (K3s + ArgoCD)

### GitHub Actions 설정

`k8s/backend/deployment.yaml`과 `k8s/frontend/deployment.yaml`의 `OWNER`를 실제 GitHub 사용자명으로 변경하세요.

GitHub Actions가 k8s YAML을 업데이트하려면 `contents: write` 권한이 필요합니다 (워크플로우에 이미 설정됨).

### Kubernetes Secret 설정

```bash
# postgres secret
kubectl apply -f k8s/postgres/secret.yaml

# backend secret (실제 값으로 수정 후 적용)
kubectl apply -f k8s/backend/secret.yaml
```

> **주의:** `secret.yaml` 파일의 `CHANGE_ME_*` 값을 실제 값으로 교체하고, `.gitignore`에 의해 커밋되지 않도록 주의하세요. 프로덕션에서는 [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) 또는 External Secrets Operator 사용을 권장합니다.

### ArgoCD 앱 등록

```bash
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: lu-diverse
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/YOUR_ORG/lu-diverse
    targetRevision: main
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: lu-diverse
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF
```

## API 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/auth/register | 회원가입 | - |
| POST | /api/auth/login | 로그인 | - |
| GET | /api/games | 게임 목록 (검색, 정렬, 페이지네이션) | 선택 |
| GET | /api/games/my | 내 게임 목록 | 필수 |
| GET | /api/games/:id | 게임 상세 + 버전 이력 | 선택 |
| POST | /api/games | 게임 업로드 (multipart) | 필수 |
| PATCH | /api/games/:id | 게임 업데이트 (multipart) | 필수 |
| GET | /api/wishlist | 찜 목록 + 플레이 시간 | 필수 |
| POST | /api/wishlist/:gameId | 찜하기 | 필수 |
| DELETE | /api/wishlist/:gameId | 찜 취소 | 필수 |
| POST | /api/playtime | 플레이 시간 기록 | 선택 |
| GET | /health | 헬스 체크 | - |

## 게임 업로드 형식

- 파일 형식: `.zip`
- 최대 크기: 1GB
- zip 내부에 `index.html`이 있어야 WebGL 게임이 정상 실행됩니다
- Unity WebGL 빌드 시 Build/ 폴더 포함하여 압축하면 됩니다
