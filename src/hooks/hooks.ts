import { useAppSelector } from "../redux/hooks";
import { getAvailableAssets, isAssetsLoading } from "../redux/assetsSelectors";
import { getAccountId, getHasNonFarmedAssets, isAccountLoading } from "../redux/accountSelectors";
import { getPortfolioAssets } from "../redux/selectors/getPortfolioAssets";
import { getConfig, getSlimStats } from "../redux/appSelectors";
import { getViewAs } from "../utils";

export function useLoading() {
  const isLoadingAssets = useAppSelector(isAssetsLoading);
  const isLoadingAccount = useAppSelector(isAccountLoading);
  return isLoadingAssets || isLoadingAccount;
}

export function useIsBurrowToken(tokenId) {
  const config = useAppSelector(getConfig);
  return config.booster_token_id === tokenId;
}

export function useSlimStats() {
  return useAppSelector(getSlimStats);
}

export function useViewAs() {
  const viewAs = getViewAs();
  return !!viewAs;
}

export function useConfig() {
  return useAppSelector(getConfig);
}

export function useAccountId() {
  return useAppSelector(getAccountId);
}

export function useNonFarmedAssets() {
  return useAppSelector(getHasNonFarmedAssets);
}

export function useAvailableAssets(type: "supply" | "borrow") {
  return useAppSelector(getAvailableAssets(type));
}

export function usePortfolioAssets() {
  return useAppSelector(getPortfolioAssets);
}
