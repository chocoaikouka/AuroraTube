import { assertLoadingUiConsistency, createLoadingStateController } from './loading.js';

export { assertLoadingUiConsistency, createLoadingStateController };

export const loadingController = createLoadingStateController();
const legacyTokens = [];

export const setLoadingState = (isLoading, label = '読み込み中…') => {
  if (isLoading) {
    const token = loadingController.begin(label);
    legacyTokens.push(token);
    return token;
  }

  const token = legacyTokens.pop();
  if (token !== undefined) {
    loadingController.end(token);
    return token;
  }

  loadingController.reset();
  return null;
};
