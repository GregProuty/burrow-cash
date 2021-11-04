import React from "react";
import ReactDOM from "react-dom";
import { ThemeProvider } from "@mui/material/styles";

import App from "./App";
import { Modal } from "./components";
import { ContractContextProvider } from "./context/contracts";
import "./global.css";
import { initContract } from "./utils";
import { IBurrow } from "./interfaces/burrow";
import theme from "./theme";

export const Burrow = React.createContext<IBurrow>({} as IBurrow);

// @ts-ignore
window.nearInitPromise = initContract()
	.then((initResults) => {
		ReactDOM.render(
			<Burrow.Provider value={initResults}>
				<ContractContextProvider>
					<ThemeProvider theme={theme}>
						<Modal>
							<App />
						</Modal>
					</ThemeProvider>
				</ContractContextProvider>
			</Burrow.Provider>,
			document.querySelector("#root"),
		);
	})
	.catch(console.error);
