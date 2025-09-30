import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { TableProps } from "../../components/Table";
import { ArrowDownIcon, ArrowUpIcon, ArrowLineDownIcon, CheckIcon, NewTagIcon } from "./svg";
import type { UIAsset } from "../../interfaces";
import { isMobileDevice } from "../../helpers/helpers";
import { useAPY } from "../../hooks/useAPY";
import {
  toInternationalCurrencySystem_number,
  toInternationalCurrencySystem_usd,
  format_apy,
  isInvalid,
} from "../../utils/uiNumber";
import { APYCell } from "./APYCell";
import getConfig from "../../utils/config";

function MarketsTable({ rows, sorting }: TableProps) {
  return (
    <div className="w-full xsm:p-4">
      <TableHead sorting={sorting} />
      <TableBody rows={rows} sorting={sorting} />
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
      <div className="col-span-1 border border-dark-50 bg-gray-800 rounded-t-2xl flex items-center pl-5 text-sm text-gray-300">
        Market
      </div>
      <div className="grid grid-cols-2 col-span-2 bg-primary rounded-t-2xl items-center text-sm text-black">
        <div
          className="col-span-1 flex items-center cursor-pointer pl-6 xl:pl-14 whitespace-nowrap"
          onClick={() => {
            dispatch_sort_action("totalSupply");
          }}
        >
          Total Supplied
          <SortButton sort={getCurColumnSort("totalSupply")} />
        </div>
        <div
          className="col-span-1 flex items-center cursor-pointer pl-6 xl:pl-14 whitespace-nowrap"
          onClick={() => {
            dispatch_sort_action("depositApy");
          }}
        >
          Supply APY <SortButton sort={getCurColumnSort("depositApy")} />
        </div>
      </div>
      <div className="grid grid-cols-2 col-span-2 bg-red-50 rounded-t-2xl items-center text-sm text-black">
        <div
          className="col-span-1 flex items-center cursor-pointer pl-6 xl:pl-14 whitespace-nowrap"
          onClick={() => {
            dispatch_sort_action("totalBorrowed");
          }}
        >
          Total Borrowed <SortButton sort={getCurColumnSort("totalBorrowed")} />
        </div>
        <div
          className="col-span-1 flex items-center cursor-pointer pl-6 xl:pl-14 whitespace-nowrap"
          onClick={() => {
            dispatch_sort_action("borrowApy");
          }}
        >
          Borrow APY <SortButton sort={getCurColumnSort("borrowApy")} />
        </div>
      </div>
      <div
        className="col-span-1 bg-gray-300 rounded-t-2xl flex items-center text-sm text-black cursor-pointer pl-4 xl:pl-8 whitespace-nowrap"
        onClick={() => {
          dispatch_sort_action("availableLiquidity");
        }}
      >
        Available Liquidity
        <SortButton sort={getCurColumnSort("availableLiquidity")} />
      </div>
    </div>
  );
}
function HeadMobile({ sorting }) {
  const [showSelectBox, setShowSelectBox] = useState(false);
  const sortList = {
    availableLiquidity: "Available Liquidity",
    totalSupply: "Total Supplied",
    depositApy: "Supply APY",
    totalBorrowed: "Total Borrowed",
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
        <div className="relative" onBlur={closeSelectBox} tabIndex={1}>
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
  }, [
    rows?.length,
    Object.keys(depositApyMap).length,
    Object.keys(borrowApyMap).length,
    property,
    order,
  ]);
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
      return a_comparator_value - b_comparator_value;
    } else {
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
  // Memoize config to avoid excessive calls
  const { NATIVE_TOKENS, NEW_TOKENS } = useMemo(() => {
    const config = getConfig() as any;
    return { NATIVE_TOKENS: config.NATIVE_TOKENS, NEW_TOKENS: config.NEW_TOKENS };
  }, []);
  const isMobile = isMobileDevice();
  const depositAPY = useAPY({
    baseAPY: row.supplyApy,
    rewards: row.depositRewards,
    tokenId: row.tokenId,
    page: "deposit",
    onlyMarket: true,
  });
  const borrowAPY = useAPY({
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
        />
      ) : (
        <TableRowPc
          key={row.tokenId}
          row={row}
          lastRow={lastRow}
          is_native={is_native}
          is_new={is_new}
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
}: {
  row: UIAsset;
  lastRow: boolean;
  is_native: boolean;
  is_new: boolean;
}) {
  return (
    <Link key={row.tokenId} href={`/tokenDetail/${row.tokenId}`}>
      <div
        className={`grid grid-cols-6 bg-gray-800 hover:bg-dark-100 cursor-pointer mt-0.5 h-[60px] ${
          lastRow ? "rounded-b-md" : ""
        }`}
      >
        <div className="relative col-span-1 flex items-center justify-self-start pl-5">
          <img src={row.icon} alt="" className="w-[27px] h-[27px] rounded-full" />
          <div className="flex flex-col items-start ml-3">
            <div className="flex">
              <span className="text-sm text-white">{row.symbol}</span>
              {is_native ? (
                <span className="text-gray-300 italic text-xs transform translate-y-0.5 ml-0.5">
                  Native
                </span>
              ) : null}
            </div>
            <span className="text-xs text-gray-300">${row.price}</span>
          </div>
          {is_new ? <NewTagIcon className="absolute bottom-2 transform -translate-x-1" /> : null}
        </div>
        <div className="col-span-1 flex flex-col justify-center pl-6 xl:pl-14 whitespace-nowrap">
          {row.can_deposit ? (
            <>
              <span className="text-sm text-white">
                {toInternationalCurrencySystem_number(row.totalSupply)}
              </span>
              <span className="text-xs text-gray-300">
                {toInternationalCurrencySystem_usd(row.totalSupplyMoney)}
              </span>
            </>
          ) : (
            <>-</>
          )}
        </div>
        <div className="col-span-1 flex flex-col justify-center pl-6 xl:pl-14 whitespace-nowrap">
          <span className="text-sm text-white">
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
          </span>
        </div>
        <div className="col-span-1 flex flex-col justify-center pl-6 xl:pl-14 whitespace-nowrap">
          {row.can_borrow ? (
            <>
              <span className="text-sm text-white">
                {toInternationalCurrencySystem_number(row.totalBorrowed)}
              </span>
              <span className="text-xs text-gray-300">
                {toInternationalCurrencySystem_usd(row.totalBorrowedMoney)}
              </span>
            </>
          ) : (
            <>-</>
          )}
        </div>
        <div className="col-span-1 flex flex-col justify-center pl-6 xl:pl-14 whitespace-nowrap">
          <span className="text-sm text-white">
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
              <span className="text-sm text-white">
                {toInternationalCurrencySystem_number(row.availableLiquidity)}
              </span>
              <span className="text-xs text-gray-300">
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
}: {
  row: UIAsset;
  lastRow: boolean;
  depositAPY: number;
  borrowAPY: number;
  is_native: boolean;
  is_new: boolean;
}) {
  return (
    <Link key={row.tokenId} href={`/tokenDetail/${row.tokenId}`}>
      <div className={`bg-gray-800 rounded-xl p-3.5 ${lastRow ? "" : "mb-4"}`}>
        <div className="relative flex items-center pb-4 border-b border-dark-950">
          <img src={row.icon} alt="" className="w-[26px] h-[26px]  rounded-full" />
          <div className="flex">
            <span className="text-base text-white font-bold ml-2">{row.symbol}</span>
            {is_native ? (
              <span className="text-gray-300 italic text-xs transform translate-y-1.5 ml-0.5">
                Native
              </span>
            ) : null}
          </div>
          {is_new ? <NewTagIcon className="absolute bottom-2 transform -translate-x-1" /> : null}
        </div>
        <div className="grid grid-cols-2 gap-y-5 pt-4">
          <TemplateMobile
            title="Total Supplied"
            value={toInternationalCurrencySystem_number(row.totalSupply)}
            subValue={toInternationalCurrencySystem_usd(row.totalSupplyMoney)}
          />
          {/* <TemplateMobile
            title="Supply APY"
            value={row.can_deposit ? format_apy(depositAPY) : "-"}
          /> */}
          <TemplateMobileAPY title="Supply APY" row={row} canShow={row.can_deposit} />
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
          <TemplateMobile title="Price" value={`$${row.price}`} />
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
function TemplateMobileAPY({ title, row, canShow }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-300 text-sm">{title}</span>
      <div className="flex items-center mt-1">
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
      </div>
    </div>
  );
}
export default MarketsTable;
