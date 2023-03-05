/* eslint-disable */
import { useDispatch, useSelector } from "react-redux";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home"
import { setCode } from './redux/reducers';
import React from 'react';
import { Routes, Route } from 'react-router-dom'
const codec = new URLSearchParams(window.location.search).get('code')

function App() {
  const dispatch = useDispatch();
  dispatch(setCode(codec));

  const { accessToken } = useSelector((state) => state.accessToken)
  console.log(accessToken);
  const { code } = useSelector((state) => state.code)

  console.log(code);
  return (

    // <Routes>
    //   <Route path="/" exact element={<Home />} />
    //   <Route path="/home" exact element={<Dashboard code={code} />} />

    // </Routes>
 code ? <Dashboard code={code}/> : <Home/>
  )



  
}

export default App;
