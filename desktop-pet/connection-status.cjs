function createConnectionStatus(providerIds) {
  const providers = new Set(providerIds);
  const receipts = new Map();

  return {
    observe(providerId, timestamp = Date.now()) {
      if (providers.has(providerId)) receipts.set(providerId, timestamp);
    },
    reset(providerId) {
      receipts.delete(providerId);
    },
    read(providerId, configured) {
      if (!configured) return {state:'notInstalled', receivedAt:null};
      const receivedAt = receipts.get(providerId) ?? null;
      return {state:receivedAt === null ? 'waiting' : 'verified', receivedAt};
    },
  };
}

module.exports = {createConnectionStatus};
