import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type TokenAction = "Supply" | "Borrow" | "Repay" | "Adjust" | "Withdraw";

export interface AppState {
  showModal: boolean;
  displayAsTokenValue: boolean;
  showDust: boolean;
  selected: {
    action?: TokenAction;
    tokenId: string;
    useAsCollateral: boolean;
    amount: number;
    isMax: boolean;
  };
}

const initialState: AppState = {
  showModal: false,
  displayAsTokenValue: true,
  showDust: false,
  selected: {
    action: undefined,
    tokenId: "",
    useAsCollateral: false,
    amount: 0,
    isMax: false,
  },
};

export const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    hideModal(state) {
      state.showModal = false;
    },
    showModal(
      state,
      action: PayloadAction<{ action: TokenAction; amount: number; tokenId: string }>,
    ) {
      state.selected = { useAsCollateral: false, isMax: false, ...action.payload };
      state.showModal = true;
    },
    updateAmount(state, action: PayloadAction<{ amount: number; isMax: boolean }>) {
      state.selected.amount = action.payload.amount;
      state.selected.isMax = action.payload.isMax;
    },
    toggleUseAsCollateral(state, action: PayloadAction<{ useAsCollateral: boolean }>) {
      state.selected.useAsCollateral = action.payload.useAsCollateral;
    },
    toggleDisplayValues(state) {
      state.displayAsTokenValue = !state.displayAsTokenValue;
    },
    toggleShowDust(state) {
      state.showDust = !state.showDust;
    },
  },
});

export const {
  hideModal,
  showModal,
  updateAmount,
  toggleUseAsCollateral,
  toggleDisplayValues,
  toggleShowDust,
} = appSlice.actions;
export default appSlice.reducer;
