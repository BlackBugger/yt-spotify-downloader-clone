import axios from 'axios';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setAccessToken } from './redux/reducers';

export default function useAuth(code) {

  const { accessToken } = useSelector((state) => state.accessToken)
  const [refreshToken, setRefreshToken] = useState();
  const [expiresIn, setExpiresIn] = useState();
  const dispatch = useDispatch();
  
  useEffect(() => {
    axios
      .post('http://localhost:3001/login', {
        code,
      })
      .then((res) => {
        dispatch(setAccessToken(res.data.accessToken));
        setRefreshToken(res.data.refreshToken);
        window.history.pushState({}, null, '/');
      })
      .catch((err) => {
        console.log(err);
      });
  }, [code]);

  useEffect(() => {
    if (!refreshToken || !expiresIn) return;
    const timer = setInterval(() => {
      axios
        .post('http://localhost:3001/refresh', {
          refreshToken,
        })
        .then((res) => {
          dispatch(setAccessToken(res.data.accessToken));
          setExpiresIn(res.data.expiresIn);
        })
        .catch(() => {
          window.location = '/';
        });
    }, (expiresIn - 60) * 1000);

    return () => clearInterval(timer);
  }, [refreshToken, expiresIn]);
  
  return accessToken;
}
