import { createContext, useContext } from "react";
import Image from "next/image";
import Decimal from "decimal.js";

import { toInternationalCurrencySystem_usd, formatWithCommas_usd } from "../../utils/uiNumber";
import { useProtocolNetLiquidity } from "../../hooks/useNetLiquidity";
import { useRewards } from "../../hooks/useRewards";
import { isMobileDevice } from "../../helpers/helpers";

const HeaderPattern = "/svg/HeaderPattern.svg";

const dollarSvg = (
  <svg width="23" height="48" viewBox="0 0 23 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M11.36 37.0401C9.65331 37.0401 8.10664 36.7734 6.71998 36.2401C5.33331 35.7067 4.18664 34.9867 3.27998 34.08C2.39998 33.1734 1.83998 32.2 1.59998 31.16L6.47998 29.72C6.77331 30.52 7.30664 31.2134 8.07998 31.8C8.87998 32.36 9.87998 32.6534 11.08 32.68C12.3333 32.7067 13.3466 32.44 14.12 31.88C14.92 31.32 15.32 30.5734 15.32 29.64C15.32 28.8934 15 28.2534 14.36 27.72C13.7466 27.16 12.8933 26.7467 11.8 26.48L8.51998 25.68C7.29331 25.3334 6.21331 24.84 5.27998 24.2C4.34664 23.56 3.62664 22.7734 3.11998 21.84C2.61331 20.88 2.35998 19.7734 2.35998 18.52C2.35998 16.1467 3.13331 14.2934 4.67998 12.96C6.25331 11.6267 8.47998 10.96 11.36 10.96C12.96 10.96 14.36 11.1867 15.56 11.64C16.7866 12.0934 17.8133 12.76 18.64 13.64C19.4666 14.4934 20.0933 15.52 20.52 16.72L15.64 18.2C15.3733 17.4267 14.8533 16.76 14.08 16.2C13.3333 15.6134 12.3733 15.32 11.2 15.32C10.0533 15.32 9.14664 15.6 8.47998 16.16C7.81331 16.6934 7.47998 17.44 7.47998 18.4C7.47998 19.1734 7.73331 19.8 8.23998 20.28C8.77331 20.7334 9.49331 21.0667 10.4 21.28L13.72 22.12C15.88 22.6534 17.5466 23.6134 18.72 25C19.92 26.36 20.52 27.88 20.52 29.56C20.52 31.08 20.16 32.4 19.44 33.5201C18.72 34.6401 17.68 35.5067 16.32 36.12C14.96 36.7334 13.3066 37.0401 11.36 37.0401ZM9.23997 42.12V35.16H13.64V42.12H9.23997ZM9.23997 13.7601V6.80005H13.64V13.7601H9.23997Z"
      fill="#FF9900"
    />
  </svg>
);

const MarketOverviewData = createContext(null) as any;
function MarketsOverview() {
  // main
  const { protocolBorrowed, protocolDeposited, protocolNetLiquidity } = useProtocolNetLiquidity(
    false,
    false,
  );
  const { tokenNetBalanceRewards } = useRewards(false);
  // meme
  const {
    protocolBorrowed: protocolBorrowedMEME,
    protocolDeposited: protocolDepositedMEME,
    protocolNetLiquidity: protocolNetLiquidityMEME,
  } = useProtocolNetLiquidity(false, true);
  const { tokenNetBalanceRewards: tokenNetBalanceRewardsMEME } = useRewards(true);
  const sumRewards = (acc, r) => acc + r.dailyAmount * r.price;
  const amount = tokenNetBalanceRewards.reduce(sumRewards, 0);
  const amountMEME = tokenNetBalanceRewardsMEME.reduce(sumRewards, 0);
  const isMobile = isMobileDevice();
  return (
    <MarketOverviewData.Provider
      value={{
        protocolBorrowed: new Decimal(protocolBorrowed || 0)
          .plus(protocolBorrowedMEME || 0)
          .toFixed(),
        protocolDeposited: new Decimal(protocolDeposited || 0)
          .plus(protocolDepositedMEME || 0)
          .toFixed(),
        protocolNetLiquidity: new Decimal(protocolNetLiquidity || 0).plus(
          protocolNetLiquidityMEME || 0,
        ),
        amount: new Decimal(amount || 0).plus(amountMEME || 0),
      }}
    >
      {isMobile ? <MarketsOverviewMobile /> : <MarketsOverviewPc />}
    </MarketOverviewData.Provider>
  );
}

function MarketsOverviewPc() {
  const { protocolBorrowed, protocolDeposited, protocolNetLiquidity, amount } = useContext(
    MarketOverviewData,
  ) as any;
  return (
    <div className="flex items-center w-full h-[150px] rounded-xl mb-8 px-5">
      <div className="flex flex-col items-start col-span-1 z-[1]">
        <span className="text-sm text-gray-300">Available Liquidity</span>
        <span className="text-white items-center font-bold text-[40px] flex">
          {dollarSvg}
          {toInternationalCurrencySystem_usd(protocolNetLiquidity)}
        </span>
      </div>
      <div style={{ borderLeft: "1px solid #565874", height: "80%", margin: "0 70px 0 70px" }} />
      <div className="flex flex-col items-start col-span-1 ">
        <span className="text-sm text-gray-300">Total Supplied</span>
        <span className="text-white items-center font-bold  justify-center text-[40px] flex">
          {dollarSvg}
          {toInternationalCurrencySystem_usd(protocolDeposited)}
        </span>
      </div>
      <div style={{ borderLeft: "1px solid #565874", height: "80%", margin: "0 70px 0 70px" }} />
      <div className="flex flex-col items-start col-span-1">
        <span className="text-sm text-gray-300">Total Borrowed</span>
        <span className="text-white items-center justify-center font-bold text-[40px] flex">
          {dollarSvg}
          {toInternationalCurrencySystem_usd(protocolBorrowed)}
        </span>
      </div>
      <div className="absolute right-0 top-11">
        <Image src={HeaderPattern} alt="pattern" width={420} height={210} priority />
      </div>
    </div>
  );
}
function MarketsOverviewMobile() {
  const { protocolBorrowed, protocolDeposited, protocolNetLiquidity, amount } = useContext(
    MarketOverviewData,
  ) as any;
  return (
    <div className="w-full px-4 pb-5 border-b border-dark-950">
      <div className="text-xl font-bold text-white mb-6">Markets</div>
      <div className="grid grid-cols-2 gap-y-5">
        <TemplateMobile
          title="Total Supplied"
          value={toInternationalCurrencySystem_usd(protocolDeposited)}
        />
        <TemplateMobile
          title="Total Borrowed"
          value={toInternationalCurrencySystem_usd(protocolBorrowed)}
        />
        <TemplateMobile
          title="Available Liquidity"
          value={toInternationalCurrencySystem_usd(protocolNetLiquidity)}
        />
        <TemplateMobile title="Daily Rewards" value={formatWithCommas_usd(amount)} />
      </div>
    </div>
  );
}

function TemplateMobile({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-300 text-sm mb-1 whitespace-nowrap">{title}</span>
      <span className="flex text-2xl font-bold text-white  whitespace-nowrap">{value}</span>
    </div>
  );
}
export default MarketsOverview;
