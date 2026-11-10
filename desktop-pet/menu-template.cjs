// The tray menu reads top to bottom as status, quick actions, dress-up, display, connections and the app itself.
function separated(groups) {
  return groups.filter(group => group.length).flatMap((group,index) => index ? [{type:'separator'},...group] : group);
}

function updateItem(strings, version, {supported, installing, kind, update}, {install, retry}) {
  if (!supported) return {label:strings.currentVersion(version),enabled:false};
  if (installing) return {label:strings.installingUpdate,enabled:false};
  if (update) return {label:strings.installUpdate(version,update.version),click:() => install(update)};
  if (kind === 'unavailable') return {label:strings.retryUpdate(version),click:retry};
  return {label:kind === 'current' ? strings.upToDate(version) : strings.checkingUpdate(version),enabled:false};
}

function menuTemplate(strings, {version, rewards, activeCount, visible, pat, highfive, firstGift, triedGift, update,
  submenus, actions}) {
  return separated([
    [
      {label:strings.status(rewards.snacks,rewards.gifts,rewards.pending ? strings.pending : strings.next(rewards.remaining)),
       enabled:false},
      ...(activeCount ? [{label:strings.activeTasks(activeCount),enabled:false}] : []),
    ],
    [
      ...(pat.shown ? [{label:strings.pat,enabled:pat.enabled,click:actions.pat}] : []),
      ...(highfive ? [{label:strings.highfive,click:actions.highfive}] : []),
      ...(firstGift ? [{label:strings.openGift,click:actions.openGift}] : []),
      ...(triedGift ? [{label:strings.tryGift,click:actions.tryGift}] : []),
    ],
    [
      {label:strings.wardrobe,submenu:submenus.wardrobe},
      {label:strings.motion,submenu:submenus.motion},
    ],
    [
      {label:strings.placement,submenu:submenus.placement},
      {label:visible ? strings.hide : strings.show,click:actions.toggleVisible},
    ],
    [
      {label:strings.ai,submenu:submenus.ai},
      {label:strings.language,submenu:submenus.language},
    ],
    [
      updateItem(strings,version,update,{install:actions.installUpdate,retry:actions.retryUpdate}),
      {label:strings.sendFeedback,click:actions.sendFeedback},
      {label:strings.copyDiagnostics,click:actions.copyDiagnostics},
      {label:strings.quit,click:actions.quit},
    ],
  ]);
}

module.exports = {menuTemplate};
