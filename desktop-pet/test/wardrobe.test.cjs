const assert = require('node:assert/strict');
const {test} = require('node:test');
const {readWallet, earnSeeds, purchase, ownedOutfit, catalogItems} = require('../wardrobe.cjs');

const items = [
  {id:'old',slot:'hat'},
  {id:'cap',slot:'hat',price:12,releaseAt:'2026-11-09T01:00:00Z'},
  {id:'scarf',slot:'neck',price:36,releaseAt:'2026-11-16T01:00:00Z'},
];
const before = Date.parse('2026-11-09T00:59:59Z');
const released = before + 1000;

test('shows the current and next items and opens purchase exactly at release', () => {
  const wallet = readWallet({seeds:36},items);
  assert.deepEqual(catalogItems(items,wallet,before).map(item => item.state),['owned','upcoming']);
  assert.deepEqual(catalogItems(items,wallet,released).map(item => item.state),['owned','available','upcoming']);
  assert.equal(purchase(wallet,items,['cap'],before).error,'upcoming');
  assert.equal(purchase(wallet,items,['scarf'],released).error,'upcoming');
});

test('purchases are atomic and only owned accessories can be applied', () => {
  const wallet = readWallet({seeds:12},items);
  assert.equal(purchase(wallet,items,['cap','scarf'],released).error,'upcoming');
  assert.equal(wallet.seeds,12);
  const result = purchase(wallet,items,['cap','cap'],released);
  assert.deepEqual(result.wallet.owned,['cap']);
  assert.equal(result.wallet.seeds,0);
  assert.equal(purchase(result.wallet,items,['cap'],released).error,'owned');
  assert.deepEqual(ownedOutfit({hat:'old',neck:'scarf'},items,result.wallet),{hat:'old'});
  assert.deepEqual(ownedOutfit({hat:'cap'},items,result.wallet),{hat:'cap'});
});

test('awards seeds for work since activation, with a daily limit and one starter grant', () => {
  const wallet = readWallet(undefined,items);
  const day = '2026-11-08';
  earnSeeds(wallet,20*60000,day);
  assert.equal(wallet.seeds,24);
  earnSeeds(wallet,10*60000,day);
  assert.equal(wallet.seeds,24);
  earnSeeds(wallet,5*60000,'2026-11-09');
  assert.equal(wallet.seeds,27);
  earnSeeds(wallet,5*60000,day);
  assert.equal(wallet.seeds,27);
});

test('defaults safely from legacy settings and preserves a partial earning block', () => {
  const wallet = readWallet({seeds:-1,owned:['cap','cap','nope','old']},items);
  assert.deepEqual(wallet.owned,['cap']);
  assert.equal(wallet.seeds,0);
  earnSeeds(wallet,4*60000,'2026-11-08');
  earnSeeds(wallet,60000,'2026-11-09');
  assert.equal(wallet.seeds,3);
});

test('custom outfits restore only owned pieces and preserve existing saved entries', () => {
  const {readSavedOutfits,saveNamedOutfit} = require('../wardrobe.cjs');
  const wallet = readWallet({owned:['cap']},items);
  const saved = readSavedOutfits([{name:'  작업복  ',outfit:{hat:'cap',neck:'scarf'}}],items,wallet);
  assert.deepEqual(saved,[{name:'작업복',outfit:{hat:'cap'}}]);
  assert.deepEqual(saveNamedOutfit(saved,{name:'밤 작업',outfit:{neck:'scarf'}},items,wallet),{error:'unownedOutfit'});
  assert.deepEqual(saveNamedOutfit(saved,{name:'작업복',outfit:{}},items,wallet),{error:'duplicateName'});
  const next = saveNamedOutfit(saved,{name:'아침',outfit:{hat:'old'}},items,wallet);
  assert.deepEqual(next.outfits,[{name:'작업복',outfit:{hat:'cap'}},{name:'아침',outfit:{hat:'old'}}]);
  assert.equal(saved.length,1);
});

test('custom outfit names are bounded, unique after normalization, and removable without touching other outfits', () => {
  const {readSavedOutfits,saveNamedOutfit,deleteNamedOutfit} = require('../wardrobe.cjs');
  const wallet = readWallet(undefined,items);
  const saved = readSavedOutfits([{name:'Ｄａｙ',outfit:{}},{name:'day',outfit:{hat:'old'}}],items,wallet);
  assert.deepEqual(saved,[{name:'Day',outfit:{}}]);
  assert.deepEqual(saveNamedOutfit(saved,{name:'  ',outfit:{}},items,wallet),{error:'invalidName'});
  assert.deepEqual(saveNamedOutfit(saved,{name:'a'.repeat(33),outfit:{}},items,wallet),{error:'invalidName'});
  assert.deepEqual(saveNamedOutfit(saved,{name:'day',outfit:{}},items,wallet),{error:'duplicateName'});
  assert.deepEqual(deleteNamedOutfit(saved,'missing'),{error:'invalid'});
  assert.deepEqual(deleteNamedOutfit(saved,'Day'),{outfits:[]});
  assert.equal(saved.length,1);
});

test('the first gift grants the sticker once and stays separate from seeds and purchases', () => {
  const {claimFirstGift,firstGiftItem} = require('../wardrobe.cjs');
  const items = [{id:firstGiftItem,slot:'face',giftOnly:true}];
  const wallet = readWallet({seeds:24},items);
  assert.equal(claimFirstGift(wallet,1199999),undefined);
  assert.equal(purchase(wallet,items,[firstGiftItem],Date.now()).error,'invalid');
  const claimed = claimFirstGift(wallet,1200000);
  assert.equal(claimed.seeds,24);
  assert.deepEqual(ownedOutfit({face:firstGiftItem},items,readWallet(claimed,items)),{face:firstGiftItem});
  assert.equal(claimFirstGift(claimed,2400000),undefined);
});
