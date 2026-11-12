# Building from source

[한국어](#소스에서-빌드하기)

Requires macOS on Apple silicon, Node.js 22 or later, and the Xcode command line tools (for Swift).

```sh
npm ci --prefix desktop-pet
npm test --prefix desktop-pet
npm run package:mac --prefix desktop-pet -- --bootstrap
```

The app is written to `output/desktop/Hamster.app`. A build made on your own Mac is not marked as downloaded, so it opens without the Open Anyway step.

It still checks this repository for updates. To turn that off in your fork, change the manifest URL and public key in [`distribution.cjs`](../desktop-pet/distribution.cjs).

The project website is built from [`hamster-site/`](../hamster-site).

---

## 소스에서 빌드하기

Apple 실리콘 Mac, Node.js 22 이상, Xcode 명령줄 도구(Swift용)가 필요합니다.

```sh
npm ci --prefix desktop-pet
npm test --prefix desktop-pet
npm run package:mac --prefix desktop-pet -- --bootstrap
```

앱은 `output/desktop/Hamster.app`에 만들어집니다. 내 Mac에서 빌드한 앱은 내려받은 파일로 표시되지 않아 **그래도 열기** 단계 없이 열립니다.

업데이트는 여전히 이 저장소에서 확인합니다. 포크에서 끄려면 [`distribution.cjs`](../desktop-pet/distribution.cjs)의 매니페스트 주소와 공개키를 바꿉니다.

소개 페이지는 [`hamster-site/`](../hamster-site)에서 빌드합니다.
