const {rewardInterval} = require('./progress.cjs');

const weekMs = 7*24*60*60*1000;
const starterMs = 4*rewardInterval;
const firstGiftItem = 'first-gift';
const dailyLimit = 12;
const outfitLimit = 12;

function nonnegative(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function readWallet(saved, items) {
  const paid = new Set(items.filter(item => item.price || item.giftOnly).map(item => item.id));
  const owned = Array.isArray(saved?.owned) ? saved.owned.filter(id => paid.has(id)) : [];
  return {
    seeds:nonnegative(saved?.seeds),
    owned:[...new Set(owned)],
    day:typeof saved?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.day) ? saved.day : '',
    earnedToday:Math.min(dailyLimit,nonnegative(saved?.earnedToday)),
    partialMs:Math.min(rewardInterval-1,nonnegative(saved?.partialMs)),
    starterWorkMs:Math.min(starterMs,nonnegative(saved?.starterWorkMs)),
  };
}

function earnSeeds(wallet, elapsed, day) {
  if (elapsed <= 0 || day < wallet.day) return false;
  if (day !== wallet.day) {
    wallet.day = day;
    wallet.earnedToday = 0;
  }
  const previous = wallet.seeds;
  if (wallet.starterWorkMs < starterMs) {
    wallet.starterWorkMs = Math.min(starterMs,wallet.starterWorkMs+elapsed);
    if (wallet.starterWorkMs === starterMs) wallet.seeds += 12;
  }
  if (wallet.earnedToday < dailyLimit) {
    const total = wallet.partialMs+elapsed;
    const earned = Math.min(dailyLimit-wallet.earnedToday,3*Math.floor(total/rewardInterval));
    wallet.earnedToday += earned;
    wallet.seeds += earned;
    wallet.partialMs = wallet.earnedToday === dailyLimit ? 0 : total%rewardInterval;
  }
  return previous !== wallet.seeds;
}

function canWear(item, wallet) {
  return (!item.price && !item.giftOnly) || wallet.owned.includes(item.id);
}

function canClaimFirstGift(wallet, workMs) {
  return workMs >= starterMs && !wallet.owned.includes(firstGiftItem);
}

function claimFirstGift(wallet, workMs) {
  if (canClaimFirstGift(wallet,workMs)) return {...wallet,owned:[...wallet.owned,firstGiftItem]};
}

function ownedOutfit(selection, items, wallet) {
  return Object.fromEntries(items
    .filter(item => selection?.[item.slot] === item.id && canWear(item,wallet))
    .map(item => [item.slot,item.id]));
}

function outfitName(value) {
  if (typeof value !== 'string') return;
  const name = value.normalize('NFKC').trim();
  if (name && [...name].length <= 32 && !/\p{Cc}/u.test(name)) return name;
}

function readSavedOutfits(saved, items, wallet) {
  if (!Array.isArray(saved)) return [];
  const names = new Set();
  const outfits = [];
  for (const entry of saved) {
    const name = outfitName(entry?.name);
    if (!name || names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    outfits.push({name,outfit:ownedOutfit(entry.outfit,items,wallet)});
    if (outfits.length === outfitLimit) break;
  }
  return outfits;
}

function saveNamedOutfit(saved, payload, items, wallet) {
  const name = outfitName(payload?.name);
  if (!name) return {error:'invalidName'};
  if (saved.some(entry => entry.name.toLowerCase() === name.toLowerCase())) return {error:'duplicateName'};
  if (saved.length >= outfitLimit) return {error:'outfitLimit'};
  const selection = payload.outfit;
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return {error:'invalid'};
  const outfit = ownedOutfit(selection,items,wallet);
  if (Object.keys(selection).length !== Object.keys(outfit).length) return {error:'unownedOutfit'};
  return {outfits:[...saved,{name,outfit}]};
}

function deleteNamedOutfit(saved, name) {
  const outfits = saved.filter(entry => entry.name !== name);
  return outfits.length === saved.length ? {error:'invalid'} : {outfits};
}

function seedProgress(wallet, day) {
  const earnedToday = wallet.day === day ? wallet.earnedToday : 0;
  return {earnedToday,nextMinutes:earnedToday === dailyLimit ? null : Math.ceil((rewardInterval-wallet.partialMs)/60000)};
}

function catalogItems(items, wallet, now) {
  return items
    .filter(item => canWear(item,wallet) || Date.parse(item.releaseAt) <= now+weekMs)
    .map(item => ({
      ...item,
      state:canWear(item,wallet) ? 'owned' : Date.parse(item.releaseAt) > now ? 'upcoming' : 'available',
    }));
}

function purchase(wallet, items, selection, now) {
  if (!Array.isArray(selection) || !selection.length || selection.length > 3) return {error:'invalid'};
  const wanted = [...new Set(selection)].map(id => items.find(item => item.id === id));
  if (wanted.some(item => !item || item.giftOnly)) return {error:'invalid'};
  if (wanted.some(item => canWear(item,wallet))) return {error:'owned'};
  if (wanted.some(item => Date.parse(item.releaseAt) > now)) return {error:'upcoming'};
  const price = wanted.reduce((total,item) => total+item.price,0);
  if (price > wallet.seeds) return {error:'insufficient'};
  return {wallet:{...wallet,seeds:wallet.seeds-price,owned:[...wallet.owned,...wanted.map(item => item.id)]}};
}

module.exports = {
  readWallet,earnSeeds,canWear,ownedOutfit,catalogItems,purchase,firstGiftItem,canClaimFirstGift,claimFirstGift,
  readSavedOutfits,saveNamedOutfit,deleteNamedOutfit,seedProgress,
};
