function isPokeRendererAssetResponse(response) {
  const contentType = String(response?.contentType || response?.headers?.get?.('content-type') || '').toLowerCase();
  return response?.status === 200 && contentType.startsWith('image/png');
}

module.exports = { isPokeRendererAssetResponse };