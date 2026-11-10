const {app, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage, powerMonitor, screen, shell} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const {createHash} = require('node:crypto');
const {createMotionState, readMotionSettings} = require('./motion-state.cjs');
const {rewardInterval, humanIdleLimit, sampleWork, nextReward, readProgress} = require('./progress.cjs');
const {readLanguage, localize} = require('./localization.cjs');
const {readPlacement, bottomPosition} = require('./placement.cjs');
const {installHooks,removeHooks,installed,bridgeCurrent} = require('./codex-install.cjs');
const {createConnectionStatus} = require('./connection-status.cjs');
const {createCodexUsage} = require('./codex-usage.cjs');
const {codexTerminals,claudeTerminals} = require('./codex-lifecycle.cjs');
const {readWallet,earnSeeds,canWear,ownedOutfit,catalogItems,purchase,readSavedOutfits,saveNamedOutfit,deleteNamedOutfit,
  seedProgress,firstGiftItem,canClaimFirstGift,claimFirstGift} = require('./wardrobe.cjs');
const {findLocalUpdate,pickUpdate,createUpdateMonitor,launchUpdate,updateInProgress} = require('./updater.cjs');
const {checkRemote,fetchUpdate} = require('./remote-update.cjs');
const {readHighest} = require('./update-manifest.cjs');
const {feedbackUrl} = require('./distribution.cjs');
const {createErrorLog,diagnosticsText} = require('./diagnostics.cjs');
const {menuTemplate} = require('./menu-template.cjs');
const {version} = require('./package.json');
require('./assets/wardrobe.js');
require('./assets/clips.js');
const {wardrobe, clips} = globalThis.Hamster;

const directory = '/private/tmp/codex-hamster-' + process.getuid();
const socketPath = path.join(directory, 'events.sock');
const statePath = path.join(directory, 'status.json');
const size = 168;
const interactionZones = {pat:[57,58,54,44],highfive:[100,113,44,44],gift:[120,11,44,44]};
const updateScanInterval = 30_000;
const remoteCheckInterval = 12 * 60 * 60_000;
const codexHome = path.resolve(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'));
const claudeHome = path.resolve(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(),'.claude'));
const hookProviders = [
  {id:'codex',name:'Codex',directory:codexHome},
  {id:'claude',name:'Claude Code',directory:claudeHome},
  {id:'cursor',name:'Cursor Agent',directory:path.join(os.homedir(),'.cursor')},
  {id:'gemini',name:'Gemini CLI',directory:path.join(process.env.GEMINI_CLI_HOME || os.homedir(),'.gemini')},
];
const hookExecutable = path.join(__dirname,'codex-hook-v2');
const installedBundle = path.resolve(__dirname,'../../..');
const updateExecutable = path.join(__dirname,'update-mac');
const canUpdate = path.extname(installedBundle) === '.app' && fs.existsSync(updateExecutable);
const readyPrefix = '--hamster-update-ready=';
let updateReady = process.argv.find(arg => arg.startsWith(readyPrefix))?.slice(readyPrefix.length);

fs.mkdirSync(directory, {mode:0o700, recursive:true});
const stat = fs.lstatSync(directory);
if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o077)) {
  throw new Error('Hamster runtime directory must be private and owned by this user.');
}
app.setPath('userData', path.join(directory,'electron'));
app.setName('Hamster');
if ((canUpdate && updateInProgress(installedBundle,updateReady)) || !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win, wardrobeWindow, tray, server, ticker, updateTicker, remoteTicker, usageTicker, lifecycleTicker;
  let listening = false;
  let painted;
  let paintedRevision;
  let revision = 0;
  let interaction = {revision:0};
  let interactionWindow, interactionLoaded = false;
  let giftUntil = 0;
  let workCount = 0;
  let installingUpdate = false;
  let remoteUpdate;
  let suspended = false;
  let screenLocked = false;
  let reconcilingTurns = false;
  let lastSample = 0;
  let lastSave = 0;
  const history = [];
  const connections = createConnectionStatus(hookProviders.map(provider => provider.id));
  const errors = createErrorLog();
  const settingsDir = path.join(app.getPath('appData'), 'Codex Hamster');
  const localUpdatesMarker = path.join(settingsDir,'local-updates');
  const updates = createUpdateMonitor(() => pickUpdate(() => findLocalUpdate(installedBundle,version,localUpdatesMarker),remoteUpdate),syncUpdateIndicator);
  const settingsPath = path.join(settingsDir, 'settings.json');
  const saved = loadSettings();
  let codexUsageStarts = Object.fromEntries(Object.entries(saved.codexUsageStarts ?? {}).filter(([key,time]) =>
    /^[a-f0-9]{64}$/.test(key) && Number.isSafeInteger(time) && time > 0 && time <= 8_640_000_000_000_000));
  let usageHomeKey, codexUsageSince = null;
  let usageReader;
  let codexUsage = {state:'unsupported',before:null,after:null};
  const progress = readProgress(saved.progress);
  let wallet = readWallet(saved.wallet,wardrobe.items);
  let outfit = ownedOutfit(saved.outfit,wardrobe.items,wallet);
  let savedOutfits = readSavedOutfits(saved.savedOutfits,wardrobe.items,wallet);
  let seedCollection = saved.seedCollection === true;
  let highestManifest = readHighest(saved.highestManifest);
  const dayFormat = new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'2-digit',day:'2-digit'});
  let motionSettings = readMotionSettings(saved.motionSettings);
  let language = readLanguage(saved.language);
  let placement = readPlacement(saved.placement);

  function reportError(scope, error) {
    const code = error.code || error.name;
    console.error('Hamster '+scope+':',code);
    errors.note(scope,code);
  }

  function loadSettings() {
    try {
      return JSON.parse(fs.readFileSync(settingsPath,'utf8')) ?? {};
    } catch (error) {
      if (error.code !== 'ENOENT') reportError('settings read',error);
      return {};
    }
  }

  function saveSettings(changes = {}) {
    try {
      fs.mkdirSync(settingsDir,{recursive:true,mode:0o700});
      const temporary = settingsPath + '.tmp';
      fs.writeFileSync(temporary,JSON.stringify({progress,outfit,savedOutfits,wallet,seedCollection,motionSettings,language,placement,codexUsageStarts,highestManifest,...changes})+'\n',{mode:0o600});
      fs.renameSync(temporary,settingsPath);
      lastSave = performance.now();
      return true;
    } catch (error) {
      reportError('settings write',error);
      return false;
    }
  }

  function send(channel, value) {
    if (win && !win.webContents.isLoading()) win.webContents.send(channel,value);
  }

  function setOutfit(selection) {
    const next = ownedOutfit(selection,wardrobe.items,wallet);
    if (!saveSettings({outfit:next})) return false;
    outfit = next;
    send('hamster:outfit',outfit);
    notifyWardrobe();
    status();
    return true;
  }

  function wardrobeSnapshot() {
    const strings = text();
    const english = localize('en','en');
    return {outfit,savedOutfits,seeds:wallet.seeds,seedCollection,locale:strings.locale,
      seedProgress:seedProgress(wallet,dayFormat.format(new Date())),
      items:catalogItems(wardrobe.items,wallet,Date.now()).map(item => ({
        id:item.id,slot:item.slot,src:item.src,name:strings.item(item),searchNames:[item.name,english.item(item)],
        state:item.state,price:item.price,
        releaseAt:item.releaseAt,description:strings.locale === 'en' ? item.descriptionEn : item.description,
      }))};
  }

  function notifyWardrobe() {
    if (wardrobeWindow && !wardrobeWindow.webContents.isLoading()) {
      wardrobeWindow.webContents.send('hamster:wardrobe-changed');
    }
  }

  function openWardrobe(tryGift = false) {
    if (wardrobeWindow) {
      wardrobeWindow.show();
      if (tryGift) {
        const preview = wardrobeWindow.webContents;
        if (preview.isLoading()) preview.once('did-finish-load',() => preview.send('hamster:try-gift',firstGiftItem));
        else preview.send('hamster:try-gift',firstGiftItem);
      }
      return;
    }
    const preview = new BrowserWindow({width:760,height:590,minWidth:670,minHeight:500,show:false,
      title:text().openWardrobe,backgroundColor:'#181615',
      webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,
                      contextIsolation:true,nodeIntegration:false}});
    wardrobeWindow = preview;
    preview.webContents.on('will-navigate',event => event.preventDefault());
    preview.webContents.setWindowOpenHandler(() => ({action:'deny'}));
    preview.once('closed', () => {wardrobeWindow = undefined;});
    preview.once('ready-to-show', () => preview.show());
    preview.loadFile(path.join(__dirname,'overlay.html'),{query:{wardrobe:'1',...(tryGift ? {tryGift:firstGiftItem} : {})}}).catch(error => {
      reportError('wardrobe',error);
      preview.close();
    });
  }

  function setMotionSettings(patch) {
    motionSettings = readMotionSettings({...motionSettings,...patch});
    state.configure(motionSettings);
    saveSettings();
    status();
  }

  function text() {
    return localize(language,app.getPreferredSystemLanguages()[0] ?? 'en');
  }

  function setLanguage(value) {
    language = readLanguage(value);
    syncUpdateIndicator();
    saveSettings();
    notifyWardrobe();
    status();
  }

  async function openCodexSettings() {
    try {
      await shell.openExternal('codex://settings');
    } catch (error) {
      dialog.showErrorBox(text().openError,error.message);
    }
  }

  async function connectTool({id,name,directory},refresh = false) {
    const strings = text();
    const {response} = await dialog.showMessageBox({
      type:'info',message:refresh ? strings.refreshHooks : strings.installHooks(name),detail:strings.hookSteps[id],
      buttons:[strings.install,strings.cancel],defaultId:0,cancelId:1,
    });
    if (response !== 0) return;
    try {
      installHooks(path.resolve(directory),hookExecutable,id);
      connections.reset(id);
      if (id === 'codex') {
        refreshCodexUsage();
        await openCodexSettings();
      }
    } catch (error) {
      dialog.showErrorBox(strings.hookError,error.message);
    }
  }

  function disconnectTool({id,directory}) {
    try {
      removeHooks(path.resolve(directory),id);
      connections.reset(id);
      if (id === 'codex') stopCodexUsage();
    } catch (error) {
      dialog.showErrorBox(text().hookError,error.message);
    }
  }

  function stopCodexUsage() {
    usageReader?.dispose();
    usageReader = undefined;
    codexUsage = {state:'unsupported',before:null,after:null};
  }

  function refreshCodexUsage() {
    let home;
    try {
      if (!installed(codexHome,'codex')) {
        stopCodexUsage();
        return;
      }
      home = fs.realpathSync(codexHome);
    } catch {
      stopCodexUsage();
      return;
    }
    const key = createHash('sha256').update(home).digest('hex');
    if (usageHomeKey !== key) {
      stopCodexUsage();
      usageHomeKey = key;
      codexUsageSince = codexUsageStarts[key] ?? null;
    }
    if (codexUsageSince === null) {
      const startedAt = Date.now();
      const nextStarts = {...codexUsageStarts,[key]:startedAt};
      if (!saveSettings({codexUsageStarts:nextStarts})) return;
      codexUsageStarts = nextStarts;
      codexUsageSince = startedAt;
    }
    if (!usageReader) {
      codexUsage = {state:'loading',before:null,after:null};
      usageReader = createCodexUsage({home,cachePath:path.join(settingsDir,`codex-usage-${key}.json`),
        onChange:result => {codexUsage = result;}});
    }
    usageReader.refresh(codexUsageSince);
  }

  function usageMenu(provider, configured, strings) {
    const supported = provider === 'codex' && configured;
    const describe = amount => {
      if (!supported || !Number.isSafeInteger(amount) || amount < 0) {
        return supported && codexUsage.state === 'loading' ? strings.usageLoading : strings.usageUnsupported;
      }
      return strings.usageTokens(new Intl.NumberFormat(strings.locale).format(amount));
    };
    const rows = [
      {label:strings.usageBefore(describe(codexUsage.before)),enabled:false},
      {label:strings.usageAfter(describe(codexUsage.after)),enabled:false},
    ];
    if (supported && codexUsageSince !== null) {
      rows.push({label:strings.usageSince(new Date(codexUsageSince).toLocaleString(strings.locale)),enabled:false});
      rows.push({label:strings.usageLocal,enabled:false});
      if (codexUsage.partial) rows.push({label:strings.usagePartial,enabled:false});
    }
    return {label:strings.tokenUsage,submenu:rows};
  }

  function providerMenu(provider, strings) {
    let configured = false;
    let current = false;
    try {
      const providerPath = path.resolve(provider.directory);
      configured = installed(providerPath,provider.id);
      current = configured && bridgeCurrent(providerPath,provider.id);
    } catch {
      // Installing will surface the config error without changing the file.
    }
    const connection = connections.read(provider.id,configured);
    const submenu = [
      {label:configured && !current ? strings.legacyHook : strings.connectionState[connection.state],enabled:false},
      {label:configured ? strings.hooksInstalled : strings.installHooks(provider.name),
       enabled:!configured && fs.existsSync(hookExecutable),click:() => connectTool(provider)},
      {label:strings.removeHooks,enabled:configured,click:() => disconnectTool(provider)},
    ];
    if (configured && !current) submenu.push({label:strings.refreshHooks,
      enabled:fs.existsSync(hookExecutable),click:() => connectTool(provider,true)});
    if (current && connection.receivedAt !== null) submenu.splice(1,0,{
      label:strings.lastSignal(new Date(connection.receivedAt).toLocaleString(strings.locale)),enabled:false,
    });
    if (current && connection.state === 'waiting') submenu.push({label:strings.connectionHelp,
      click:() => dialog.showMessageBox({type:'info',message:strings.connectionState.waiting,
        detail:strings.hookSteps[provider.id]+'\n\n'+strings.sendTestRequest})});
    if (provider.id === 'codex') submenu.push({label:strings.codexSettings,click:openCodexSettings});
    submenu.push(usageMenu(provider.id,configured,strings));
    return {label:provider.name,submenu};
  }

  function menu() {
    const strings = text();
    const earnedGifts = Math.floor(progress.shown / 4);
    const pending = nextReward(progress);
    const remaining = Math.ceil(((progress.shown + 1) * rewardInterval - progress.workMs) / 60000);
    const slots = Object.keys(wardrobe.slots).map(slot => ({
      label:strings[slot],
      submenu: [
        {label:strings.none,type:'radio',checked:!outfit[slot],click:() => setOutfit({...outfit,[slot]:''})},
        ...wardrobe.items.filter(item => item.slot === slot && canWear(item,wallet)).map(item => ({
          label:strings.item(item),type:'radio',checked:outfit[slot] === item.id,
          click:() => setOutfit({...outfit,[slot]:item.id}),
        })),
      ],
    }));
    const cadenceItems = ['quiet','normal','lively'].map(cadence => ({
      label:strings[cadence],type:'radio',checked:motionSettings.cadence === cadence,click:() => setMotionSettings({cadence}),
    }));
    const toggleItems = ['ai','human','ambient','rewards','interaction'].map(key => ({
      label:key === 'ai' ? strings.aiReactions : strings[key],type:'checkbox',checked:motionSettings[key],click:item => setMotionSettings({[key]:item.checked}),
    }));
    const languages = [['system',strings.system],['ko','한국어'],['en','English']].map(([value,label]) => ({
      label,type:'radio',checked:language === value,click:() => setLanguage(value),
    }));
    const positions = ['left','center','right'].map(value => ({
      label:strings[value],type:'radio',checked:placement === value,click:() => {
        placement = value;
        position();
        saveSettings();
      },
    }));
    return Menu.buildFromTemplate(menuTemplate(strings,{
      version,
      rewards:{snacks:progress.shown-earnedGifts,gifts:earnedGifts,pending,remaining},
      activeCount:state.activeCount,
      visible:win.isVisible(),
      pat:{shown:motionSettings.interaction,enabled:win.isVisible() && state.canPat},
      highfive:interaction.action === 'highfive',
      firstGift:canClaimFirstGift(wallet,progress.workMs),
      triedGift:wallet.owned.includes(firstGiftItem),
      update:{supported:canUpdate,installing:installingUpdate,...updates.state},
      submenus:{
        wardrobe:[
          {label:strings.openWardrobe,click:() => openWardrobe()},
          {type:'separator'},
          ...slots,
          {type:'separator'},
          {label:strings.preset,submenu:[
            ...wardrobe.presets.map(preset => ({label:strings.item(preset),click:() => setOutfit(preset.items)})),
            ...(savedOutfits.length ? [{type:'separator'},...savedOutfits.map(preset => ({
              label:preset.name,click:() => setOutfit(preset.outfit),
            }))] : []),
          ]},
        ],
        motion:[
          {label:strings.frequency,submenu:cadenceItems},
          {type:'separator'},
          ...toggleItems,
        ],
        placement:positions,
        ai:hookProviders.map(provider => providerMenu(provider,strings)),
        language:languages,
      },
      actions:{
        toggleVisible:() => {
          if (win.isVisible()) win.hide();
          else win.showInactive();
          status();
        },
        pat:() => state.interact('pat'),
        highfive:() => state.interact('highfive'),
        openGift:openFirstGift,
        tryGift:() => openWardrobe(true),
        installUpdate:installAvailableUpdate,
        retryUpdate:refreshUpdates,
        sendFeedback,
        copyDiagnostics,
        quit:() => app.quit(),
      },
    }));
  }

  function syncUpdateIndicator() {
    if (!tray || tray.isDestroyed()) return;
    const strings = text();
    const available = canUpdate && updates.state.update;
    tray.setTitle(available ? ' •' : '');
    tray.setToolTip(available ? strings.updateAvailable(available.version) : strings.name);
  }

  function refreshUpdates() {
    if (canUpdate && !installingUpdate) return updates.refresh();
  }

  async function checkRemoteUpdate() {
    if (!canUpdate || installingUpdate) return;
    try {
      remoteUpdate = await checkRemote(version,{highest:highestManifest,remember:accepted => {
        highestManifest = accepted;
        saveSettings();
      }});
    } catch (error) {
      remoteUpdate = undefined;
      reportError('update check',error);
    }
    return refreshUpdates();
  }

  async function sendFeedback() {
    try {
      await shell.openExternal(feedbackUrl);
    } catch (error) {
      reportError('feedback',error);
      dialog.showErrorBox(text().feedbackError,'');
    }
  }

  function copyDiagnostics() {
    const providers = hookProviders.map(provider => {
      let configured = false;
      try {
        configured = installed(path.resolve(provider.directory),provider.id);
      } catch {
        // An unreadable config reads as not connected.
      }
      return {id:provider.id,state:connections.read(provider.id,configured).state};
    });
    clipboard.writeText(diagnosticsText({version,macos:process.getSystemVersion(),arch:process.arch,providers,
      update:{supported:canUpdate,...updates.state},errors:errors.list()}));
    void dialog.showMessageBox({type:'info',message:text().diagnosticsCopied});
  }

  async function installAvailableUpdate(selected) {
    if (!canUpdate || installingUpdate) return;
    installingUpdate = true;
    const strings = text();
    try {
      const {update} = await updates.refresh();
      if (update?.version !== selected.version || update?.bundle !== selected.bundle ||
          update?.remote?.sha256 !== selected.remote?.sha256) {
        await dialog.showMessageBox({type:'info',message:strings.updateChanged});
        return;
      }
      const download = update.remote ? await fetchUpdate(update) : undefined;
      try {
        if (download?.quarantined) errors.note('update download','quarantined');
        await launchUpdate(installedBundle,download ?? update,updateExecutable);
      } finally {
        await download?.cleanup();
      }
      app.quit();
    } catch (error) {
      dialog.showErrorBox(strings.updateError,error.message);
    } finally {
      installingUpdate = false;
    }
  }

  function markUpdateReady() {
    if (!updateReady) return;
    const marker = updateReady;
    updateReady = undefined;
    const stage = path.dirname(marker);
    if (path.basename(marker) !== 'ready' || !path.basename(stage).startsWith('.hamster-update-') ||
        path.dirname(stage) !== path.dirname(installedBundle)) return;
    try {
      const stat = fs.lstatSync(stage);
      if (stat.isDirectory() && stat.uid === process.getuid() && !(stat.mode & 0o077)) {
        fs.writeFileSync(marker,'',{flag:'wx',mode:0o600});
      }
    } catch (error) {
      reportError('update readiness',error);
    }
  }

  function record(type, detail) {
    history.push({type,detail,at:new Date().toISOString()});
    if (history.length > 24) history.shift();
  }

  function pointerInTarget() {
    if (!interaction.action || !interactionWindow?.isVisible()) return false;
    const {x,y,width,height} = interactionWindow.getBounds();
    const point = screen.getCursorScreenPoint();
    return point.x >= x && point.x < x+width && point.y >= y && point.y < y+height;
  }

  function positionInteraction() {
    if (!interaction.action || !interactionWindow || interactionWindow.isDestroyed()) return;
    const [x,y,width,height] = interactionZones[interaction.action];
    const bounds = win.getBounds();
    interactionWindow.setBounds({x:bounds.x+x,y:bounds.y+y,width,height});
  }

  function showInteraction() {
    if (!interactionLoaded || !interactionWindow || interactionWindow.isDestroyed()) return;
    if (!interaction.action) {
      interactionWindow.hide();
      return;
    }
    positionInteraction();
    interactionWindow.webContents.send('hamster:interaction',interaction);
    if (!interactionWindow.isVisible()) interactionWindow.showInactive();
  }

  function ensureInteractionWindow() {
    if (interactionWindow) return;
    const target = new BrowserWindow({parent:win,width:44,height:44,frame:false,transparent:true,resizable:false,
      hasShadow:false,focusable:false,acceptFirstMouse:true,skipTaskbar:true,show:false,
      webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
    interactionWindow = target;
    target.setAlwaysOnTop(true,'floating');
    target.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:false});
    target.webContents.on('will-navigate',event => event.preventDefault());
    target.webContents.setWindowOpenHandler(() => ({action:'deny'}));
    target.webContents.once('did-finish-load',() => {interactionLoaded = true; showInteraction();});
    target.on('closed',() => {interactionWindow = undefined; interactionLoaded = false;});
    target.loadFile(path.join(__dirname,'interaction.html')).catch(error => {
      reportError('interaction',error);
      if (!target.isDestroyed()) target.destroy();
    });
  }

  function syncInteraction() {
    if (!win || win.isDestroyed()) return;
    let action;
    if (win.isVisible() && !suspended && !screenLocked && motionSettings.interaction && !state.working) {
      if (state.clip === 'offer' && paintedRevision === revision) action = 'highfive';
      else if (state.canPat && Date.now() < giftUntil && canClaimFirstGift(wallet,progress.workMs)) action = 'gift';
      else if (state.canPat) action = 'pat';
    }
    const label = action ? text()[action === 'gift' ? 'openGift' : action] : undefined;
    if (action === interaction.action && label === interaction.label) return;
    interaction = {action,label,revision:interaction.revision+1};
    if (action) ensureInteractionWindow();
    showInteraction();
    send('hamster:interaction',interaction);
  }

  function openFirstGift() {
    const next = claimFirstGift(wallet,progress.workMs);
    if (!next || !saveSettings({wallet:next})) return;
    wallet = next;
    giftUntil = 0;
    send('hamster:gift-received',text().giftReceived);
    notifyWardrobe();
    status();
  }

  function motionMessage(clip) {
    return clip === 'offer' ? {id:'highfive',revision,still:true,frame:2} : {id:clip,revision};
  }

  function status() {
    syncInteraction();
    if (state.activeCount !== workCount) {
      workCount = state.activeCount;
      send('hamster:work-count',workCount);
    }
    const report = {
      pid:process.pid, version, listening, motion:state.clip, painted, workCount,
      visible:win?.isVisible() ?? false, bounds:win?.getBounds(),
      outfit, progress, motionSettings, language, placement, interaction:interaction.action,
      workArea:app.isReady() ? screen.getPrimaryDisplay().workArea : undefined,
      recent:history,
    };
    const temporary = statePath + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(report,null,2) + '\n', {mode:0o600});
    fs.renameSync(temporary,statePath);
  }

  const state = createMotionState(clip => {
    record('motion',clip);
    revision++;
    send('hamster:clip',motionMessage(clip));
    status();
  }, {
    requestMs:clips.request.ms,
    replyMs:clips.reply.ms,
    clipMs:Object.fromEntries(Object.entries(clips).map(([clip,meta]) => [clip,meta.ms])),
    settings:motionSettings,
    nextReward:() => nextReward(progress),
    onReward:clip => {
      if (!win?.isVisible() || suspended || powerMonitor.getSystemIdleState(humanIdleLimit) === 'locked') return;
      progress.shown++;
      if (clip === 'gift' && canClaimFirstGift(wallet,progress.workMs)) giftUntil = Date.now()+12_000;
      saveSettings();
      status();
    },
  });

  function tick() {
    const now = performance.now();
    const elapsed = now - lastSample;
    lastSample = now;
    state.expire();
    const idle = powerMonitor.getSystemIdleState(humanIdleLimit);
    screenLocked = idle === 'locked';
    const blocked = suspended || idle === 'locked';
    const human = idle === 'active';
    const previousReward = nextReward(progress);
    const worked = sampleWork({elapsed,idle:human ? 0 : Infinity,ai:state.working,suspended:blocked});
    progress.workMs += worked;
    const earned = seedCollection && worked > 0 && earnSeeds(wallet,worked,dayFormat.format(new Date()));
    if (earned || nextReward(progress) !== previousReward || (now - lastSave >= 15000 && !blocked && (human || state.working))) {
      saveSettings();
    }
    if (earned) notifyWardrobe();
    state.tick({human,visible:win.isVisible() && !blocked});
    syncInteraction();
  }

  const turnRecords = [['codex',() => codexTerminals(codexHome,state.activeTurns('codex'))],
                       ['claude',() => claudeTerminals(claudeHome,state.activeTurns('claude'))]];

  async function reconcileTurns() {
    if (suspended || reconcilingTurns) return;
    reconcilingTurns = true;
    try {
      for (const [provider,terminals] of turnRecords) {
        if (!state.activeTurns(provider).length) continue;
        for (const {type,id} of await terminals()) {
          if (!listening) return;
          if (!state.event(type,id)) continue;
          record(provider+'-record',type);
          status();
        }
      }
    } finally {
      reconcilingTurns = false;
    }
  }

  function position() {
    win.setPosition(...bottomPosition(screen.getPrimaryDisplay().workArea,size,placement));
    status();
  }

  function listen() {
    try {
      if (!fs.lstatSync(socketPath).isSocket()) throw new Error('Existing event path is not a socket.');
      fs.unlinkSync(socketPath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    server = net.createServer(connection => {
      let data = '';
      connection.setEncoding('utf8');
      connection.setTimeout(300, () => connection.destroy());
      connection.on('error', () => {});
      connection.on('data', chunk => {
        data += chunk;
        if (data.length > 512) connection.destroy();
      });
      connection.on('end', () => {
        try {
          const message = JSON.parse(data);
          if (!message || typeof message.id !== 'string' || !/^[a-f0-9]{64}$/.test(message.id)) return;
          if (!['submitted','finished','interrupted','sessionEnded'].includes(message.type)) return;
          const scope = typeof message.scope === 'string' && /^[a-f0-9]{64}$/.test(message.scope) ? message.scope : undefined;
          connections.observe(message.provider);
          if (state.event(message.type,message.id,{scope,provider:message.provider,
            reusable:message.reusable === true,supersede:message.supersede === true})) {
            record('hook',message.type);
          }
          status();
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
      });
    });
    server.on('error', error => {
      record('socket-error',error.code || 'UNKNOWN');
      status();
    });
    server.listen(socketPath, () => {
      fs.chmodSync(socketPath,0o600);
      listening = true;
      status();
    });
  }

  app.whenReady().then(() => {
    app.setActivationPolicy('accessory');
    win = new BrowserWindow({
      width:size, height:size, frame:false, transparent:true, hasShadow:false,
      resizable:false, focusable:false, skipTaskbar:true, show:false, backgroundColor:'#00000000',
      webPreferences:{preload:path.join(__dirname,'preload.cjs'), sandbox:true,
                      contextIsolation:true, nodeIntegration:false, backgroundThrottling:false},
    });
    win.setAlwaysOnTop(true,'floating');
    win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:false});
    win.setIgnoreMouseEvents(true);
    win.on('move',positionInteraction);
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
    ipcMain.handle('hamster:gif', (event, clip) => {
      if ((event.sender !== win.webContents && event.sender !== wardrobeWindow?.webContents) ||
          typeof clip !== 'string' || !Object.hasOwn(clips,clip)) {
        throw new Error('Unknown hamster clip');
      }
      return fs.promises.readFile(path.join(__dirname,'assets',clip+'.gif'));
    });
    ipcMain.handle('hamster:wardrobe', (event, action, payload) => {
      if (event.sender !== wardrobeWindow?.webContents) throw new Error('Unknown wardrobe window');
      if (action === 'read') return {snapshot:wardrobeSnapshot()};
      if (action === 'collect') {
        if (typeof payload !== 'boolean') return {error:'invalid'};
        if (!saveSettings({seedCollection:payload})) return {error:'save'};
        seedCollection = payload;
      } else if (action === 'buy') {
        const result = purchase(wallet,wardrobe.items,payload,Date.now());
        if (result.error) return result;
        if (!saveSettings({wallet:result.wallet})) return {error:'save'};
        wallet = result.wallet;
      } else if (action === 'apply') {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
            Object.keys(payload).length !== Object.keys(ownedOutfit(payload,wardrobe.items,wallet)).length) {
          return {error:'invalid'};
        }
        if (!setOutfit(payload)) return {error:'save'};
      } else if (action === 'saveOutfit' || action === 'deleteOutfit') {
        const result = action === 'saveOutfit' ? saveNamedOutfit(savedOutfits,payload,wardrobe.items,wallet) :
          deleteNamedOutfit(savedOutfits,payload);
        if (result.error) return result;
        if (!saveSettings({savedOutfits:result.outfits})) return {error:'save'};
        savedOutfits = result.outfits;
      } else return {error:'invalid'};
      return {snapshot:wardrobeSnapshot()};
    });
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('hamster:outfit',outfit);
      win.webContents.send('hamster:work-count',state.activeCount);
      win.webContents.send('hamster:clip',motionMessage(state.clip));
      win.webContents.send('hamster:interaction',interaction);
    });
    ipcMain.on('hamster:painted', (event, renderedRevision) => {
      if (event.sender !== win.webContents || renderedRevision !== revision) return;
      paintedRevision = renderedRevision;
      painted = state.clip;
      record('painted',painted);
      status();
      if (win.isVisible()) markUpdateReady();
    });
    ipcMain.on('hamster:reward-played', (event, renderedRevision) => {
      if (event.sender === win.webContents && renderedRevision === revision) state.completeReward();
    });
    ipcMain.on('hamster:interact', (event, targetRevision, action) => {
      if (event.sender !== interactionWindow?.webContents || targetRevision !== interaction.revision || !pointerInTarget()) return;
      if (interaction.action === 'gift' && action === 'gift') openFirstGift();
      else if (interaction.action === action || (interaction.action === 'pat' && action === 'look')) state.interact(action);
    });
    for (const event of ['display-added','display-removed','display-metrics-changed']) screen.on(event,position);
    position();
    const trayIcon = nativeImage.createFromPath(path.join(__dirname,'assets','tray.png'));
    trayIcon.setTemplateImage(true);
    tray = new Tray(trayIcon);
    syncUpdateIndicator();
    refreshUpdates();
    checkRemoteUpdate();
    if (canUpdate) updateTicker = setInterval(refreshUpdates,updateScanInterval);
    remoteTicker = setInterval(checkRemoteUpdate,remoteCheckInterval);
    refreshCodexUsage();
    usageTicker = setInterval(refreshCodexUsage,30_000);
    for (const event of ['click','right-click']) tray.on(event,async () => {
      await refreshUpdates();
      if (!tray.isDestroyed()) tray.popUpContextMenu(menu());
    });
    powerMonitor.on('suspend',() => {
      suspended = true;
      syncInteraction();
      saveSettings();
    });
    powerMonitor.on('resume',() => {
      suspended = false;
      lastSample = performance.now();
      refreshUpdates();
      refreshCodexUsage();
      syncInteraction();
    });
    powerMonitor.on('lock-screen',() => {screenLocked = true; syncInteraction();});
    powerMonitor.on('unlock-screen',() => {screenLocked = false; syncInteraction();});
    win.once('ready-to-show', () => {
      win.showInactive();
      status();
      if (painted) markUpdateReady();
      if (process.argv.includes('--hamster-update-failed')) {
        void dialog.showMessageBox({type:'warning',message:text().updateRestored});
      }
    });
    listen();
    lastSample = performance.now();
    ticker = setInterval(tick,1000);
    lifecycleTicker = setInterval(reconcileTurns,5_000);
    win.loadFile(path.join(__dirname,'overlay.html')).catch(error => {
      record('window-error',error.code || 'UNKNOWN');
      status();
    });
  }).catch(error => {
    record('startup-error',error.code || error.message);
    status();
    app.exit(1);
  });
  app.on('before-quit', () => {
    state.dispose();
    clearInterval(ticker);
    clearInterval(updateTicker);
    clearInterval(remoteTicker);
    clearInterval(usageTicker);
    clearInterval(lifecycleTicker);
    stopCodexUsage();
    server?.close();
    saveSettings();
    listening = false;
    if (app.isReady()) status();
  });
  process.once('SIGTERM',() => app.quit());
}
