import { MarketIcon, StakeIcon, DashboardIcon } from "./svg";

export type Imenu = {
  title: string;
  link: string;
  allLinks?: string[];
  icon?: React.ReactElement;
};
export const mainMenuList: Imenu[] = [
  {
    title: "Markets",
    link: "/markets",
    allLinks: ["/", "/markets", "/tokenDetail/[id]"],
    icon: <MarketIcon />,
  },
  {
    title: "Margin Trading",
    link: "/marginTrading",
    allLinks: ["/marginTrading", "/trading"],
    icon: <MarketIcon />,
  },
  { title: "Dashboard", link: "/dashboard", allLinks: ["/dashboard"], icon: <DashboardIcon /> },
  { title: "Staking", link: "/staking", allLinks: ["/staking"], icon: <StakeIcon /> },
];
export const helpMenu: Imenu = { title: "Help", link: "https://docs.burrow.finance/" };
