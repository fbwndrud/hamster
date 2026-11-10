const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('hamster', {
  onClip: callback => ipcRenderer.on('hamster:clip', (_, clip) => callback(clip)),
  onOutfit: callback => ipcRenderer.on('hamster:outfit', (_, outfit) => callback(outfit)),
  onWorkCount: callback => ipcRenderer.on('hamster:work-count', (_, count) => callback(count)),
  gif: clip => ipcRenderer.invoke('hamster:gif',clip),
  painted: revision => ipcRenderer.send('hamster:painted', revision),
  rewardPlayed: revision => ipcRenderer.send('hamster:reward-played', revision),
  onInteraction: callback => ipcRenderer.on('hamster:interaction', (_, value) => callback(value)),
  interact: (revision,action) => ipcRenderer.send('hamster:interact',revision,action),
  onGiftReceived: callback => ipcRenderer.on('hamster:gift-received', (_, label) => callback(label)),
  wardrobe: (action,payload) => ipcRenderer.invoke('hamster:wardrobe',action,payload),
  onWardrobeChanged: callback => ipcRenderer.on('hamster:wardrobe-changed',() => callback()),
  onTryGift: callback => ipcRenderer.on('hamster:try-gift', (_, id) => callback(id)),
});
