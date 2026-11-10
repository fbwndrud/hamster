const test = require('node:test');
const assert = require('node:assert/strict');
const {menuTemplate} = require('../menu-template.cjs');
const {localize} = require('../localization.cjs');

const calls = [];
const action = name => (...args) => calls.push([name,...args]);
const parts = (overrides = {}) => ({
  version:'1.0.11',
  rewards:{snacks:102,gifts:33,pending:false,remaining:5},
  activeCount:0,
  visible:true,
  pat:{shown:true,enabled:true},
  highfive:false,
  firstGift:false,
  triedGift:true,
  update:{supported:true,installing:false,kind:'current'},
  submenus:{wardrobe:[],motion:[],placement:[],ai:[],language:[]},
  actions:Object.fromEntries(['toggleVisible','pat','highfive','openGift','tryGift','installUpdate','retryUpdate','sendFeedback','copyDiagnostics','quit']
    .map(name => [name,action(name)])),
  ...overrides,
});
const labels = template => template.map(item => item.type === 'separator' ? '---' : item.label);

test('the tray menu groups status, actions, dress-up, display, connections and the app', () => {
  const template = menuTemplate(localize('ko','ko-KR'),parts());
  assert.deepEqual(labels(template),[
    '간식 102 · 선물 33 · 다음 보상까지 작업 약 5분',
    '---',
    '쓰다듬기', '첫 선물 입혀보기…',
    '---',
    '꾸미기', '동작 설정',
    '---',
    '화면 하단 위치', '햄스터 숨기기',
    '---',
    'AI 연결', '언어 / Language',
    '---',
    '버전 1.0.11 · 최신 버전', '의견 보내기', '진단 정보 복사', '종료',
  ]);
  assert.equal(template[0].enabled,false);
  assert.equal(template.at(-4).enabled,false);
});

test('empty groups leave no doubled separators and every conditional item stays reachable', () => {
  const quiet = menuTemplate(localize('en','en-US'),parts({pat:{shown:false,enabled:false},triedGift:false,visible:false}));
  assert.deepEqual(labels(quiet).slice(0,4),['Snacks 102 · Gifts 33 · next reward in about 5 min of work','---','Dress Up','Motion Settings']);
  assert.ok(labels(quiet).includes('Show Hamster'));
  assert.ok(!labels(quiet).some((label,index,all) => label === '---' && all[index+1] === '---'));

  const busy = menuTemplate(localize('ko','ko-KR'),parts({activeCount:2,highfive:true,firstGift:true,
    rewards:{snacks:1,gifts:0,pending:true,remaining:0},pat:{shown:true,enabled:false}}));
  assert.deepEqual(labels(busy).slice(0,7),[
    '간식 1 · 선물 0 · 받을 보상이 있어요', 'AI 작업 2개 진행 중', '---',
    '쓰다듬기', '하이파이브', '첫 선물 열기', '첫 선물 입혀보기…',
  ]);
  assert.equal(busy[3].enabled,false);
  calls.length = 0;
  for (const label of ['하이파이브','첫 선물 열기','첫 선물 입혀보기…','햄스터 숨기기','종료']) {
    busy.find(item => item.label === label).click();
  }
  assert.deepEqual(calls.map(([name]) => name),['highfive','openGift','tryGift','toggleVisible','quit']);
});

test('the app line merges the version with each update state and still installs only on click', () => {
  const strings = localize('ko','ko-KR');
  const app = update => menuTemplate(strings,parts({update})).at(-4);
  const release = {version:'1.0.12',bundle:'/updates/1.0.12/Hamster.app'};
  calls.length = 0;
  const install = app({supported:true,installing:false,kind:'available',update:release});
  assert.equal(install.label,'업데이트 설치 · 1.0.11 → 1.0.12…');
  assert.deepEqual(calls,[]);
  install.click();
  assert.deepEqual(calls,[['installUpdate',release]]);
  assert.deepEqual(app({supported:true,installing:true,kind:'available',update:release}),
    {label:'업데이트 설치 중…',enabled:false});
  assert.equal(app({supported:true,installing:false,kind:'checking'}).label,'버전 1.0.11 · 업데이트 확인 중…');
  const retry = app({supported:true,installing:false,kind:'unavailable'});
  assert.equal(retry.label,'버전 1.0.11 · 업데이트 확인 다시 시도');
  retry.click();
  assert.deepEqual(calls.at(-1),['retryUpdate']);
  assert.deepEqual(app({supported:false,installing:false,kind:'checking'}),{label:'버전 1.0.11',enabled:false});
});

test('both languages define every menu string with the same shape', () => {
  const ko = localize('ko','ko-KR');
  const en = localize('en','en-US');
  assert.deepEqual(Object.keys(ko).sort(),Object.keys(en).sort());
  for (const key of Object.keys(ko)) assert.equal(typeof ko[key],typeof en[key],key);
  const english = menuTemplate(en,parts({update:{supported:true,installing:false,kind:'available',
    update:{version:'1.0.12',bundle:'/b'}}}));
  assert.equal(english.at(-4).label,'Install Update · 1.0.11 → 1.0.12…');
});

test('feedback and diagnostics sit beside the version line and call their actions', () => {
  for (const [locale, tag, names] of [['ko','ko-KR',['의견 보내기','진단 정보 복사']],['en','en-US',['Send Feedback','Copy Diagnostics']]]) {
    const template = menuTemplate(localize(locale,tag),parts());
    assert.deepEqual(labels(template).slice(-3),[...names,locale === 'ko' ? '종료' : 'Quit']);
    calls.length = 0;
    for (const name of names) template.find(item => item.label === name).click();
    assert.deepEqual(calls.map(([name]) => name),['sendFeedback','copyDiagnostics']);
  }
});
