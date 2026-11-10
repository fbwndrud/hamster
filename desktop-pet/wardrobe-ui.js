if (wardrobePreview) {
  const panel = document.getElementById('wardrobe-panel');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let snapshot, draft, busy = false, clip = 'breathe', count = 1, still = reduceMotion, tab = 'catalog', slot = 'hat';
  const pageSize = 6;
  let page = 0, browsedItem;
  let requestedGift = new URLSearchParams(location.search).get('tryGift');
  const motionOrder = ['breathe','blink','sniff','look','human','request','work','reply','pat','highfive','snack','gift'];
  const motionIds = Object.keys(clips).sort((a,b) => {
    const rank = id => motionOrder.includes(id) ? motionOrder.indexOf(id) : motionOrder.length;
    return rank(a)-rank(b);
  });
  const messages = {
    ko:{
      title:'햄스터 옷장', intro:'부위별로 장식을 골라 입히고 움직임을 확인하세요.',
      catalog:'새 소식·상점', owned:'내 옷장', saved:'내 차림', hat:'머리', face:'얼굴', neck:'목',
      outfitName:'차림 이름', saveOutfit:'차림 저장', savedEmpty:'저장한 차림이 없어요.',
      savedHelp:'미리 입어본 차림에 이름을 붙여 저장하세요.',
      previewSaved:name => `${name} 차림 입어보기`, deleteSaved:name => `${name} 차림 삭제`, deleteOutfit:'삭제',
      deleteConfirm:name => `‘${name}’ 차림을 삭제할까요?`,
      outfitSaved:'내 차림에 저장했어요.', outfitDeleted:'내 차림에서 삭제했어요.',
      invalidName:'차림 이름을 1~32자로 입력해 주세요.', duplicateName:'이미 저장한 이름이에요. 다른 이름을 입력해 주세요.',
      outfitLimit:'차림은 12개까지 저장할 수 있어요.', unownedOutfit:'보유한 장식으로 꾸민 차림만 저장할 수 있어요.',
      parts:'부위별 장식', empty:'이 부위에 표시할 장식이 없어요.', motions:'동작 미리보기',
      search:'장식 검색', noResults:'검색과 일치하는 장식이 없어요.', wearing:'입어보는 중', inWardrobe:'보유 중',
      pages:'장식 목록 페이지', previous:'이전', next:'다음', noneFound:'0개', range:(visible,total) => `${total}개 중 ${visible}`,
      upcoming:'공개 예정', available:'구매 가능', try:'입어보기', clear:'장식 빼기', reset:'현재 차림으로',
      draft:'입어보는 중', apply:'이 차림 적용', applied:'데스크톱 햄스터에 적용했어요.',
      buy:'미보유 장식 구매', purchased:'장식이 내 옷장에 추가됐어요. 적용하면 실제 햄스터가 입어요.',
      seeds:'씨앗', collect:'씨앗 모으기',
      collectHelp:'맥 입력이나 연결한 AI 작업 5분마다 3개, 기본 적립은 하루 12개까지예요. 첫 누적 20분에는 12개를 더 받고, 끄면 잔액은 그대로예요.',
      seedNext:(earned,minutes) => `오늘 ${earned}/12 · 다음 +3까지 약 ${minutes}분`, seedCap:'오늘 기본 적립 12/12',
      rewardPreview:'간식과 선물은 미리보기에서만 재생돼요.',
      dark:'검은 배경', light:'밝은 배경', still:'정지 보기', tasks:'AI 작업 수',
      breathe:'대기', blink:'눈 깜빡임', sniff:'킁킁', look:'곁눈질', human:'내 작업',
      request:'AI 요청', work:'앞발 작업', reply:'응답', snack:'간식', gift:'선물', pat:'쓰다듬기', highfive:'하이파이브',
      upcomingError:'공개일 이후에 구매할 수 있어요.', insufficient:'씨앗이 부족해요.',
      save:'저장하지 못했어요. 다시 시도해 주세요.', invalid:'이 차림을 적용할 수 없어요.',
      refresh:'옷장 새로고침', desktopSize:'실제 표시 크기 · 168 px',
    },
    en:{
      title:'Hamster Wardrobe', intro:'Choose accessories by body part and see how they move.',
      catalog:'News & Shop', owned:'My Wardrobe', saved:'My Outfits', hat:'Headwear', face:'Face', neck:'Neckwear',
      outfitName:'Outfit name', saveOutfit:'Save outfit', savedEmpty:'You have no saved outfits.',
      savedHelp:'Name and save the outfit you’re trying on.',
      previewSaved:name => `Preview ${name}`, deleteSaved:name => `Delete ${name}`, deleteOutfit:'Delete',
      deleteConfirm:name => `Delete the outfit “${name}”?`,
      outfitSaved:'Saved to My Outfits.', outfitDeleted:'Removed from My Outfits.',
      invalidName:'Enter an outfit name of 1–32 characters.', duplicateName:'An outfit already has that name. Choose another name.',
      outfitLimit:'You can save up to 12 outfits.', unownedOutfit:'You can only save outfits made with accessories you own.',
      parts:'Accessory slots', empty:'No accessories to show for this slot.', motions:'Preview motions',
      search:'Search accessories', noResults:'No accessories match your search.', wearing:'In preview outfit', inWardrobe:'Owned',
      pages:'Accessory list pages', previous:'Previous', next:'Next', noneFound:'0 items', range:(visible,total) => `${visible} of ${total}`,
      upcoming:'Upcoming', available:'Available', try:'Try on', clear:'Remove', reset:'Reset to current outfit',
      draft:'Preview outfit', apply:'Apply outfit', applied:'Outfit applied to your desktop hamster.',
      buy:'Buy unowned accessories', purchased:'Added to your wardrobe. Apply the outfit to wear it on the desktop.',
      seeds:'Seeds', collect:'Collect seeds',
      collectHelp:'Earn 3 seeds per 5 min of Mac input or connected AI work, up to 12 daily, plus 12 once after your first 20 min. Turning it off keeps your balance.',
      seedNext:(earned,minutes) => `Today ${earned}/12 · Next +3 in about ${minutes} min`, seedCap:'Regular seeds today 12/12',
      rewardPreview:'Snack and Gift play here as previews only.',
      dark:'Dark background', light:'Light background', still:'Still view', tasks:'AI tasks',
      breathe:'Idle', blink:'Blink', sniff:'Sniff', look:'Glance', human:'My work',
      request:'AI request', work:'Paw work', reply:'Reply', snack:'Snack', gift:'Gift', pat:'Petting', highfive:'High five',
      upcomingError:'This accessory can be bought after its release.', insufficient:'You need more seeds.',
      save:'Could not save. Please try again.', invalid:'This outfit cannot be applied.',
      refresh:'Reload wardrobe', desktopSize:'Desktop size · 168 px',
    },
  };
  const t = key => messages[snapshot?.locale ?? 'en'][key] ?? key;
  function node(tag,text,attributes = {}) {
    const element = document.createElement(tag);
    element.textContent = text;
    for (const [name,value] of Object.entries(attributes)) element.setAttribute(name,value);
    return element;
  }
  function button(text, handler, attributes) {
    const element = node('button',text,attributes);
    element.type = 'button';
    element.addEventListener('click',handler);
    return element;
  }
  function group(...children) {
    const element = node('div','',{class:'control-row'});
    element.append(...children);
    return element;
  }

  document.body.classList.add('wardrobe-preview');
  panel.hidden = false;
  const heading = node('h1','',{id:'wardrobe-title'});
  const intro = node('p','',{class:'intro'});
  const status = node('p','',{class:'wardrobe-status',role:'status'});
  const list = node('div','',{class:'wardrobe-list',id:'wardrobe-items'});
  const controls = node('div','',{class:'wardrobe-catalog-controls'});
  const search = node('input','',{id:'wardrobe-search',type:'search','aria-controls':list.id});
  const searchLabel = node('label','',{for:search.id});
  const searchRow = node('div','',{class:'wardrobe-search'});
  searchRow.append(searchLabel,search);
  searchRow.hidden = true;
  search.addEventListener('input',resetPicker);
  const previous = button('',() => stepPage(-1),{id:'wardrobe-previous','aria-controls':list.id});
  const next = button('',() => stepPage(1),{id:'wardrobe-next','aria-controls':list.id});
  const range = node('span','',{id:'wardrobe-range',role:'status'});
  const pages = node('nav','',{class:'wardrobe-pages'});
  pages.append(previous,range,next);
  pages.hidden = true;
  const details = node('section','',{id:'wardrobe-item-details',class:'item-details','aria-labelledby':'wardrobe-item-title'});
  details.hidden = true;
  const savedOutfits = node('section','',{class:'saved-outfits','aria-labelledby':'tab-saved'});
  savedOutfits.hidden = true;
  const saveForm = node('form','',{class:'saved-outfit-form','aria-describedby':'saved-outfit-help'});
  const outfitName = node('input','',{id:'saved-outfit-name',type:'text',required:'',autocomplete:'off'});
  const outfitNameLabel = node('label','',{for:outfitName.id});
  const saveOutfit = node('button','',{id:'save-outfit',type:'submit'});
  const saveHelp = node('p','',{id:'saved-outfit-help',class:'item-meta'});
  const savedStatus = node('p','',{class:'saved-outfit-status',role:'status'});
  const savedList = node('ul','',{class:'saved-outfit-list'});
  saveForm.append(outfitNameLabel,group(outfitName,saveOutfit),saveHelp);
  savedOutfits.append(saveForm,savedStatus,savedList);
  outfitName.addEventListener('input',updateSaveButton);
  saveForm.addEventListener('submit',event => {
    event.preventDefault();
    if (!saveOutfit.disabled) change('saveOutfit',{name:outfitName.value,outfit:{...draft}});
  });
  const scene = node('div','',{class:'wardrobe-scene','data-tone':'dark'});
  const background = button('',() => {
    scene.dataset.tone = scene.dataset.tone === 'dark' ? 'light' : 'dark';
    background.textContent = t(scene.dataset.tone === 'dark' ? 'light' : 'dark');
  },{id:'preview-tone'});
  const caption = node('p','',{class:'preview-caption'});
  const previewOptions = group(caption,background);
  previewOptions.classList.add('preview-options');
  const playback = node('div','',{class:'playback'});
  const outfitList = node('div','',{class:'outfit-list'});
  const footer = node('div','');
  const previewControls = node('div','',{class:'wardrobe-preview-controls'});
  const browser = node('section','',{class:'wardrobe-browser','aria-labelledby':'wardrobe-title'});
  const preview = node('section','',{class:'wardrobe-preview-card'});
  scene.append(document.getElementById('stage'));
  previewControls.append(playback,outfitList,footer,status);
  preview.append(scene,previewOptions,previewControls);
  browser.append(heading,intro,controls,searchRow,list,pages,details,savedOutfits);
  panel.append(browser,preview);

  function motion(id = clip) {
    clip = id;
    workCountChanged(id === 'work' ? count : 0);
    show({id,still});
    for (const toggle of playback.querySelectorAll('[data-motion]')) {
      toggle.setAttribute('aria-pressed',String(toggle.dataset.motion === clip));
    }
  }

  function normalizeSearch(value) {
    return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }

  function resetPicker() {
    page = 0;
    browsedItem = undefined;
    renderPicker();
  }

  function stepPage(amount) {
    page += amount;
    browsedItem = undefined;
    renderPicker();
    const pressed = amount < 0 ? previous : next;
    if (pressed.disabled) (amount < 0 ? next : previous).focus();
  }

  function tryItem(item,wear) {
    if (wear) draft[item.slot] = item.id;
    else delete draft[item.slot];
    status.textContent = '';
    outfitChanged(draft);
    render();
  }

  function renderPicker() {
    if (tab === 'saved') return;
    const query = normalizeSearch(search.value);
    const terms = query ? query.split(' ') : [];
    const cards = snapshot.items.filter(item => {
      if (item.slot !== slot || (tab === 'owned' ? item.state !== 'owned' : !item.price)) return false;
      const words = normalizeSearch([item.name,item.id,...(item.searchNames ?? [])].join(' '));
      return terms.every(term => words.includes(term));
    });
    const lastPage = Math.max(0,Math.ceil(cards.length/pageSize)-1);
    page = Math.min(lastPage,Math.max(0,page));
    const start = page*pageSize;
    const visible = cards.slice(start,start+pageSize);
    const focused = visible.find(item => item.id === browsedItem) ??
      visible.find(item => draft[item.slot] === item.id) ?? visible[0];
    browsedItem = focused?.id;

    const focusId = list.contains(document.activeElement) ? document.activeElement.id : '';
    list.replaceChildren(...visible.map(item => {
      const equipped = draft[item.slot] === item.id;
      const tile = button('',() => {
        browsedItem = item.id;
        if (equipped) renderPicker();
        else tryItem(item,true);
      },
        {id:'item-'+item.id,class:'accessory-card','data-slot':item.slot,
          'aria-label':equipped ? item.name+' · '+t('wearing') : t('try')+' · '+item.name,
          'aria-pressed':String(equipped),'aria-controls':details.id});
      const thumbnail = node('span','',{class:'item-thumbnail','aria-hidden':'true'});
      thumbnail.append(node('img','',{src:item.src,alt:''}));
      tile.append(thumbnail,node('span',item.name,{class:'item-name'}));
      if (equipped) tile.append(node('span','✓',{class:'item-equipped','aria-hidden':'true'}));
      return tile;
    }));
    if (!visible.length) list.append(node('p',t(query ? 'noResults' : 'empty'),{class:'item-meta picker-empty'}));
    if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});

    searchRow.hidden = false;
    searchLabel.textContent = t('search');
    pages.hidden = false;
    pages.setAttribute('aria-label',t('pages'));
    previous.textContent = t('previous');
    next.textContent = t('next');
    previous.disabled = page === 0;
    next.disabled = page === lastPage;
    const visibleRange = visible.length === 1 ? start+1 : `${start+1}–${start+visible.length}`;
    const pageRange = cards.length ? t('range')(visibleRange,cards.length) : t('noneFound');
    if (range.textContent !== pageRange) range.textContent = pageRange;

    details.hidden = !focused;
    if (!focused) return;
    const equipped = draft[focused.slot] === focused.id;
    const release = focused.state === 'upcoming' ? ' · '+new Date(focused.releaseAt).toLocaleDateString(snapshot.locale) : '';
    const price = focused.price ? ' · '+focused.price+' '+t('seeds') : '';
    const action = button(t(equipped ? 'clear' : 'try'),() => tryItem(focused,!equipped),
      {id:'try-accessory','aria-label':t(equipped ? 'clear' : 'try')+' · '+focused.name});
    const detailsHeading = node('div','',{class:'item-details-heading'});
    detailsHeading.append(node('h2',focused.name,{id:'wardrobe-item-title'}),action);
    details.replaceChildren(detailsHeading,node('p',t(focused.state === 'owned' ? 'inWardrobe' : focused.state)+release+price,
      {class:'item-meta'}));
    if (focused.description) details.append(node('p',focused.description,{class:'item-description'}));
  }

  function sameOutfit(first,second) {
    const entries = Object.entries(first);
    return entries.length === Object.keys(second).length && entries.every(([part,id]) => second[part] === id);
  }

  function updateSaveButton() {
    saveOutfit.disabled = busy || !outfitName.value.trim() ||
      Object.entries(draft).some(([part,id]) => !snapshot.items.some(item =>
        item.slot === part && item.id === id && item.state === 'owned'));
  }

  function renderSavedOutfits(unowned) {
    const saved = snapshot.savedOutfits ?? [];
    outfitNameLabel.textContent = t('outfitName');
    saveOutfit.textContent = t('saveOutfit');
    saveHelp.textContent = t(unowned.length ? 'unownedOutfit' : 'savedHelp');
    updateSaveButton();
    savedList.replaceChildren(...saved.map(({name,outfit},index) => {
      const row = node('li','',{class:'saved-outfit'});
      const previewOutfit = button(name,() => {
        draft = {...outfit};
        status.textContent = '';
        savedStatus.textContent = '';
        outfitChanged(draft);
        render();
      },{id:'preview-saved-outfit-'+index,'aria-label':t('previewSaved')(name),'aria-pressed':String(sameOutfit(draft,outfit))});
      const remove = button(t('deleteOutfit'),() => {
        if (window.confirm(t('deleteConfirm')(name))) change('deleteOutfit',name);
      },{id:'delete-saved-outfit-'+index,'aria-label':t('deleteSaved')(name)});
      row.append(previewOutfit,remove);
      return row;
    }));
    if (!saved.length) savedList.append(node('li',t('savedEmpty'),{class:'item-meta'}));
  }

  function render() {
    const focusId = panel.contains(document.activeElement) ? document.activeElement.id : '';
    document.documentElement.lang = snapshot.locale;
    document.title = heading.textContent = t('title');
    intro.textContent = t('intro');
    caption.textContent = t('desktopSize');
    background.textContent = t(scene.dataset.tone === 'dark' ? 'light' : 'dark');

    const collection = node('input','',{type:'checkbox',id:'collect-seeds','aria-describedby':'seed-collection-help'});
    collection.checked = snapshot.seedCollection;
    collection.disabled = busy;
    collection.addEventListener('change',() => change('collect',collection.checked));
    const label = node('label','',{class:'collect-option'});
    label.append(collection,document.createTextNode(t('collect')));
    const progress = snapshot.seedProgress;
    const nextSeeds = snapshot.seedCollection && progress
      ? ' '+(progress.nextMinutes === null ? t('seedCap') : t('seedNext')(progress.earnedToday,progress.nextMinutes)) : '';
    const slots = group(...Object.keys(wardrobe.slots).map(id => button(t(id),() => {
      slot = id;
      page = 0;
      browsedItem = undefined;
      render();
    },{id:'slot-'+id,'data-slot-filter':id,'aria-pressed':String(slot === id)})));
    slots.setAttribute('role','group');
    slots.setAttribute('aria-label',t('parts'));
    const tabs = group(...['catalog','owned','saved'].map(id => button(t(id),() => {
      tab = id;
      page = 0;
      browsedItem = undefined;
      render();
    },{id:'tab-'+id,'aria-pressed':String(tab === id)})));
    tabs.classList.add('wardrobe-tabs');
    controls.replaceChildren(group(label,node('strong',snapshot.seeds+' '+t('seeds'),{class:'seed-balance'})),
      node('p',t('collectHelp')+nextSeeds,{id:'seed-collection-help',class:'item-meta seed-collection-help'}),tabs);
    const savedTab = tab === 'saved';
    browser.dataset.tab = tab;
    savedOutfits.hidden = !savedTab;
    list.hidden = savedTab;
    if (savedTab) {
      searchRow.hidden = pages.hidden = details.hidden = true;
    } else {
      controls.append(slots);
      renderPicker();
    }

    const stillToggle = node('input','',{type:'checkbox',id:'still-view'});
    stillToggle.checked = still;
    stillToggle.addEventListener('change',() => {still = stillToggle.checked; motion();});
    const taskSelect = node('select','',{id:'preview-task-count'});
    for (const n of [1,2,3]) taskSelect.append(node('option',String(n),{value:String(n)}));
    taskSelect.value = String(count);
    taskSelect.addEventListener('change',() => {count = Number(taskSelect.value); motion('work');});
    const stillLabel = node('label','',{class:'collect-option'});
    stillLabel.append(stillToggle,document.createTextNode(t('still')));
    const taskLabel = node('label',t('tasks')+' ',{class:'collect-option'});
    taskLabel.append(taskSelect);
    const motionButtons = group(...motionIds.map(id => button(t(id),() => motion(id),
      {id:'motion-'+id,'data-motion':id,'aria-pressed':String(clip === id),
        ...(['snack','gift'].includes(id) ? {'aria-describedby':'reward-preview-help'} : {})})));
    motionButtons.setAttribute('role','group');
    motionButtons.setAttribute('aria-label',t('motions'));
    playback.replaceChildren(node('strong',t('motions')),motionButtons,group(stillLabel,taskLabel),
      node('p',t('rewardPreview'),{id:'reward-preview-help',class:'item-meta'}));

    const selected = Object.entries(draft).map(([slot,id]) => snapshot.items.find(item => item.slot === slot && item.id === id))
      .filter(Boolean);
    const unowned = selected.filter(item => item.state !== 'owned');
    const total = unowned.reduce((sum,item) => sum+item.price,0);
    const locked = unowned.some(item => item.state === 'upcoming');
    if (savedTab) renderSavedOutfits(unowned);
    outfitList.replaceChildren(node('strong',t('draft')));
    for (const item of selected) {
      const remove = button('×',() => {
        delete draft[item.slot];
        outfitChanged(draft);
        render();
      },{id:'remove-'+item.slot,'aria-label':t('clear')+' · '+item.name});
      outfitList.append(group(node('span',item.name),remove));
    }
    const buy = button(t('buy')+' · '+total+' '+t('seeds'),() => change('buy',unowned.map(item => item.id)),{id:'buy'});
    buy.disabled = busy || locked || total > snapshot.seeds;
    const apply = button(t('apply'),() => change('apply',draft),{id:'apply',class:'primary'});
    apply.disabled = busy || unowned.length > 0 || sameOutfit(draft,snapshot.outfit);
    footer.replaceChildren(group(
      button(t('reset'),() => {draft = {...snapshot.outfit}; outfitChanged(draft); status.textContent = ''; render();},
        {id:'reset-outfit'}),
      apply,
    ));
    if (unowned.length) {
      footer.append(buy);
      if (locked || total > snapshot.seeds) footer.append(node('p',t(locked ? 'upcomingError' : 'insufficient'),{class:'item-meta'}));
    }
    if (focusId) {
      const focusTarget = document.getElementById(focusId);
      const fallback = savedTab ? outfitName : document.getElementById('reset-outfit');
      (focusTarget && !focusTarget.disabled ? focusTarget : fallback)?.focus({preventScroll:true});
    }
  }

  async function change(action,payload) {
    if (busy) return;
    busy = true;
    const feedback = action === 'saveOutfit' || action === 'deleteOutfit' ? savedStatus : status;
    if (action !== 'read') feedback.textContent = '';
    try {
      const response = await window.hamster.wardrobe(action,payload);
      if (response.error) {
        feedback.textContent = t(response.error === 'upcoming' ? 'upcomingError' : response.error);
      } else {
        snapshot = response.snapshot;
        draft ??= {...snapshot.outfit};
        if (requestedGift) {
          const gift = snapshot.items.find(item => item.id === requestedGift && item.state === 'owned');
          requestedGift = undefined;
          if (gift) {
            tab = 'owned';
            slot = gift.slot;
            search.value = '';
            const items = snapshot.items.filter(item => item.slot === slot && item.state === 'owned');
            page = Math.floor(items.indexOf(gift)/pageSize);
            browsedItem = gift.id;
            draft[gift.slot] = gift.id;
          }
        }
        outfitChanged(draft);
        if (action === 'apply') feedback.textContent = t('applied');
        if (action === 'buy') feedback.textContent = t('purchased');
        if (action === 'saveOutfit') {
          if (outfitName.value === payload.name) outfitName.value = '';
          feedback.textContent = t('outfitSaved');
        }
        if (action === 'deleteOutfit') feedback.textContent = t('outfitDeleted');
      }
    } catch {
      feedback.textContent = t('save');
    } finally {
      busy = false;
      if (snapshot) render();
      else controls.replaceChildren(button(t('refresh'),() => start(),{id:'reload-wardrobe'}));
    }
  }

  async function start() {
    await change('read');
    if (snapshot) motion();
  }
  window.hamster.onWardrobeChanged(() => {if (!busy) change('read');});
  window.hamster.onTryGift(id => {
    requestedGift = id;
    if (!busy) change('read');
  });
  window.addEventListener('focus',() => {if (!busy) change('read');});
  setInterval(() => {if (!document.hidden && !busy) change('read');},30000);
  start();
}
