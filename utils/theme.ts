import { createTheme } from "@mui/material/styles";

import { ITheme } from "../redux/appSlice";

const defaultTheme = createTheme();

const palette = {
  light: {
    mode: "light",
    primary: {
      // main: "#D2FF3A",
      main: "#FF9900",
      light: "#D5EFE6",
    },
    secondary: {
      // main: "#000741",
      main: "#FF9900",

      light: "#c1c2ce",
    },
    info: {
      main: "#444",
    },
    background: {
      default: "#F8F9FF",
      paper: "#2E304B",
    },
  },
  dark: {
    mode: "light",
    primary: {
      // main: "#D2FF3A",
      main: "#FF9900",

      light: "#000",
    },
    secondary: {
      // main: "#fff",
      main: "#FF9900",

      light: "#3F4361",
    },
    info: {
      main: "#C0C4E9",
    },
    background: {
      default: "#1A3632",
      paper: "#2E304B",
    },
  },
};

declare module "@mui/material/styles" {
  interface Theme {
    custom: {
      headerBackground: string;
      pageBackground: string;
      footerText: string;
      footerIcon: string;
      text: string;
      textStaking: string;
      background: string;
      backgroundStaking: string;
      notConnectedBg: string;
      scrollbarBg: string;
      tableLabelColor: string;
      tableCellBorderBottomColor: string;
      userMenuColor: string;
      stakingCardBg: string;
    };
  }
}

const custom = {
  light: {
    // headerBackground: "#14162B",
    // pageBackground: "#14162B",
    headerBackground: "black",
    pageBackground: "#14161F",
    footerText: "#C0C4E9",
    footerIcon: "#000",
    text: "#000",
    // textStaking: "#232323",
    // background: "#fff",
    // backgroundStaking: "#fff",
    background: "#14161F",
    backgroundStaking: "black",
    notConnectedBg: "rgba(255,255,255,0.85)",
    scrollbarBg: "none",
    tableLabelColor: "#8E9295",
    tableCellBorderBottomColor: "#DBDDE1",
    userMenuColor: "#73A1CE",
    stakingCardBg: "#fff",
  },
  dark: {
    // headerBackground: "#14162B",
    // pageBackground: "#14162B",
    headerBackground: "white",
    pageBackground: "white",
    footerText: "#C0C4E9",
    footerIcon: "#7f83a0",
    text: "#fff",
    textStaking: "#fff",
    // background: "#14162B",
    // backgroundStaking: "#31344E",
    background: "white",
    backgroundStaking: "white",

    notConnectedBg: "rgba(0,0,0,0.85)",
    scrollbarBg: "rgba(0,0,0,0.5)",
    tableLabelColor: "#767E87",
    tableCellBorderBottomColor: "#313C4C",
    userMenuColor: "#1A1D39",
    stakingCardBg: "#31344E",
  },
};

export const themeOptions = (theme: ITheme) => ({
  breakpoints: {
    values: {
      xs: 0,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1536,
    },
  },
  palette: palette[theme],
  custom: custom[theme],
});

export default (t: ITheme) => createTheme(defaultTheme, themeOptions(t));
