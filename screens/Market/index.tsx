import { useEffect } from "react";
import { useRouter } from "next/router";
import MarketsTable from "./table";
import MarketsOverview from "./overview";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { showModal } from "../../redux/appSlice";
import { useAvailableAssets } from "../../hooks/hooks";
import { useTableSorting } from "../../hooks/useTableSorting";
import { LayoutBox } from "../../components/LayoutContainer/LayoutContainer";
import { setActiveCategory } from "../../redux/marginTrading";

const Market = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { activeCategory: activeTab = "main" } = useAppSelector((state) => state.category);
  const rows = useAvailableAssets();
  const { sorting, setSorting } = useTableSorting();
  useEffect(() => {
    if (router?.query?.vault === "true") {
      setSorting("market", "depositApy", "desc");
    }
  }, [router?.query]);
  const handleOnRowClick = ({ tokenId }) => {
    dispatch(showModal({ action: "Supply", tokenId, amount: "0" }));
  };
  const loading = !rows.length;

  console.log(rows);
  return (
    <LayoutBox className="flex flex-col justify-center items-center">
      <div>
        <div className="w-[100vw] h-full bg-black border-b border-[#565874] mb-16">
          <MarketsOverview />
        </div>
        <div className="w-full px-32 z-[1]">
          <p className="text-white text-2xl font-bold mb-5">Market</p>
          <MarketsTable
            rows={rows}
            onRowClick={handleOnRowClick}
            sorting={{ name: "market", ...sorting.market, setSorting }}
            isMeme={false}
          />
          {loading ? (
            <div className="flex flex-col items-center mt-24">
              <img src="/loading-brrr.gif" alt="" width="75px" />
              <span className="flex items-center text-sm text-gray-300 mt-2">Loading data...</span>
            </div>
          ) : null}
        </div>
      </div>
    </LayoutBox>
  );
};

export default Market;
