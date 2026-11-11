const menus = {
  ko: {
    name:'햄스터', show:'햄스터 표시', hide:'햄스터 숨기기', wardrobe:'꾸미기',
    hat:'머리', face:'얼굴', neck:'목', none:'없음', preset:'차림 한 번에 고르기', openWardrobe:'햄스터 옷장 열기…',
    motion:'동작 설정', frequency:'동작 빈도', quiet:'조용히', normal:'보통', lively:'활발하게',
    aiReactions:'AI 요청·응답 반응', human:'내 작업 반응', ambient:'대기 중 버릇', rewards:'간식·선물 연출',
    interaction:'햄스터와 교감하기', pat:'쓰다듬기', highfive:'하이파이브', openGift:'첫 선물 열기', tryGift:'첫 선물 입혀보기…',
    giftReceived:'첫 선물 스티커를 옷장에 넣었어요',
    language:'언어 / Language', system:'시스템 기본값', quit:'종료', pending:'받을 보상이 있어요',
    placement:'화면 하단 위치', left:'왼쪽', center:'가운데', right:'오른쪽',
    activeTasks:count => `AI 작업 ${count}개 진행 중`,
    currentVersion:version => `버전 ${version}`, checkingUpdate:version => `버전 ${version} · 업데이트 확인 중…`,
    upToDate:version => `버전 ${version} · 최신 버전`,
    updateAvailable:version => `Hamster ${version} 업데이트 가능`, installUpdate:(current,next) => `업데이트 설치 · ${current} → ${next}…`,
    installingUpdate:'업데이트 설치 중…', retryUpdate:version => `버전 ${version} · 업데이트 확인 다시 시도`,
    updateChanged:'설치할 수 있는 버전이 바뀌었어요. 햄스터 메뉴에서 다시 확인해 주세요.', updateError:'Hamster를 업데이트할 수 없어요',
    updateRestored:'업데이트에 실패해 이전 버전으로 돌아왔어요.',
    sendFeedback:'의견 보내기', copyDiagnostics:'진단 정보 복사',
    diagnosticsCopied:'진단 정보를 복사했어요. 의견을 보낼 때 붙여넣어 주세요.', feedbackError:'의견 페이지를 열 수 없어요',
    ai:'AI 연결', installHooks:name => `${name} 훅 설치…`, codexSettings:'Codex 설정 열기',
    hooksInstalled:'Hamster 훅 설치됨', removeHooks:'Hamster 훅 제거', install:'설치', cancel:'취소',
    connectionState:{notInstalled:'훅 설치 전',waiting:'승인 또는 첫 AI 신호 대기 중',verified:'AI 신호 수신 확인'},
    lastSignal:time => '최근 신호 · '+time, connectionHelp:'연결 확인 방법…',
    sendTestRequest:'승인한 뒤 해당 도구에서 실제 요청을 한 번 보내고 이 메뉴를 다시 열어보세요.',
    refreshHooks:'연결 확인용 훅으로 갱신…',
    legacyHook:'연결 확인을 사용하려면 훅을 갱신하세요',
    tokenUsage:'토큰', usageToday:(total,output) => `토큰 · 오늘 ${total} (출력 ${output})`,
    usageBefore:value => `집계 시작 이전 · ${value}`,
    usageAfter:(value,output) => `집계 시작 이후 · ${value} (출력 ${output})`, usageSince:date => `집계 시작 · ${date}`,
    usageLoading:'로컬 기록 읽는 중…', usageUnsupported:'집계 미지원', usageTokens:count => `${count} 토큰`,
    usageLocal:name => `이 Mac에 남은 ${name} 기록에서 토큰 숫자만 읽어요`, usagePartial:'일부 기록은 집계할 수 없었어요',
    usageExperimental:'Gemini 집계는 아직 실험 중이에요',
    toolTime:(today,total) => `함께 일한 시간 · 오늘 ${today} · 누적 ${total}`,
    duration:ms => {
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      return hours ? `${hours}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}` : `${minutes}분`;
    },
    openError:'Codex를 열 수 없어요', hookError:'AI 훅 설정을 바꿀 수 없어요',
    hookSteps:{
      codex:'이 Mac 사용자의 로컬 Codex 작업공간에 적용됩니다. 설치 후 Codex의 Settings → Hooks 또는 작성창의 Review hooks에서 Hamster 훅을 승인하세요.',
      claude:'이 Mac 사용자의 Claude Code 설정에 Hamster 훅을 추가합니다. 새 Claude Code 세션을 열고 /hooks에서 확인하세요.',
      cursor:'이 Mac 사용자의 로컬 Cursor Agent 설정에 Hamster 훅을 추가합니다. Cursor의 Hooks 설정에서 확인하세요.',
      gemini:'이 Mac 사용자의 Gemini CLI 설정에 Hamster 훅을 추가합니다. Gemini CLI를 다시 열고 /hooks list에서 확인하세요.',
      grok:'~/.grok/hooks/hamster.json에 Hamster 훅을 추가합니다. 새 Grok 세션을 열고 /hooks에서 확인하세요.',
    },
    status:(snacks,gifts,next) => `간식 ${snacks} · 선물 ${gifts} · ${next}`,
    next:minutes => `다음 보상까지 작업 약 ${minutes}분`,
  },
  en: {
    name:'Hamster', show:'Show Hamster', hide:'Hide Hamster', wardrobe:'Dress Up',
    hat:'Headwear', face:'Face', neck:'Neckwear', none:'None', preset:'Choose an Outfit', openWardrobe:'Open Hamster Wardrobe…',
    motion:'Motion Settings', frequency:'Motion Frequency', quiet:'Quiet', normal:'Balanced', lively:'Lively',
    aiReactions:'AI Reactions', human:'My Work Reactions', ambient:'Idle Habits', rewards:'Reward Animations',
    interaction:'Interact with Hamster', pat:'Pet Hamster', highfive:'High Five', openGift:'Open First Gift', tryGift:'Try On First Gift…',
    giftReceived:'Your first gift sticker is in the wardrobe',
    language:'Language / 언어', system:'System Default', quit:'Quit', pending:'a reward is ready',
    placement:'Position Along Bottom', left:'Left', center:'Center', right:'Right',
    activeTasks:count => `${count} AI ${count === 1 ? 'task' : 'tasks'} in progress`,
    currentVersion:version => `Version ${version}`, checkingUpdate:version => `Version ${version} · Checking for Updates…`,
    upToDate:version => `Version ${version} · Up to Date`,
    updateAvailable:version => `Hamster ${version} is available`, installUpdate:(current,next) => `Install Update · ${current} → ${next}…`,
    installingUpdate:'Installing Update…', retryUpdate:version => `Version ${version} · Retry Update Check`,
    updateChanged:'The available version has changed. Check the Hamster menu again.', updateError:'Could not update Hamster',
    updateRestored:'The update failed. Hamster restored the previous version.',
    sendFeedback:'Send Feedback', copyDiagnostics:'Copy Diagnostics',
    diagnosticsCopied:'Diagnostics copied. Paste them when you send feedback.', feedbackError:'Could not open the feedback page',
    ai:'AI Connection', installHooks:name => `Install ${name} Hooks…`, codexSettings:'Open Codex Settings',
    hooksInstalled:'Hamster Hooks Installed', removeHooks:'Remove Hamster Hooks', install:'Install', cancel:'Cancel',
    connectionState:{notInstalled:'Hooks not installed',waiting:'Waiting for approval or the first AI signal',verified:'AI signal received'},
    lastSignal:time => 'Last signal · '+time, connectionHelp:'How to verify the connection…',
    sendTestRequest:'After approving the hook, send a real request in the tool and open this menu again.',
    refreshHooks:'Update Hook for Connection Checks…',
    legacyHook:'Update the hook to verify this connection',
    tokenUsage:'Tokens', usageToday:(total,output) => `Tokens · today ${total} (output ${output})`,
    usageBefore:value => `Before tracking began · ${value}`,
    usageAfter:(value,output) => `Since tracking began · ${value} (output ${output})`, usageSince:date => `Tracking began · ${date}`,
    usageLoading:'Reading local records…', usageUnsupported:'Usage unavailable', usageTokens:count => `${count} tokens`,
    usageLocal:name => `Reads only token counts from ${name} records on this Mac`, usagePartial:'Some records could not be counted',
    usageExperimental:'Gemini counting is experimental',
    toolTime:(today,total) => `Time together · today ${today} · total ${total}`,
    duration:ms => {
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      return hours ? `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`;
    },
    openError:'Could not open Codex', hookError:'Could not change AI hooks',
    hookSteps:{
      codex:'This applies to local Codex workspaces for this Mac user. Approve the Hamster hooks in Settings → Hooks or Review hooks in the Codex composer.',
      claude:'This adds Hamster hooks to your Claude Code user settings. Open a new Claude Code session and check /hooks.',
      cursor:'This adds Hamster hooks to your local Cursor Agent user settings. Check the Hooks page in Cursor settings.',
      gemini:'This adds Hamster hooks to your Gemini CLI user settings. Restart Gemini CLI and check /hooks list.',
      grok:'This adds Hamster hooks in ~/.grok/hooks/hamster.json. Open a new Grok session and check /hooks.',
    },
    status:(snacks,gifts,next) => `Snacks ${snacks} · Gifts ${gifts} · ${next}`,
    next:minutes => `next reward in about ${minutes} min of work`,
  },
};

const english = {
  knit:'Moss Knit Hat', reader:'Navy Beret', nightcap:'Lavender Nightcap', rain:'Yellow Rain Hat',
  garden:'Floral Bucket Hat', paint:'Terracotta Beret', headphones:'Cream Headphones', bow:'Gingham Bow',
  round:'Round Glasses', oval:'Oval Glasses', half:'Half-Moon Glasses', sage:'Sage Glasses',
  gold:'Gold Frames', star:'Star Sticker', flower:'Flower Sticker', patch:'Bandage',
  'first-gift':'First Gift Heart Sticker',
  rust:'Rust Scarf', cream:'Cream Bandana', lilac:'Lavender Collar', yellow:'Yellow Rain Collar',
  dots:'Polka-Dot Scarf', blue:'Sky Blue Scarf', green:'Green Bow Tie', berry:'Berry Bandana',
  'window-cap':'Window-Stitch Cap', 'pencil-dot':'Pencil Cheek Patch', 'constellation-wrap':'Constellation Scarf',
  'corduroy-work-cap':'Corduroy Work Cap', 'brass-double-brim':'Brass Double-Brim Cap',
  'translucent-rain-brim':'Translucent Rain Hat', 'navy-nightcap':'Navy Star Nightcap',
  'moon-patch':'Crescent Cheek Patch', 'moonlight-glasses':'Moonlight Glasses', 'raindrop-patch':'Raindrop Cheek Patch',
  'pencil-bandana':'Pencil Bandana', 'rain-folded-collar':'Folded Rain Collar', 'ink-bandana':'Ink Bandana',
  'laundry-day':'Laundry Day Hat', toast:'Butter Toast Cheek Sticker',
  bare:'No Accessories', cozy:'Cozy Day', reading:'Reading Time', sleepy:'Sleepy Night',
  rainy:'Rainy Day', gardening:'Gardener', painting:'Painter', music:'Music Time',
};

function readLanguage(value) {
  return value === 'ko' || value === 'en' ? value : 'system';
}

function localize(preference, systemLocale) {
  const language = preference === 'system' ? (systemLocale.toLowerCase().startsWith('ko') ? 'ko' : 'en') : preference;
  return {
    ...menus[language],
    locale:language,
    item:entry => language === 'en' ? (english[entry.id] ?? entry.name) : entry.name,
  };
}

module.exports = {readLanguage, localize};
