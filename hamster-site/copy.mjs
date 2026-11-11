export const copy = {
  ko: {
    title: 'Hamster — 화면 아래 작은 작업 친구',
    description: '일하는 동안 맥 화면 아래에 앉아 있는 작은 햄스터. Codex가 일할 때는 앞발을 두드려요.',
    skip: '본문으로 건너뛰기',
    nav: ['작업 데모', '옷장', '다운로드'],
    eyebrow: 'Mac용 데스크톱 펫',
    headline: ['화면 아래에', '햄스터가 살아요.'],
    intro: '일하는 동안 화면 아래에 앉아 있어요. Codex에 일을 맡기면 앞발이 바빠져요.',
    see: '햄스터 움직여 보기',
    platform: 'Apple Silicon Mac · 무료 · 오픈소스',
    scene: '앱 그림으로 재현한 데모',
    status: '데모 상태',
    idle: '햄스터가 화면 아래에서 쉬고 있어요',
    desktop: ['메모', '오늘 할 일', '메모 정리하기', '보내기 전에 한 번 더 읽기'],
    steps: [
      ['요청을 보내면', '귀가 쫑긋', '요청을 보냈어요'],
      ['Codex가 일하면', '앞발이 톡톡', 'Codex가 작업 중이에요'],
      ['답이 도착하면', '고개를 갸웃', 'Codex가 답을 마쳤어요'],
    ],
    demoModes: ['작업', '교감'],
    interactions: [
      ['쓰다듬기', '쉴 때 이마를 살짝', '햄스터를 쓰다듬었어요'],
      ['하이파이브', '일이 끝나면 앞발을 톡', '햄스터와 하이파이브했어요'],
      ['첫 선물 열기', '상자 속 하트 스티커', '햄스터가 선물 상자를 열어요'],
    ],
    play: '데모 재생',
    pause: '재생 멈추기',
    wardrobeLabel: '작은 옷장',
    wardrobeTitle: '모자 하나 씌워 볼까요?',
    wardrobeIntro: '햄스터에게 니트 모자를 씌우거나 동그란 안경을 얹어 보세요.',
    looksLabel: '차림 미리보기',
    looks: ['기본 차림', '포근한 날', '비 오는 날', '졸린 밤', '하트 스티커'],
    download: {
      label: 'APPLE SILICON MAC',
      title: '무료로 받아 보세요',
      copy: '무료 오픈소스 Mac 앱이에요. Apple 서명 없이 배포해서, 처음 열 때 승인이 한 번 더 필요해요.',
      button: 'GitHub에서 받기',
      guide: '설치 안내',
      source: '소스 코드',
      note: 'macOS 전용 · 코드는 MIT 라이선스예요. 햄스터 그림은 다시 배포할 수 없어요.',
      support: ['마음에 들었다면', 'Ko-fi에서 커피 한 잔', '사 주세요. 선택이고, 보상은 없어요.'],
    },
    install: {
      title: 'Hamster — 설치 안내',
      description: 'Hamster를 받아 설치하고, AI 도구에 연결하고, 지우는 방법. 수정하는 파일과 훅 이벤트 목록도 있어요.',
      eyebrow: '설치 안내',
      heading: 'Hamster 설치하기',
      lead: 'Hamster는 무료 오픈소스 Mac 앱이에요. Apple 서명과 공증 없이 GitHub Releases로 배포해서 처음 열 때 승인이 한 번 더 필요해요. 아래 순서대로 따라 하면 돼요.',
      tableLabel: 'AI 도구별 수정 파일과 훅 이벤트',
      tableHead: ['도구', '수정하는 파일', '훅 이벤트'],
      sections: [
        { id: 'download', heading: '1. 받기', html: `
      <p><a href="{{releases}}">GitHub Releases</a>에서 최신 zip 파일을 받아요. 같은 페이지에 적힌 SHA-256 값과 내 파일의 값이 같은지 확인하세요.</p>
      <pre><code>shasum -a 256 ~/Downloads/Hamster-&lt;버전&gt;.zip</code></pre>
      <p>값이 다르면 열지 말고 Issues에 알려 주세요. 같으면 zip을 풀어 Hamster.app을 꺼내요.</p>` },
        { id: 'move', heading: '2. 응용 프로그램 폴더로 옮기기', html: `
      <p>열기 전에 Hamster.app을 응용 프로그램 폴더로 옮겨요. 받은 폴더에서 바로 열면 macOS가 앱을 임시 읽기 전용 위치로 옮겨 실행해요(App Translocation). 그러면 업데이트가 깨져요.</p>` },
        { id: 'open', heading: '3. 처음 열기', html: `
      <ol>
        <li>Hamster를 한 번 열어요. 열 수 없다는 경고가 뜨면 닫아요.</li>
        <li>시스템 설정 → 개인정보 보호 및 보안을 열고 보안 항목까지 내려가요. Hamster를 차단했다는 안내 옆에 <strong>그래도 열기</strong> 버튼이 있어요.</li>
        <li>그래도 열기를 누르고 Mac 암호를 입력해요.</li>
      </ol>
      <p>이 버튼은 열어 보려 한 뒤 1시간 정도만 보여요. 안 보이면 Hamster를 한 번 더 열어요. 처음 한 번만 하면 돼요. <a href="{{apple}}">Apple 안내</a></p>` },
        { id: 'connect', heading: '4. AI 도구 연결', html: `
      <p>메뉴 막대의 Hamster 아이콘에서 <strong>AI 연결</strong> → 쓰는 도구 → <strong>훅 설치…</strong>를 눌러요. 도구마다 따로 연결해요. Hamster는 아래 파일에 자기 훅만 추가하고, 다른 설정과 훅은 그대로 둬요. 파일이 없으면 새로 만들고, 저장할 때 들여쓰기가 바뀔 수 있어요.</p>
      {{table}}
      <p class="small">CODEX_HOME, CLAUDE_CONFIG_DIR, GEMINI_CLI_HOME, GROK_HOME 환경 변수를 설정했다면 그 폴더를 써요. 각 폴더의 <code>hamster</code> 폴더에는 작은 도우미 프로그램(<code>codex-hook-v2</code>, <code>ai-hook-v2</code> 또는 <code>ai-hook-v3</code>)이 복사되고, 훅이 그 프로그램을 가리켜요.</p>
      <p>Codex는 설치 뒤 Settings → Hooks에서 Hamster 훅을 승인해야 해요. Claude Code, Gemini CLI, Grok은 새 세션에서 <code>/hooks</code>(Gemini는 <code>/hooks list</code>)로 확인해요. Cursor는 Hooks 설정에서 확인해요. Grok은 Claude Code 훅도 함께 실행하지만, Hamster는 Grok의 신호를 Grok 훅에서만 받아요.</p>` },
        { id: 'updates', heading: '업데이트', html: `
      <p>앱이 하루에 한두 번 GitHub 릴리스를 확인해요. 새 버전이 있으면 메뉴에 보여 주고, 내가 누를 때만 설치해요. 받은 파일은 서명을 확인한 뒤에만 설치해요.</p>` },
        { id: 'remove', heading: '지우기', html: `
      <ol>
        <li>AI 연결 → 도구 → <strong>Hamster 훅 제거</strong>를 눌러요. 연결한 도구마다 해요. 제거는 Hamster 훅만 지워요.</li>
        <li>메뉴에서 Hamster를 종료하고, 응용 프로그램의 Hamster.app을 휴지통으로 옮겨요.</li>
        <li>남은 도우미 프로그램은 <code>~/.codex/hamster</code> 같은 <code>hamster</code> 폴더에서 지울 수 있어요.</li>
      </ol>` },
        { id: 'privacy', heading: '개인정보', html: `
      <p>Hamster는 업데이트 정보를 GitHub에서 가져오는 것 말고는 아무것도 보내지 않아요. 토큰 사용량을 보여 주려고 이 Mac에 남은 AI 도구의 대화 기록에서 토큰 숫자를 읽어요. Claude Code에서 작업을 중단했는지 알아보려고 그 세션 대화 기록의 끝부분에서 중단 표시도 확인해요. 프롬프트와 작업 내용은 저장하거나 보내지 않아요. 소스가 공개되어 있어서 <a href="{{source}}">직접 확인</a>할 수 있어요.</p>` },
        { id: 'help', heading: '문제가 생기면', html: `
      <p><a href="{{issues}}">GitHub Issues</a>에 남겨 주세요. 프롬프트, 코드, 키, 개인정보는 올리지 마세요.</p>` },
      ],
    },
    footer: '화면 아래 작은 작업 친구',
  },
  en: {
    title: 'Hamster — A little desktop pet for Mac',
    description: 'A small hamster that sits at the bottom of your Mac screen and taps its paws while Codex works.',
    skip: 'Skip to content',
    nav: ['Demo', 'Wardrobe', 'Download'],
    eyebrow: 'A desktop pet for Mac',
    headline: ['A little hamster', 'for your Mac.'],
    intro: 'It sits at the bottom of your screen while you work. Give Codex something to do and watch those paws go.',
    see: 'See the hamster move',
    platform: 'Apple Silicon Mac · Free · Open source',
    scene: 'Demo made with artwork from the app',
    status: 'Demo status',
    idle: 'The hamster is resting at the bottom of the screen',
    desktop: ['Notes', 'Today', 'Tidy up my notes', 'Read it once more before sending'],
    steps: [
      ['Send a prompt', 'Ears perk up', 'Prompt sent'],
      ['While Codex works', 'Little paws tap', 'Codex is working'],
      ['When the reply lands', 'A little head tilt', 'Codex has replied'],
    ],
    demoModes: ['Work', 'Playtime'],
    interactions: [
      ['Pet the hamster', 'A gentle pat while it rests', 'You petted the hamster'],
      ['High five', 'Tap its paw after a reply', 'You high-fived the hamster'],
      ['Open the first gift', 'A heart sticker for its cheek', 'The hamster opens its gift box'],
    ],
    play: 'Play demo',
    pause: 'Pause demo',
    wardrobeLabel: 'The wardrobe',
    wardrobeTitle: 'Try on a hat.',
    wardrobeIntro: 'Try a knit hat or a pair of round glasses on your hamster.',
    looksLabel: 'Outfit preview',
    looks: ['Everyday', 'Cozy day', 'Rainy day', 'Sleepy night', 'Heart sticker'],
    download: {
      label: 'APPLE SILICON MAC',
      title: 'Free to download.',
      copy: 'A free, open source Mac app. It ships without an Apple signature, so the first launch needs one extra approval.',
      button: 'Download from GitHub',
      guide: 'Install guide',
      source: 'Source code',
      note: 'macOS only · The code is MIT licensed. The hamster artwork is not for redistribution.',
      support: ['Like it?', 'Buy me a coffee on Ko-fi.', 'It’s optional, and there are no rewards.'],
    },
    install: {
      title: 'Hamster — Install guide',
      description: 'How to download, install, connect and remove Hamster, including the files it edits and the hook events it uses.',
      eyebrow: 'Install guide',
      heading: 'Install Hamster',
      lead: 'Hamster is a free, open source Mac app. It ships through GitHub Releases without Apple signing or notarization, so the first launch needs one extra approval. Follow these steps.',
      tableLabel: 'Files edited and hook events for each AI tool',
      tableHead: ['Tool', 'File it edits', 'Hook events'],
      sections: [
        { id: 'download', heading: '1. Download', html: `
      <p>Get the latest zip from <a href="{{releases}}">GitHub Releases</a>. Check that the SHA-256 listed on the release page matches your file.</p>
      <pre><code>shasum -a 256 ~/Downloads/Hamster-&lt;version&gt;.zip</code></pre>
      <p>If the values differ, don’t open it. Tell us in Issues. If they match, unzip it to get Hamster.app.</p>` },
        { id: 'move', heading: '2. Move it to Applications', html: `
      <p>Move Hamster.app to your Applications folder before you open it. If you open it from Downloads, macOS runs it from a temporary read-only location (app translocation), and updates break.</p>` },
        { id: 'open', heading: '3. Open it the first time', html: `
      <ol>
        <li>Open Hamster once. When macOS warns that it can’t open the app, close the warning.</li>
        <li>Open System Settings → Privacy &amp; Security and scroll to Security. Next to the note that Hamster was blocked, there is an <strong>Open Anyway</strong> button.</li>
        <li>Click Open Anyway and enter your Mac password.</li>
      </ol>
      <p>The button shows for about an hour after you try to open the app. If it’s gone, open Hamster again. You only do this once. <a href="{{apple}}">Apple’s guide</a></p>` },
        { id: 'connect', heading: '4. Connect an AI tool', html: `
      <p>From the Hamster icon in the menu bar, choose <strong>AI Connection</strong> → your tool → <strong>Install … Hooks…</strong>. Connect each tool separately. Hamster adds only its own hooks to the files below and leaves your other settings and hooks alone. It creates the file if it’s missing, and saving may change the indentation.</p>
      {{table}}
      <p class="small">If you set CODEX_HOME, CLAUDE_CONFIG_DIR, GEMINI_CLI_HOME or GROK_HOME, Hamster uses that folder instead. Each folder also gets a <code>hamster</code> folder with a small helper program (<code>codex-hook-v2</code>, <code>ai-hook-v2</code> or <code>ai-hook-v3</code>) that the hooks point to.</p>
      <p>For Codex, approve the Hamster hooks in Settings → Hooks after installing. For Claude Code, Gemini CLI and Grok, open a new session and check <code>/hooks</code> (<code>/hooks list</code> in Gemini). For Cursor, check the Hooks settings. Grok also runs Claude Code hooks, but Hamster takes Grok’s signals only from the Grok hook.</p>` },
        { id: 'updates', heading: 'Updates', html: `
      <p>The app checks the GitHub release once or twice a day. If there’s a new version, it shows up in the menu, and it installs only when you click it. Downloads are checked with a signature before they’re installed.</p>` },
        { id: 'remove', heading: 'Removing Hamster', html: `
      <ol>
        <li>Choose AI Connection → your tool → <strong>Remove Hamster Hooks</strong>. Do this for each tool you connected. It removes only Hamster’s hooks.</li>
        <li>Quit Hamster from its menu, then move Hamster.app from Applications to the Trash.</li>
        <li>You can delete the leftover helper from the <code>hamster</code> folder, such as <code>~/.codex/hamster</code>.</li>
      </ol>` },
        { id: 'privacy', heading: 'Privacy', html: `
      <p>Hamster sends nothing except fetching the update information from GitHub. To show token usage it reads the token counts from your AI tools’ records on this Mac. To notice when you stop a Claude Code turn, it also checks the end of that session’s transcript for the interrupt marker. It never stores or sends your prompts or your work. The source is public, so you can <a href="{{source}}">check for yourself</a>.</p>` },
        { id: 'help', heading: 'Something wrong?', html: `
      <p>Open an issue on <a href="{{issues}}">GitHub Issues</a>. Please don’t post prompts, code, keys or personal information.</p>` },
      ],
    },
    footer: 'A little friend at the bottom of your screen',
  },
};
