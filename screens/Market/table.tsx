import Link from "next/link";
import React, { useEffect, useState } from "react";
import { TableProps } from "../../components/Table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowLineDownIcon,
  CheckIcon,
  NewTagIcon,
  BoosterIcon,
} from "./svg";
import type { UIAsset } from "../../interfaces";
import { isMobileDevice } from "../../helpers/helpers";
import { useAPY } from "../../hooks/useAPY";
import { IToken } from "../../interfaces/asset";
import {
  toInternationalCurrencySystem_number,
  toInternationalCurrencySystem_usd,
  format_apy,
  isInvalid,
  formatWithCommas_usd,
} from "../../utils/uiNumber";
import { APYCell } from "./APYCell";
import getConfig, { incentiveTokens, topTokens, NBTCTokenId } from "../../utils/config";

const NBTC_ICON = "/svg/ntbc.svg";
const WBTC_ICON = "/svg/wbtc.svg";
const USDC_ICON = "/svg/usdc.svg";
const USDT_ICON = "/svg/usdt.svg";

function MarketsTable({ rows, sorting }: TableProps) {
  const allowedTokenIds = [
    "wbtc.ft.ref-labs.testnet",
    NBTCTokenId,
    "eth.ft.ref-labs.testnet",
    "usdcc.ft.ref-labs.testnet",
    "usdtt.ft.ref-labs.testnet",
    "frax.ft.ref-labs.testnet",
  ];
  const filteredRows = rows.filter((row) => allowedTokenIds.includes(row.tokenId));
  return (
    <div className="w-full xsm:p-4">
      <TableHead sorting={sorting} />
      <TableBody rows={filteredRows} sorting={sorting} />
    </div>
  );
}

function TableHead({ sorting }) {
  const { property, order, setSorting } = sorting;
  const isMobile = isMobileDevice();
  function getCurColumnSort(p: string) {
    if (property === p) return order;
    return "";
  }
  function dispatch_sort_action(p: string) {
    if (property !== p) {
      setSorting("market", p, "desc");
    } else {
      setSorting("market", p, order === "desc" ? "asc" : "desc");
    }
  }
  if (isMobile) return <HeadMobile sorting={sorting} />;
  return (
    <div className="grid grid-cols-6 h-12">
      <div className="col-span-1 rounded-t-2xl flex items-center text-sm text-[#FFFFFF] opacity-60">
        Asset
      </div>
      <div className="grid grid-cols-2 col-span-2 rounded-t-2xl items-center text-sm text-black">
        <div
          className="col-span-1 flex items-center cursor-pointer pl-6 xl:pl-14 whitespace-nowrap"
          onClick={() => {
            dispatch_sort_action("depositApy");
          }}
        />
        <div
          className="col-span-1 flex text-[#FFFFFF] opacity-60 items-center cursor-pointer whitespace-nowrap"
          onClick={() => {
            dispatch_sort_action("totalSupplyMoney");
          }}
        >
          Total Supplied
        </div>
      </div>
      <div className="grid grid-cols-2 col-span-2 rounded-t-2xl items-center text-sm text-[#FFFFFF] opacity-60 ">
        <div
          className="col-span-1 flex items-center cursor-pointer pl-6 xl:pl-14 whitespace-nowrap"
          onClick={() => {
            dispatch_sort_action("totalBorrowedMoney");
          }}
        >
          Total Borrowed
        </div>
        <div
          className="col-span-1 flex items-center cursor-pointer pl-6 xl:pl-14 whitespace-nowrap"
          onClick={() => {
            dispatch_sort_action("borrowApy");
          }}
        >
          Borrow APY
        </div>
      </div>
      <div
        className="col-span-1 rounded-t-2xl flex items-center text-sm text-[#FFFFFF] opacity-60 cursor-pointer pl-4 xl:pl-8 whitespace-nowrap"
        onClick={() => {
          dispatch_sort_action("availableLiquidityMoney");
        }}
      >
        Available Liquidity
      </div>
    </div>
  );
}
function HeadMobile({ sorting }) {
  const [showSelectBox, setShowSelectBox] = useState(false);
  const sortList = {
    availableLiquidityMoney: "Available Liquidity",
    totalSupplyMoney: "Total Supplied",
    depositApy: "Supply APY",
    totalBorrowedMoney: "Total Borrowed",
    borrowApy: "Borrow APY",
    price: "Price",
  };
  const { property, order, setSorting } = sorting;

  function dispatch_sort_action(p: string) {
    setSorting("market", p, "desc");
    closeSelectBox();
  }
  function handleSelectBox() {
    setShowSelectBox(!showSelectBox);
  }
  function closeSelectBox() {
    setShowSelectBox(false);
  }
  return (
    <div className="flex items-center justify-between h-[34px] mb-2.5">
      <span className="text-white font-bold">All Markets</span>
      <div className="flex items-center">
        <span className="text-gray-300 text-sm mr-2.5">Sort by</span>
        {/* eslint-disable-next-line jsx-a11y/tabindex-no-positive */}
        <div className="relative z-10" onBlur={closeSelectBox} tabIndex={1}>
          <div
            onClick={handleSelectBox}
            className="flex gap-2.5 items-center justify-center bg-gray-800 border border-dark-50 rounded-md px-2.5 py-1.5 text-sm text-white"
          >
            {sortList[property]}
            <ArrowLineDownIcon />
          </div>
          <div
            className={`border border-dark-300 rounded-md px-4 py-1 bg-dark-100 absolute right-0 w-[180px] top-[40px] ${
              showSelectBox ? "" : "hidden"
            }`}
          >
            {Object.entries(sortList).map(([key, name]) => {
              const isSelected = property === key;
              return (
                <div
                  key={key}
                  className="flex items-center justify-between py-3"
                  onClick={() => {
                    dispatch_sort_action(key);
                  }}
                >
                  <span className={`text-sm ${isSelected ? "text-primary" : "text-white"}`}>
                    {name}
                  </span>
                  <CheckIcon className={`${isSelected ? "" : "hidden"}`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
function TableBody({ rows, sorting }: TableProps) {
  const [depositApyMap, setDepositApyMap] = useState<Record<string, number>>({});
  const [borrowApyMap, setBorrowApyMap] = useState<Record<string, number>>({});
  const [sortedRows, setSortedRows] = useState<any>();
  const { property, order } = sorting;
  useEffect(() => {
    if (rows?.length) {
      setSortedRows(rows.sort(comparator));
    }
  }, [rows, Object.keys(depositApyMap).length, Object.keys(borrowApyMap).length, property, order]);
  if (!rows?.length) return null;
  function comparator(b: UIAsset, a: UIAsset) {
    let a_comparator_value;
    let b_comparator_value;
    if (property === "depositApy") {
      a_comparator_value = depositApyMap[a.tokenId];
      b_comparator_value = depositApyMap[b.tokenId];
    } else if (property === "borrowApy") {
      a_comparator_value = borrowApyMap[a.tokenId];
      b_comparator_value = borrowApyMap[b.tokenId];
    } else {
      a_comparator_value = a[property];
      b_comparator_value = b[property];
    }
    if (["borrowApy", "totalBorrowed"].includes(property)) {
      if (!b.can_borrow) {
        b_comparator_value = -9999999999;
      }
      if (!a.can_borrow) {
        a_comparator_value = -9999999999;
      }
    }
    if (order === "desc") {
      if (incentiveTokens.includes(a.tokenId)) {
        a_comparator_value = 99999999999999;
      }
      if (incentiveTokens.includes(b.tokenId)) {
        b_comparator_value = 99999999999999;
      }
      if (topTokens.includes(a.tokenId)) {
        a_comparator_value = 99999999999998;
      }
      if (topTokens.includes(b.tokenId)) {
        b_comparator_value = 99999999999998;
      }
      return a_comparator_value - b_comparator_value;
    } else {
      if (incentiveTokens.includes(a.tokenId)) {
        a_comparator_value = -999999999999999;
      }
      if (incentiveTokens.includes(b.tokenId)) {
        b_comparator_value = -999999999999999;
      }
      if (topTokens.includes(a.tokenId)) {
        a_comparator_value = -999999999999998;
      }
      if (topTokens.includes(b.tokenId)) {
        b_comparator_value = -999999999999998;
      }
      return b_comparator_value - a_comparator_value;
    }
  }
  return (
    <>
      {(sortedRows || rows).map((row: UIAsset, index: number) => {
        return (
          <TableRow
            key={row.tokenId}
            row={row}
            lastRow={index === rows.length - 1}
            depositApyMap={depositApyMap}
            setDepositApyMap={setDepositApyMap}
            borrowApyMap={borrowApyMap}
            setBorrowApyMap={setBorrowApyMap}
          />
        );
      })}
    </>
  );
}

function TableRow({
  row,
  lastRow,
  depositApyMap,
  setDepositApyMap,
  borrowApyMap,
  setBorrowApyMap,
}: {
  row: UIAsset;
  lastRow: boolean;
  depositApyMap: Record<string, number>;
  setDepositApyMap: any;
  borrowApyMap: Record<string, number>;
  setBorrowApyMap: any;
}) {
  const { NATIVE_TOKENS, NEW_TOKENS } = getConfig() as any;
  const isMobile = isMobileDevice();
  const [depositAPY] = useAPY({
    baseAPY: row.supplyApy,
    rewards: row.depositRewards,
    tokenId: row.tokenId,
    page: "deposit",
    onlyMarket: true,
  });
  const [borrowAPY] = useAPY({
    baseAPY: row.borrowApy,
    rewards: row.borrowRewards,
    tokenId: row.tokenId,
    page: "borrow",
    onlyMarket: true,
  });
  depositApyMap[row.tokenId] = depositAPY;
  borrowApyMap[row.tokenId] = borrowAPY;
  useEffect(() => {
    setDepositApyMap(depositApyMap);
  }, [Object.keys(depositApyMap).length]);
  useEffect(() => {
    setBorrowApyMap(borrowApyMap);
  }, [Object.keys(borrowApyMap).length]);
  const is_native = NATIVE_TOKENS?.includes(row.tokenId);
  const is_new = NEW_TOKENS?.includes(row.tokenId);
  // function getIcons() {
  //   const { isLpToken, tokens } = row;
  //   return (
  //     <div className="flex items-center justify-center flex-wrap w-[34px] flex-shrink-0">
  //       {isLpToken ? (
  //         tokens.map((token: IToken, index) => {
  //           return (
  //             <img
  //               key={token.token_id}
  //               src={token.metadata?.icon}
  //               alt=""
  //               className={`w-[20px] h-[20px] rounded-full relative ${
  //                 index !== 0 && index !== 2 ? "-ml-1.5" : ""
  //               } ${index > 1 ? "-mt-1.5" : "z-10"}`}
  //             />
  //           );
  //         })
  //       ) : (
  //         <img src={row.icon} alt="" className="w-[26px] h-[26px] rounded-full" />
  //       )}
  //     </div>
  //   );
  // }
  function getIcons() {
    if (row.symbol === "NBTC") {
      return (
        <div className="flex items-center justify-center flex-wrap w-[34px] flex-shrink-0">
          <img src={NBTC_ICON} alt="" className="w-[33px] h-[26px] rounded-full" />
        </div>
      );
    } else if (row.symbol === "b-WBTC") {
      return (
        <div className="flex items-center justify-center flex-wrap w-[34px] flex-shrink-0">
          <img src={WBTC_ICON} alt="" className="w-[33px] h-[26px] rounded-full" />
        </div>
      );
    } else if (row.symbol === "b-USDC") {
      return (
        <div className="flex items-center justify-center flex-wrap w-[34px] flex-shrink-0">
          <img src={USDC_ICON} alt="" className="w-[33px] h-[26px] rounded-full" />
        </div>
      );
    } else if (row.symbol === "b-USDt") {
      return (
        <div className="flex items-center justify-center flex-wrap w-[34px] flex-shrink-0">
          <img src={USDT_ICON} alt="" className="w-[33px] h-[26px] rounded-full" />
        </div>
      );
    }
    return null;
  }
  function getSymbols() {
    const { isLpToken, tokens } = row;
    return (
      <div className="flex items-center flex-wrap max-w-[146px] flex-shrink-0">
        {isLpToken ? (
          tokens.map((token: IToken, index) => {
            return (
              <span className="text-sm text-white" key={token.token_id}>
                {token?.metadata?.symbol}
                {index === tokens.length - 1 ? "" : "-"}
                {index === tokens.length - 1 ? (
                  <span className="text-gray-300 italic text-xs ml-1" style={{ zoom: 0.85 }}>
                    LP token
                  </span>
                ) : null}
              </span>
            );
          })
        ) : (
          <span className="text-sm text-white xsm:text-base">
            {row.symbol}
            {is_native ? (
              <span
                style={{ zoom: 0.85 }}
                className="text-gray-300 italic text-xs transform -translate-y-0.5 ml-0.5"
              >
                Native
              </span>
            ) : null}
          </span>
        )}
      </div>
    );
  }
  return (
    <div>
      {isMobile ? (
        <TableRowMobile
          key={row.tokenId}
          row={row}
          lastRow={lastRow}
          depositAPY={depositAPY}
          borrowAPY={borrowAPY}
          is_native={is_native}
          is_new={is_new}
          getIcons={getIcons}
          getSymbols={getSymbols}
        />
      ) : (
        <TableRowPc
          key={row.tokenId}
          row={row}
          lastRow={lastRow}
          is_native={is_native}
          is_new={is_new}
          getIcons={getIcons}
          getSymbols={getSymbols}
        />
      )}
    </div>
  );
}

function TableRowPc({
  row,
  lastRow,
  is_native,
  is_new,
  getIcons,
  getSymbols,
}: {
  row: UIAsset;
  lastRow: boolean;
  is_native: boolean;
  is_new: boolean;
  getIcons: () => React.ReactNode;
  getSymbols: () => React.ReactNode;
}) {
  return (
    <Link key={row.tokenId} href={`/tokenDetail/${row.tokenId}`}>
      <div
        className={`grid grid-cols-6 box-border border border-transparent hover:bg-black hover:border hover:border-primary rounded-md cursor-pointer mt-0.5 h-[60px] ${
          lastRow ? "rounded-b-md" : ""
        }`}
      >
        <div className="relative col-span-1 flex items-center justify-self-start">
          {getIcons()}
          <div className="flex flex-col items-start ml-3">
            <div className="flex items-end font-semibold">{getSymbols()}</div>
            <span className="text-xs text-white opacity-40">
              {formatWithCommas_usd(row?.price)}
            </span>
          </div>
          {is_new ? (
            <NewTagIcon
              className={`absolute transform -translate-x-[1px] z-20 ${
                row.isLpToken && row.tokens.length > 2 ? "bottom-1" : "bottom-2"
              }`}
            />
          ) : null}
        </div>
        <div className="col-span-1 flex flex-col justify-center pl-6 xl:pl-14 whitespace-nowrap">
          {/* <span className="text-sm text-white">
            {toInternationalCurrencySystem_number(row.totalSupply)}
          </span> */}
        </div>
        <div className="col-span-1 flex flex-col justify-center whitespace-nowrap">
          {/* <span className="flex items-center gap-2 text-sm text-white">
            {row.can_deposit ? (
              <APYCell
                rewards={row.depositRewards}
                baseAPY={row.supplyApy}
                page="deposit"
                tokenId={row.tokenId}
                onlyMarket
              />
            ) : (
              "-"
            )}
            {incentiveTokens.includes(row.tokenId) ? <BoosterTag /> : null}
          </span> */}
          {row.can_deposit ? (
            <>
              <span className="text-sm text-white font-semibold">
                {toInternationalCurrencySystem_number(row.totalSupply)}
              </span>
              <span className="text-xs text-white opacity-40">
                {toInternationalCurrencySystem_usd(row.totalSupplyMoney)}
              </span>
            </>
          ) : (
            <>-</>
          )}
        </div>
        <div className="col-span-1 flex flex-col justify-center pl-6 xl:pl-14 whitespace-nowrap">
          {row.can_borrow ? (
            <>
              <span className="text-sm text-white font-semibold">
                {toInternationalCurrencySystem_number(row.totalBorrowed)}
              </span>
              <span className="text-xs text-white opacity-40">
                {toInternationalCurrencySystem_usd(row.totalBorrowedMoney)}
              </span>
            </>
          ) : (
            <>-</>
          )}
        </div>
        <div className="col-span-1 flex flex-col justify-center pl-6 xl:pl-14 whitespace-nowrap">
          <span className="text-sm text-white font-semibold">
            {row.can_borrow ? (
              <APYCell
                rewards={row.borrowRewards}
                baseAPY={row.borrowApy}
                page="borrow"
                tokenId={row.tokenId}
                onlyMarket
              />
            ) : (
              "-"
            )}
          </span>
        </div>
        <div className="col-span-1 flex flex-col justify-center pl-4 xl:pl-8 whitespace-nowrap">
          {row.can_borrow ? (
            <>
              <span className="text-sm text-white font-semibold">
                {toInternationalCurrencySystem_number(row.availableLiquidity)}
              </span>
              <span className="text-xs text-white opacity-40">
                {toInternationalCurrencySystem_usd(row.availableLiquidityMoney)}
              </span>
            </>
          ) : (
            "-"
          )}
        </div>
      </div>
    </Link>
  );
}
function TableRowMobile({
  row,
  lastRow,
  depositAPY,
  borrowAPY,
  is_native,
  is_new,
  getIcons,
  getSymbols,
}: {
  row: UIAsset;
  lastRow: boolean;
  depositAPY: number;
  borrowAPY: number;
  is_native: boolean;
  is_new: boolean;
  getIcons: () => React.ReactNode;
  getSymbols: () => React.ReactNode;
}) {
  return (
    <Link key={row.tokenId} href={`/tokenDetail/${row.tokenId}`}>
      <div className={`bg-gray-800 rounded-xl p-3.5 ${lastRow ? "" : "mb-4"}`}>
        <div className="flex items-center pb-4 border-b border-dark-950 -ml-1 relative">
          {getIcons()}
          <div className="flex ml-2">{getSymbols()}</div>
          {is_new ? (
            <NewTagIcon
              className={`absolute transform -translate-x-[1px] z-20 ${
                row.isLpToken && row?.tokens?.length > 2 ? "bottom-2" : "bottom-1"
              }`}
            />
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-y-5 pt-4">
          <TemplateMobile
            title="Total Supplied"
            value={toInternationalCurrencySystem_number(row.totalSupply)}
            subValue={toInternationalCurrencySystem_usd(row.totalSupplyMoney)}
          />
          <TemplateMobileAPY
            title="Supply APY"
            row={row}
            canShow={row.can_deposit}
            booster={incentiveTokens.includes(row.tokenId)}
          />
          <TemplateMobile
            title="Total Borrowed"
            value={row.can_borrow ? toInternationalCurrencySystem_number(row.totalBorrowed) : "-"}
            subValue={
              row.can_borrow ? toInternationalCurrencySystem_usd(row.totalBorrowedMoney) : ""
            }
          />
          <TemplateMobile title="Borrow APY" value={row.can_borrow ? format_apy(borrowAPY) : "-"} />
          <TemplateMobile
            title="Available Liquidity"
            value={
              row.can_borrow ? toInternationalCurrencySystem_number(row.availableLiquidity) : "-"
            }
            subValue={
              row.can_borrow ? toInternationalCurrencySystem_usd(row.availableLiquidityMoney) : ""
            }
          />
          <TemplateMobile title="Price" value={formatWithCommas_usd(row?.price)} />
        </div>
      </div>
    </Link>
  );
}
function SortButton({ sort }: { sort?: "asc" | "desc" }) {
  return (
    <div className="flex flex-col items-center gap-0.5 ml-1.5">
      <ArrowUpIcon className={`text-black ${sort === "asc" ? "" : "text-opacity-30"}`} />
      <ArrowDownIcon className={`text-black ${sort === "desc" ? "" : "text-opacity-30"}`} />
    </div>
  );
}
function TemplateMobile({
  title,
  value,
  subValue,
}: {
  title: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-300 text-sm">{title}</span>
      <div className="flex items-center mt-1">
        <span className="text-base font-bold text-white">{value}</span>
        {!isInvalid(subValue) && (
          <span className="text-gray-300 text-xs ml-1 relative top-px">{subValue}</span>
        )}
      </div>
    </div>
  );
}
function TemplateMobileAPY({ title, row, canShow, booster }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-300 text-sm">{title}</span>
      <div className="flex items-center xsm:flex-wrap mt-1 gap-2">
        {canShow ? (
          <APYCell
            rewards={row.depositRewards}
            baseAPY={row.supplyApy}
            page="deposit"
            tokenId={row.tokenId}
            onlyMarket
          />
        ) : (
          <>-</>
        )}
        {booster ? <BoosterTag /> : null}
      </div>
    </div>
  );
}
function BoosterTag() {
  return (
    <div className="flex items-center justify-center rounded gap-0.5 text-xs text-black font-bold italic h-4 bg-primary px-1.5">
      <BoosterIcon />
      Boosted
    </div>
  );
}
export default MarketsTable;
