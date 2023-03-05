/* eslint-disable no-undef */

const express = require('express');
const userController = require('../controller/userController');
const router = express.Router();

//API
router.get('/convert-mp3', async (req, res) => {
  try {
    const videoID = req.query.videoID;
    console.log(req.query.videoID);

    const fetchAPI = await fetch(
      `https://youtube-mp36.p.rapidapi.com/dl?id=${videoID}`,
      {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': process.env.API_KEY,
          'X-RapidAPI-Host': process.env.API_HOST,
        },
      }
    );

    const data = await fetchAPI.json();
    if (data.status === 'ok') {
    }
    return res.send(data);
  } catch (err) {
    console.log(err);
  }
});

module.exports = router;
