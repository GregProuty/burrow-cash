import React, { useState, useEffect } from "react";
import { useTheme, Box, Snackbar, Alert } from "@mui/material";
import { useRouter } from "next/router";
import Link from "next/link";

import LogoIcon from "../../public/logo.svg";
import BurrowIcon from "../../public/burrow.svg";
import BrrrIcon from "../../public/brrr.svg";
import WalletButton from "./WalletButton";
import Bridge from "./Bridge";
import Set from "./Set";
import { Wrapper, Logo, Menu, LinkStyled, WrapperMobile, WalletMobile } from "./style";
import { useAppSelector } from "../../redux/hooks";
import { isAssetsFetching } from "../../redux/assetsSelectors";
import { helpMenu, mainMenuList, Imenu } from "./menuData";
import MenuMobile from "./MenuMobile";
import { RefreshIcon } from "./svg";

const MenuItem = ({ item }: { item: Imenu }) => {
  const { title, link, allLinks } = item;
  const router = useRouter();
  const isSelected = allLinks?.includes(router.route);
  const style = isSelected ? { color: "#D2FF3A" } : {};

  return (
    <Link href={link}>
      <LinkStyled sx={{ ...style }}>{title}</LinkStyled>
    </Link>
  );
};

const HelpMenuItem = () => {
  return (
    <div
      className="flex items-center cursor-pointer text-white  hover:text-opacity-80"
      onClick={() => {
        window.open(helpMenu.link);
      }}
    >
      <span className="mr-1.5 text-base">{helpMenu.title}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0.646447 8.64645C0.451184 8.84171 0.451184 9.15829 0.646447 9.35355C0.841709 9.54882 1.15829 9.54882 1.35355 9.35355L0.646447 8.64645ZM9.98528 0.514718C9.98528 0.238576 9.76142 0.0147186 9.48528 0.0147185L4.98528 0.0147189C4.70914 0.0147187 4.48528 0.238577 4.48528 0.514719C4.48528 0.790861 4.70914 1.01472 4.98528 1.01472L8.98528 1.01472L8.98528 5.01472C8.98528 5.29086 9.20914 5.51472 9.48528 5.51472C9.76142 5.51472 9.98528 5.29086 9.98528 5.01472L9.98528 0.514718ZM1.35355 9.35355L9.83883 0.868272L9.13173 0.161165L0.646447 8.64645L1.35355 9.35355Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
};
const Header = () => {
  const [open, setOpen] = useState(false);
  const isFetching = useAppSelector(isAssetsFetching);
  const theme = useTheme();
  useEffect(() => {
    if (isFetching) {
      setOpen(true);
    }
  }, [isFetching]);

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false);
  };

  return (
    <Box
      sx={{
        background: theme.custom.headerBackground,
        mb: { xs: "1rem", sm: "2rem" },
      }}
    >
      {/* pc */}
      <div className="xsm:hidden">
        <Wrapper style={{ position: "relative" }}>
          <Logo
            onClick={() => {
              window.open("https://burrow.finance/");
            }}
          >
            <LogoIcon style={{ fill: "white" }} />
            <BurrowIcon />
          </Logo>
          <Menu>
            {mainMenuList.map((item) => {
              return <MenuItem key={item.title} item={item} />;
            })}
            <HelpMenuItem />
          </Menu>
          <Box display="flex" justifyContent="flex-end" alignItems="stretch" className=" gap-4">
            <Bridge />
            <WalletButton />
            <Set />
          </Box>
          {/*<Snackbar*/}
          {/*  open={open}*/}
          {/*  autoHideDuration={2000}*/}
          {/*  onClose={handleClose}*/}
          {/*  anchorOrigin={{ vertical: "bottom", horizontal: "center" }}*/}
          {/*>*/}
          {/*  <div className="flex items-center justify-center border border-dark-300 text-sm text-white rounded-md bg-dark-100 px-4 py-3.5">*/}
          {/*    <RefreshIcon className="mr-2.5 flex-shrink-0 animate-spin h-5 w-5" /> Refreshing*/}
          {/*    assets data...*/}
          {/*  </div>*/}
          {/*</Snackbar>*/}
        </Wrapper>
      </div>
      {/* mobile */}
      <div className="lg:hidden p-4">
        <WrapperMobile>
          <Logo
            onClick={() => {
              window.open("https://burrow.finance/");
            }}
          >
            <BrrrIcon />
          </Logo>
          <Box className="flex items-center">
            <WalletButton />
            <MenuMobile />
          </Box>
        </WrapperMobile>
      </div>
    </Box>
  );
};

export default Header;
