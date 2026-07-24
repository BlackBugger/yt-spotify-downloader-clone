import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import { setCode } from "./redux/reducers";

function App() {
  const dispatch = useDispatch();
  const { code } = useSelector((state) => state.code);

  useEffect(() => {
    const authorizationCode = new URLSearchParams(window.location.search).get("code");
    dispatch(setCode(authorizationCode || ""));
  }, [dispatch]);

  return code ? <Dashboard code={code} /> : <Home />;
}

export default App;
