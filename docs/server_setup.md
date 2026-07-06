# 신규 리눅스 서버 구성

대상 서버: `223.130.162.61` -네이버클라우드 기준

이 절차는 운영서버와 같은 방식으로 이미지를 pull 해서 기동하는 개발/검증 서버용입니다. DB 초기화, seed, synchronize는 실행하지 않습니다.

## 1. Docker 설치

root 계정으로 최초 1회만 실행합니다. Ubuntu 기준:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 2. 운영 계정 생성

root로 계속 작업하지 않고 (예시)`cmms` 계정으로 배포와 운영을 수행합니다. 

```bash
sudo adduser cmms
sudo usermod -aG sudo cmms
sudo usermod -aG docker cmms
```

`adduser cmms` 실행 중 비밀번호는 아래 값으로 입력합니다.

```text
cmms123!@#A
```

그룹 권한 반영을 위해 `cmms`로 다시 로그인한 뒤 확인합니다.

```bash
docker version
docker compose version
```

이후 절차는 `cmms` 계정으로 실행합니다.

```bash
su - cmms
```

## 3. 방화벽

외부 접속은 Nginx 컨테이너의 `80` 포트만 엽니다. SSH는 운영 포트에 맞게 유지합니다.

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw enable
sudo ufw status
```

## 4. 배포 파일 배치

root에서 배포 디렉터리를 만들고 소유자를 `cmms`로 지정합니다.

```bash
sudo mkdir -p /opt/cmms-node
sudo chown -R cmms:cmms /opt/cmms-node
```

이후 `cmms` 계정으로 소스를 배치합니다.

```bash
git clone https://github.com/jamsildongsoo/cmms-node.git /opt/cmms-node
cd /opt/cmms-node
```

이미 checkout 되어 있으면 최신 브랜치로 맞춘 뒤 진행합니다. 서버는 소스를 빌드하지 않고 `docker-compose.prod.yml`, `scripts/prod.sh`, `.env`만 사용해 운영서버와 같은 방식으로 이미지를 pull 합니다. 

## 5. 환경변수

루트 `.env`를 만들고 기존 DB 접속 정보를 넣습니다.

```bash
cp .env.template .env
vi .env
```

기존 DB 보호를 위해 아래 값은 반드시 유지합니다.

```env
NODE_ENV=production
PORT=8080
DB_SYNCHRONIZE=false
DB_URL=postgresql://...
DB_USERNAME=...
DB_PASSWORD=cmms123!@#A
JWT_SECRET=...
IMAGE_REGISTRY=ghcr.io/...
IMAGE_TAG=...
```

첨부파일을 사용하면 `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`도 기존 값과 맞춥니다.

`.env`는 `cmms` 계정만 읽고 쓸 수 있게 제한합니다.

```bash
chmod 600 .env
```

Docker 이미지는 GitHub Actions가 GitHub Container Registry에 등록합니다. 개발 PC에서 `main` 브랜치로 push하면 `.github/workflows/docker-images.yml`이 실행되어 아래 이미지가 생성됩니다.

```text
ghcr.io/jamsildongsoo/cmms-node-api:latest
ghcr.io/jamsildongsoo/cmms-node-web:latest
ghcr.io/jamsildongsoo/cmms-node-api:<commit-sha>
ghcr.io/jamsildongsoo/cmms-node-web:<commit-sha>
```

신규 서버의 `.env`는 보통 아래처럼 둡니다.

```env
IMAGE_REGISTRY=ghcr.io/jamsildongsoo
IMAGE_TAG=latest
```

GHCR 패키지가 private이면 서버에서 1회 로그인해야 합니다. GitHub Personal Access Token은 `read:packages` 권한으로 발급합니다.

```bash
docker login ghcr.io -u jamsildongsoo
```

## 6. 기동

운영서버와 같이 레지스트리 이미지를 pull 해서 `nginx + web + api`를 올립니다.

```bash
./scripts/prod.sh deploy
```

접속 주소:

```text
http://223.130.162.61
```

## 7. 확인

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 api
docker compose -f docker-compose.prod.yml logs -f --tail=100 web
curl -I http://127.0.0.1
```

## 8. 재배포

```bash
cd /opt/cmms-node
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```
