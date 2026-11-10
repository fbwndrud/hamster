# Hamster 소개 페이지

한국어는 `/`, 영어는 `/en/`에서 열린다. 설치 안내는 `/install/`과 `/en/install/`에 있다. 작업 데모는 요청·작업·응답을, 교감 데모는 쓰다듬기·하이파이브·첫 선물을 보여준다. 1.0.10에 포함된 GIF를 사용한다. 옷장에서는 대기 그림에 모자, 안경, 첫 선물의 하트 스티커를 입혀 본다. 시스템에서 동작 줄이기를 선택하면 각 단계의 정지 그림을 볼 수 있다.

사이트 머리글과 브라우저 탭 아이콘은 Mac 앱 번들 아이콘과 같은 원화에서 만든다. 데모는 앱에서 재생하는 GIF를, 메뉴 막대는 macOS용 단색 아이콘을 쓴다.

## 빌드와 미리보기

프로젝트 루트에서 Node.js 22 이상과 FFmpeg로 실행한다.

```sh
node hamster-site/build.mjs
python3 -m http.server 4173 --bind 127.0.0.1 --directory hamster-site/dist
```

[한국어 미리보기](http://127.0.0.1:4173/) · [영어 미리보기](http://127.0.0.1:4173/en/) · [설치 안내](http://127.0.0.1:4173/install/) · [Install guide](http://127.0.0.1:4173/en/install/)

별도 터미널에서 Playwright를 사용할 수 있으면 `node hamster-site/verify.cjs`로 검사한다. 설치 위치가 다르면 `PLAYWRIGHT_MODULE`에 모듈 경로를, 설치된 Chrome을 사용하려면 `CHROME_PATH`에 실행 파일 경로를 지정한다. Playwright가 없으면 `node hamster-site/verify-static.cjs`가 `dist/`의 네 페이지, hreflang 짝, 다운로드·설치 링크, 훅 표, 외부 스크립트 유무를 정적으로 검사한다.

## 배포 방식

Hamster는 `fbwndrud/hamster`에서 소스를 공개한다. 코드는 MIT 라이선스이고, 햄스터 그림은 다시 배포할 수 없다. 앱은 Apple 서명과 공증 없이 [GitHub Releases](https://github.com/fbwndrud/hamster/releases/latest)로 배포한다. 사이트의 다운로드 버튼은 그 최신 릴리스로 연결한다. 서명이 없으므로 사용자는 처음 열 때 시스템 설정의 **그래도 열기**를 거쳐야 하고, 앱은 응용 프로그램 폴더로 옮긴 뒤 열어야 업데이트가 동작한다. 순서와 확인 방법, 앱이 수정하는 설정 파일과 훅 이벤트, 업데이트·제거·개인정보는 설치 안내 페이지(`/install/`, `/en/install/`)에 있다. 버그 제보는 GitHub Issues로 받고, 후원은 선택 사항으로 Ko-fi 링크만 둔다. 보상은 없다.

설치 안내의 훅 표는 `desktop-pet/codex-install.cjs`의 `providers`와 같아야 한다. 연결할 도구나 이벤트를 바꾸면 `template.mjs`의 `hookTable`과 `verify.cjs`, `verify-static.cjs`를 같이 고친다. 사이트의 보안 헤더(`_headers`)는 외부 스크립트와 분석 도구를 허용하지 않는다. Cloudflare Web Analytics를 붙일 때는 그 스크립트와 수집 주소만 CSP에 추가한다.

## Cloudflare Pages

배포 대상은 빌드가 생성한 `hamster-site/dist`다. 빌드는 예상한 페이지, 브라우저 코드, Pages 헤더와 선별된 햄스터 그림만 허용한다. 기존 Cloudflare 계정의 Workers & Pages에서 무료 사용 범위와 새 프로젝트 이름을 확인한다. 이전에 만든 프로젝트와 구분되는 이름을 사용한다.

저장소 밖의 빈 작업 폴더에서 아래 명령을 실행한다. `whoami`에 표시된 계정이 기존 계정과 일치하는지 확인하고, 계정이 여럿이면 확인한 계정을 Wrangler에 지정한 뒤 진행한다. 로그인 정보는 터미널과 브라우저의 OAuth 흐름으로 처리한다.

```sh
wrangler login
wrangler whoami
wrangler pages project list
wrangler pages project create <새-프로젝트-이름> --production-branch main
wrangler pages deploy <저장소-경로>/hamster-site/dist --project-name <새-프로젝트-이름> --branch main
```

배포 후 Wrangler가 반환한 운영 주소에서 한국어·영어 페이지와 데모를 확인한다. [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) · [Cloudflare Pages 무료 한도](https://developers.cloudflare.com/pages/platform/limits/)

사이트에는 앱 파일을 올리지 않는다. 앱 파일은 GitHub Releases에서만 내려받는다. 릴리스를 올리기 전에는 새 Mac에서 내려받기, 처음 열기, 연결, 업데이트, 제거를 한 번 끝까지 확인한다.
